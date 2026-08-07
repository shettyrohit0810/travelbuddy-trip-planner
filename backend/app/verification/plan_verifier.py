"""Hard-constraint verification for an assembled trip plan.

This is deliberately NOT an LLM asking itself "does this look right?" -- every
check here is arithmetic or a structural invariant, so a violation is a fact
rather than an opinion. The graph routes on these results, which is what makes
the replan loop a real control-flow decision instead of a prompt.

Extends the same idea as `app.scheduling.validator` (which checks one schedule in
isolation) up to the whole assembled plan: budget, trip shape, and grounding.
"""
from dataclasses import dataclass, field
from typing import List, Optional

from app.schemas.budget import BudgetBreakdown
from app.schemas.itinerary import ItineraryResponse
from app.schemas.understanding import TripRequirements

# Violation codes. Kept as constants so the orchestrator's repair logic can branch
# on identity rather than string-matching a human-readable message.
BUDGET_OVERRUN = "budget_overrun"
ACTIVITIES_OVERSPEND = "activities_overspend"
DAY_COUNT_MISMATCH = "day_count_mismatch"
SLOT_OVERLAP = "slot_overlap"
UNGROUNDED_FACT = "ungrounded_fact"

# Currency rounding noise, not a real overrun.
_TOLERANCE = 0.01


@dataclass(frozen=True)
class Violation:
    code: str
    message: str
    repairable: bool
    overspend_amount: Optional[float] = None


@dataclass(frozen=True)
class PlanVerification:
    valid: bool
    violations: List[Violation] = field(default_factory=list)

    @property
    def repairable_violations(self) -> List["Violation"]:
        return [v for v in self.violations if v.repairable]


def _to_minutes(hhmm: str) -> Optional[int]:
    try:
        hours, minutes = hhmm.split(":")
        return int(hours) * 60 + int(minutes)
    except (ValueError, AttributeError):
        return None


def verify_plan(
    requirements: Optional[TripRequirements],
    budget: Optional[BudgetBreakdown],
    itinerary: Optional[ItineraryResponse],
) -> PlanVerification:
    """Check an assembled plan against the traveler's hard constraints.

    Returns every violation found rather than short-circuiting on the first, so
    the repair step can see the full picture before deciding what to change.
    """
    violations: List[Violation] = []

    requested_budget = requirements.budget if requirements else None
    if requested_budget is not None and budget is not None:
        if budget.total > requested_budget + _TOLERANCE:
            overspend = round(budget.total - requested_budget, 2)
            violations.append(Violation(
                code=BUDGET_OVERRUN,
                message=(
                    f"Plan total {budget.total} exceeds the traveler's stated budget "
                    f"{requested_budget} by {overspend}"
                ),
                repairable=True,
                overspend_amount=overspend,
            ))

    if itinerary is not None:
        requested_days = requirements.days if requirements else None
        if requested_days is not None and len(itinerary.itinerary) != requested_days:
            violations.append(Violation(
                code=DAY_COUNT_MISMATCH,
                message=(
                    f"Itinerary covers {len(itinerary.itinerary)} day(s) but "
                    f"{requested_days} were requested"
                ),
                # The scheduler guarantees one DaySchedule per requested day, so this
                # firing means something upstream is wrong -- retrying won't fix it.
                repairable=False,
            ))

        activities_spend = 0.0
        for day in itinerary.itinerary:
            previous_end = None
            for slot in day.slots:
                activities_spend += slot.estimated_cost

                if not slot.source or not slot.source.strip():
                    violations.append(Violation(
                        code=UNGROUNDED_FACT,
                        message=(
                            f"Day {day.day}: '{slot.name}' has no source attribution -- "
                            f"every scheduled fact must trace to a real tool call"
                        ),
                        repairable=False,
                    ))

                start = _to_minutes(slot.start_time)
                end = _to_minutes(slot.end_time)
                if start is None or end is None:
                    continue
                if previous_end is not None and start < previous_end:
                    violations.append(Violation(
                        code=SLOT_OVERLAP,
                        message=f"Day {day.day}: '{slot.name}' starts before the previous stop ends",
                        repairable=False,
                    ))
                previous_end = end

        if budget is not None and activities_spend > budget.activities_cost + _TOLERANCE:
            overspend = round(activities_spend - budget.activities_cost, 2)
            violations.append(Violation(
                code=ACTIVITIES_OVERSPEND,
                message=(
                    f"Scheduled activities cost {round(activities_spend, 2)} exceeds the "
                    f"allocated activities budget {budget.activities_cost} by {overspend}"
                ),
                repairable=True,
                overspend_amount=overspend,
            ))

    return PlanVerification(valid=not violations, violations=violations)
