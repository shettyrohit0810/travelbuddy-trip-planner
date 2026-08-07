import json
import logging
from typing import List, Optional, Tuple

from app.core.config import settings
from app.schemas.itinerary import (
    ItineraryRequest,
    DailySchedule,
    ItineraryResponse,
    ScheduledSlotOut,
    DayNarration,
    NarrationResponse,
)
from app.tools.destination_search import destination_search
from app.scheduling.models import Candidate, Coordinates, ScheduleConstraints, ScheduleResult, DaySchedule as SchedulerDaySchedule
from app.scheduling.scheduler import build_schedule
from app.scheduling.validator import validate
from app.scheduling.geo import HaversineTravelTimeProvider
from app.scheduling.costs import StaticCostEstimator

logger = logging.getLogger("app.agents.itinerary")


def _fetch_candidates(destination: str, prefetched: Optional[dict] = None) -> Tuple[List[Candidate], Optional[str]]:
    """Real points of interest, converted to scheduler Candidates. Returns [] (not
    fake data) if destination_search is unavailable or the location can't be
    resolved."""
    try:
        # Reuse the parallel prefetch when the orchestrator supplied one. Falling back
        # to a fresh lookup keeps this function usable standalone (and in tests).
        result = prefetched if prefetched is not None else destination_search(destination)
        activities = result.get("activities", [])
        # Carry the provider through as the slot's source attribution -- the verifier
        # rejects any scheduled fact that cannot be traced back to a real tool call,
        # so this must reflect where the data actually came from.
        source = result.get("source") or "unknown"
        resolved = result.get("resolved_location")
    except Exception as e:
        logger.error(f"destination_search failed for {destination!r}: {e}")
        return [], None

    estimator = StaticCostEstimator()
    candidates = []
    for a in activities:
        lat, lon = a.get("lat"), a.get("lon")
        if lat is None or lon is None:
            continue
        category = a.get("category", "attraction")
        # Prefer a per-POI cost when the provider supplied one (Overpass derives it
        # from the `fee` tag). Fall back to the category rate otherwise -- never to
        # zero, which would let an unpriced stop slip past the budget ceiling.
        cost = a.get("estimated_cost")
        if cost is None:
            cost = estimator.estimate(category)
        candidates.append(Candidate(
            name=a["name"],
            category=category,
            rating=float(a.get("rating", 3.0)),
            coords=Coordinates(lat=lat, lon=lon),
            source=source,
            estimated_cost=float(cost),
        ))
    return candidates, resolved


def _minutes_to_hhmm(minutes: float) -> str:
    total = int(round(minutes)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def _build_schedule_result(req: ItineraryRequest, candidates: List[Candidate]) -> ScheduleResult:
    start_location = None
    if req.accommodation_lat is not None and req.accommodation_lon is not None:
        start_location = Coordinates(lat=req.accommodation_lat, lon=req.accommodation_lon)

    constraints = ScheduleConstraints(
        days=req.days,
        start_location=start_location,
        activities_budget=req.activities_budget,
    )
    result = build_schedule(candidates, constraints, HaversineTravelTimeProvider())

    validation = validate(result, constraints)
    if not validation.valid:
        logger.error(f"Scheduler produced an invalid result for {req.destination!r}: {validation.violations}")

    return result


def _deterministic_narration(day_schedule: SchedulerDaySchedule) -> Tuple[str, str, str]:
    texts = [
        f"Visit {slot.name} ({slot.category}). ~{round(slot.travel_min_from_previous)} min travel from the previous stop."
        for slot in day_schedule.slots
    ]
    while len(texts) < 3:
        texts.append("Free time to explore at your own pace.")
    return texts[0], texts[1], texts[2]


def _llm_narration(req: ItineraryRequest, result: ScheduleResult) -> Optional[List[DayNarration]]:
    """Ask the LLM to write prose ONLY for the already-decided slot list -- it
    cannot reorder, invent, or drop attractions; the structured slot data always
    comes from `result`, never from this narration."""
    slot_summary = []
    for day_schedule in result.days:
        stops = [
            f"{s.name} ({_minutes_to_hhmm(s.start_min)}-{_minutes_to_hhmm(s.end_min)})"
            for s in day_schedule.slots
        ]
        slot_summary.append(f"Day {day_schedule.day}: {', '.join(stops) if stops else 'no stops scheduled'}")

    prompt = (
        f"You are writing narrative descriptions for an already-finalized trip itinerary to {req.destination}. "
        f"The schedule below is FIXED — do not add, remove, reorder, or rename any stop. "
        f"For each day, write a 1-2 sentence description for morning, afternoon, and evening covering only the "
        f"stops listed for that day (if a time slot has no stop, write a short free-time suggestion).\n\n"
        + "\n".join(slot_summary)
    )

    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=NarrationResponse
                )
            )
            data = json.loads(response.text)
            return NarrationResponse(**data).days
        except Exception as e:
            logger.error(f"Gemini itinerary narration failed, falling back: {str(e)}")

    if settings.OPENAI_API_KEY:
        try:
            from app.core.llm import generate_structured_output
            return generate_structured_output(prompt, NarrationResponse).days
        except Exception as e:
            logger.error(f"OpenAI/Groq itinerary narration failed, falling back: {str(e)}")

    return None


def generate_itinerary(req: ItineraryRequest, prefetched_pois: Optional[dict] = None) -> ItineraryResponse:
    """
    Generate a day-by-day itinerary. The deterministic scheduler always decides
    which real attraction goes in which slot (respecting travel time and budget);
    an LLM, if configured, only narrates prose for those already-decided slots and
    cannot alter the schedule.
    """
    candidates, resolved = _fetch_candidates(req.destination, prefetched_pois)
    result = _build_schedule_result(req, candidates)

    # If the geocoder resolved to a different place than was asked for, that belongs in
    # the output, not just a log line. Silently planning Genoa when the request said Goa
    # produces a confident itinerary that answers the wrong question.
    location_warnings = []
    if resolved and req.destination.strip().lower() not in resolved.lower():
        location_warnings.append(
            f"Requested '{req.destination}' resolved to '{resolved}' — the stops below "
            f"are in {resolved}."
        )

    narrations_by_day = {}
    llm_narrations = _llm_narration(req, result)
    if llm_narrations:
        narrations_by_day = {n.day: n for n in llm_narrations}

    daily_schedules = []
    for day_schedule in result.days:
        narration = narrations_by_day.get(day_schedule.day)
        if narration:
            morning, afternoon, evening = narration.morning, narration.afternoon, narration.evening
        else:
            morning, afternoon, evening = _deterministic_narration(day_schedule)

        slots_out = [
            ScheduledSlotOut(
                name=s.name,
                category=s.category,
                source=s.source,
                start_time=_minutes_to_hhmm(s.start_min),
                end_time=_minutes_to_hhmm(s.end_min),
                travel_minutes_from_previous=s.travel_min_from_previous,
                estimated_cost=s.estimated_cost,
            )
            for s in day_schedule.slots
        ]

        daily_schedules.append(DailySchedule(
            day=day_schedule.day,
            morning=morning,
            afternoon=afternoon,
            evening=evening,
            slots=slots_out,
        ))

    return ItineraryResponse(
        destination=req.destination,
        itinerary=daily_schedules,
        warnings=location_warnings + result.warnings,
    )
