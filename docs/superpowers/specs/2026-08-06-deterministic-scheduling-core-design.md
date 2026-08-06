# Deterministic Scheduling Core — Design

Phase 3 of [KICKOFF_PROMPT.md](../../../KICKOFF_PROMPT.md): pull day-by-day itinerary
sequencing out of the LLM and into a real, unit-testable scheduling engine. The LLM's
role narrows to structured-preference extraction and (optionally) narrating prose for
slots the scheduler already decided — it never chooses which attraction goes where.

## Problem

Today, when a Gemini/OpenAI key is set, `generate_itinerary()` sends one prompt and lets
the LLM invent the entire day-by-day structure: which attractions, what order, which day.
When no key is set, `rule_based_generate()` either returns a hand-authored
`DESTINATION_DATABASE` template (Goa/Kyoto/Jaipur/Paris only) or generic, unnamed filler
text for everywhere else. Neither path respects travel time, opening hours, or budget —
they can't, because nothing computes them. `destination_search()` (the real-POI tool
grounded in Phase 1) is either ignored (LLM path) or was previously never called at all
(the bug fixed alongside this phase).

## Decisions made during brainstorming

- **Scheduler is the mandatory backbone on every path.** The LLM (when a key is present)
  only narrates prose for already-decided slots; it cannot reorder, invent, or drop
  attractions. Without a key, deterministic templated narration is used instead. Either
  way, the structured slot data is authoritative and cannot be corrupted by LLM prose.
- **Travel time: haversine distance + assumed speed**, not a real routing API. Grounded in
  real coordinates, not guessed — but doesn't account for actual roads/traffic. A real
  routing API is a valid future upgrade, deliberately designed as a drop-in behind an
  interface rather than implemented now (new provider = new ask-before-adding-dependency
  round).
- **Opening hours: skipped this pass, assumed open.** OpenTripMap's basic radius search
  (already used by `destination_search`) doesn't include hours; getting them needs a
  per-place detail call per candidate, adding N extra API calls and rate-limit exposure.
  `Candidate` carries an unused `open_windows` field so wiring this in later is additive,
  not a restructure.
- **Activity cost: flat per-category heuristic table**, same honesty level as the existing
  `budget_estimator.py` (a labeled estimate, not a live-pricing claim). Used to enforce the
  budget cap during scheduling.
- **Algorithm: per-day 0/1 knapsack (DP) for stop selection + brute-force permutation for
  stop ordering.** Rejected pure rating-sort greedy (locally optimal only, can strand
  nearby lower-rated stops behind a far higher-rated one) and OR-Tools CP-SAT (the
  textbook-correct VRPTW solver, but a heavy new dependency requiring a separate
  ask-before-adding-dependency approval — not worth it for this pass). DP knapsack is
  provably optimal per day given fixed visit duration, fully deterministic, and needs no
  new dependency. `ports.py`'s `TravelTimeProvider`/`CostEstimator` interfaces are designed
  so OR-Tools could become a third implementation later without touching call sites.
- **`DESTINATION_DATABASE` (hand-authored Goa/Kyoto/Jaipur/Paris content) is retired
  entirely**, not special-cased. Every destination goes through the same real,
  schedule-driven, traceable path — consistent with "the algorithm decides structure,
  never hardcoded or invented," which is the actual point of this phase. Output for these
  cities will be real but less polished than the previous hand-written version.
- **Hotel coordinates fixed now, not deferred.** Amadeus's `hotel-offers` response already
  includes `hotel.latitude`/`hotel.longitude`; `hotel_search.py` previously dropped them.
  Capturing them lets "the day starts from the hotel" be real travel time instead of a
  fabricated zero.
- **Found but explicitly out of scope for this phase**: `accommodation.py`'s
  `recommend_accommodation()` tries Gemini first, with a prompt that literally asks it to
  invent "realistic" INR hotel prices — the same anti-pattern this phase removes from
  itinerary generation, one file away. Logged here as a near-term follow-up, not folded
  into this phase's scope.
- **No-data behavior change (flagged explicitly):** if `destination_search` returns no
  candidates (no API key, unresolvable location), the scheduler returns empty days with a
  warning instead of falling back to generic filler text — because that filler-text
  fallback (and `DESTINATION_DATABASE`) no longer exists. This is a real, user-visible
  change from today's "there's always *some* text" behavior, consistent with the
  anti-hallucination principle: no real data means an honest warning, not invented prose.

## Architecture

A new, dependency-free package, `backend/app/scheduling/` — pure functions only, no
network, no DB, no `datetime.now()`, no randomness, so it's unit-testable with fixed
inputs and known-correct outputs:

```
backend/app/scheduling/
  models.py        # frozen dataclasses: Coordinates, TimeWindow, Candidate,
                    # ScheduleConstraints, ScheduledSlot, DaySchedule, ScheduleResult
  ports.py          # Protocol: TravelTimeProvider, CostEstimator — the dependency-
                     # inversion seam the allocator depends on, never a concrete impl
  geo.py             # haversine_km() + HaversineTravelTimeProvider(TravelTimeProvider)
  costs.py            # ACTIVITY_COST_BY_CATEGORY + StaticCostEstimator(CostEstimator)
  day_selector.py      # per-day knapsack (DP) selection + brute-force ordering (pure)
  scheduler.py          # build_schedule(candidates, constraints, providers) — orchestrates
                          # day_selector across days; depends only on ports.py Protocols
  validator.py           # validate(result, constraints) -> ValidationResult — independent
                          # invariant re-checker; the seed of Phase 4's plan verifier
```

Flat rather than layered `domain/`/`engine/`/`adapters/` subpackages — at this project's
actual scale, a full DDD-style layout is more directory ceremony than payoff. The one
structural addition over a naive sketch is `ports.py`, which is where the real
dependency-inversion benefit lives.

### Domain models

Frozen dataclasses (`@dataclass(frozen=True)`), not Pydantic, internally. Pydantic stays
at the API boundary (`schemas/itinerary.py`). Internal domain objects aren't untrusted
external input, so Pydantic's validation overhead there solves a problem that doesn't
exist. Immutability matters concretely: a future replan or user-edit flow produces a *new*
`ScheduleResult` rather than mutating one in place — safer, and directly compatible with
Phase 4's "diff old plan vs. new plan" replan loop.

- `Coordinates(lat: float, lon: float)`
- `TimeWindow(start_min: int, end_min: int)` — minutes since midnight
- `Candidate(name, category, rating, coords: Coordinates, source, estimated_cost, open_windows: Optional[List[TimeWindow]] = None, mandatory: bool = False)`
- `ScheduleConstraints(days: int, day_start_min=540, day_end_min=1260, visit_duration_min=120, start_location: Optional[Coordinates] = None, activities_budget: Optional[float] = None, max_slots_per_day=3)`
- `ScheduledSlot(day, slot_index, start_min, end_min, name, category, source, travel_min_from_previous, estimated_cost)`
- `DaySchedule(day: int, slots: List[ScheduledSlot], notes: List[str])`
- `ScheduleResult(days: List[DaySchedule], total_estimated_cost: float, warnings: List[str])`

### Ports (the dependency-inversion seam)

```python
class TravelTimeProvider(Protocol):
    def minutes_between(self, a: Coordinates, b: Coordinates) -> float: ...

class CostEstimator(Protocol):
    def estimate(self, category: str) -> float: ...
```

`scheduler.py` and `day_selector.py` depend only on these Protocols, injected as
parameters — never importing `geo.py`/`costs.py` concretely. This is what makes "swap
haversine for a real routing API later" a new adapter file with zero changes to the
allocator, and what makes unit tests able to inject a fake provider returning constants
instead of mocking network calls.

### Algorithm

Per day, in order:

1. **Selection (DP knapsack):** over the unused candidate pool, solve 0/1 knapsack with
   value = rating, weight = `estimated_cost`, capacity = remaining budget (trip-level
   `activities_budget`, decremented as days are scheduled), additionally capped at
   `max_slots_per_day` items. Small state space (≤20 candidates × budget buckets × ≤4
   count) — trivial to compute exactly, no approximation needed.
2. **Ordering (brute force):** permute the selected set (≤4! = 24 orderings) starting from
   `start_location` (the hotel — same start point every day, not chained from the previous
   day's last stop, matching how real trips return to lodging each night). Compute total
   time (travel + visit) per permutation via the injected `TravelTimeProvider`; pick the
   ordering with the earliest finish time, tie-broken by lexicographic name order for
   determinism.
3. **Fit check:** if even the best ordering exceeds `day_end_min`, drop the
   lowest-rated selected item and retry step 2. If the day ends up with fewer than
   `max_slots_per_day` slots (or zero), append a note explaining why (ran out of
   candidates, or nothing fit within the remaining day/budget).
4. **Repeat fallback:** if a day would otherwise be completely empty and at least one
   candidate exists trip-wide, allow revisiting the single best-rated used candidate
   rather than leaving the day fully blank — noted explicitly ("Revisiting X — limited new
   options found nearby"), never silent.
5. Mandatory candidates (`Candidate.mandatory=True`) are placed before the knapsack runs;
   if one can't fit, that's a warning, not a silent drop (there are none yet — this is the
   seed for a future "must-see" feature, see Future-proofing below).

### Validator

`validate(result: ScheduleResult, constraints: ScheduleConstraints) -> ValidationResult`
independently re-checks: no two slots on the same day overlap, every slot respects
`day_start_min`/`day_end_min`, `total_estimated_cost` never exceeds `activities_budget`
when one was given. Called defensively right after `build_schedule()` in
`generate_itinerary()` (should never fail if the builder is correct — this is a trust-but-
verify safety net, and the reusable seed for Phase 4's hard-constraint plan verifier).

## Data flow / integration

- `backend/app/tools/destination_search.py`: capture `lat`/`lon` from OpenTripMap's
  `point` field per place (currently discarded).
- `backend/app/tools/hotel_search.py` + `schemas/accommodation.py`: capture
  `hotel.latitude`/`hotel.longitude` from Amadeus's response into a new
  `AccommodationOption.lat`/`.lon`.
- `schemas/itinerary.py`: `ItineraryRequest` gains `activities_budget: Optional[float]`
  and `accommodation_location: Optional[dict]` (lat/lon). `DailySchedule` additively gains
  `slots: List[ScheduledSlotOut]` (structured, traceable — name, category, source,
  start/end time, travel minutes, estimated cost) alongside the existing
  morning/afternoon/evening text (kept for the current frontend). `ItineraryResponse`
  gains `warnings: List[str] = []`.
- `backend/app/agents/itinerary.py`: `generate_itinerary()` always fetches real POIs,
  converts to `Candidate`s, calls `build_schedule()` then `validate()` unconditionally.
  Narration is the only thing branching on LLM-key presence: with a key, the LLM receives
  the already-decided slot list and writes prose only; without one, deterministic
  templated text is built directly from `ScheduleResult`. `DESTINATION_DATABASE` and the
  old ad hoc "3-per-day modulo" indexing are deleted.
- `backend/app/agents/orchestrator.py`: `itinerary_node` populates
  `ItineraryRequest.activities_budget` from `state["budget"].activities_cost` and
  `accommodation_location` from `state["accommodation"][0]` — both already available at
  that point in the graph (budget and accommodation nodes run before itinerary).

## Error handling

- No real POIs (no API key, unresolvable location): empty days, explicit warning, no
  filler text (see "No-data behavior change" above).
- Fewer POIs than needed for every day: later days get partial slots with a note, not
  artificial padding.
- LLM narration errors: fall back to deterministic templated text from the same
  `ScheduleResult` — never to free-form LLM generation, since that path no longer exists.

## Testing strategy

- **Unit**: `build_schedule()` with fixed candidates/constraints and a fake
  `TravelTimeProvider` returning constants → assert the exact expected `ScheduleResult`.
- **Property-based** (would need `hypothesis` — a new dependency, to be asked about
  separately, not assumed): random candidates/constraints → assert invariants universally
  (budget never exceeded, no overlaps, day-end respected, same input twice → identical
  output). `validate()` is what these properties check against.
- **Integration**: `generate_itinerary()` end-to-end with `destination_search`/LLM mocked
  → assert every place name in the final response exists in the mocked candidate list —
  the signature test enforcing "LLM narrates, never invents."
- **Snapshot**: a checked-in realistic candidate fixture → assert `build_schedule()`'s
  output matches a checked-in expected result, catching behavior drift on refactors.

## Explicitly out of scope for this phase

- Real routing API (haversine is the deliberate choice for now).
- Opening hours enforcement (field exists, unused).
- OR-Tools / true VRPTW optimality.
- `accommodation.py`'s LLM-invented-pricing precedence bug (logged as a follow-up).
- Meal slots, mandatory-attraction UI, weather-aware replanning, user edits/drag-drop,
  multi-modal transport — all designed for structurally (see Future-proofing table below)
  but not implemented.

## Future-proofing (why the interfaces above are shaped this way)

| Need | Change required |
|---|---|
| Opening hours | Fill `Candidate.open_windows`; add one `validator.py` rule |
| Real routing API | New `TravelTimeProvider` implementation; zero changes to `scheduler.py` |
| Meal slots | `ScheduleConstraints.meal_windows: List[TimeWindow]` as reserved time |
| Mandatory attractions | Already modeled (`Candidate.mandatory`); wire a UI/request field |
| Weather-aware replanning | Existing `category` + a scoring weight from `weather.suitability_score`; Phase 4's replan loop re-calls `build_schedule()` |
| User edits / drag-drop | Immutable `DaySchedule` → edited client-side → `validate()` re-checks it |
| Multiple transport modes | `TravelTimeProvider.minutes_between(a, b, mode)` — mode becomes a parameter |
