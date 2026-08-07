from app.agents.orchestrator import (
    verification_node,
    repair_node,
    verification_router,
    MAX_REPAIR_ATTEMPTS,
)
from app.schemas.understanding import TripRequirements
from app.schemas.budget import BudgetBreakdown
from app.schemas.itinerary import ItineraryResponse, DailySchedule, ScheduledSlotOut
from app.verification.plan_verifier import PlanVerification, Violation, BUDGET_OVERRUN


def _budget(total=1000.0, activities=300.0):
    return BudgetBreakdown(
        travel_cost=400.0, accommodation_cost=200.0, food_cost=100.0,
        activities_cost=activities, buffer=0.0, total=total,
    )


def _itinerary(days=1):
    return ItineraryResponse(
        destination="Testville",
        itinerary=[
            DailySchedule(
                day=i + 1, morning="m", afternoon="a", evening="e",
                slots=[ScheduledSlotOut(
                    name="Real Place", category="historic", source="opentripmap",
                    start_time="09:00", end_time="11:00",
                    travel_minutes_from_previous=0.0, estimated_cost=10.0,
                )],
            )
            for i in range(days)
        ],
        warnings=[],
    )


def test_verification_node_records_violations_in_state():
    state = {
        "logs": [], "requirements": TripRequirements(destination="T", days=1, budget=500.0),
        "budget": _budget(total=800.0), "itinerary": _itinerary(),
    }
    out = verification_node(state)
    assert not out["verification"].valid
    assert any("VIOLATION" in line for line in out["logs"])


def test_router_goes_to_planner_when_plan_is_valid():
    state = {"verification": PlanVerification(valid=True, violations=[]), "repair_attempts": 0}
    assert verification_router(state) == "node_planner"


def test_router_goes_to_repair_on_a_repairable_violation():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=100.0)
    ])
    assert verification_router({"verification": v, "repair_attempts": 0}) == "node_repair"


def test_router_stops_repairing_once_the_attempt_cap_is_reached():
    """The loop must terminate rather than spin forever on an unfixable overrun."""
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=100.0)
    ])
    state = {"verification": v, "repair_attempts": MAX_REPAIR_ATTEMPTS}
    assert verification_router(state) == "node_planner"


def test_router_does_not_retry_an_unrepairable_violation():
    v = PlanVerification(valid=False, violations=[
        Violation(code="ungrounded_fact", message="x", repairable=False)
    ])
    assert verification_router({"verification": v, "repair_attempts": 0}) == "node_planner"


def test_repair_node_reduces_activities_budget_by_the_overspend():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=100.0)
    ])
    state = {"logs": [], "verification": v, "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    out = repair_node(state)

    assert out["budget"].activities_cost == 200.0
    # Total must be recomputed from components, not left stale.
    assert out["budget"].total == 900.0
    assert out["repair_attempts"] == 1


def test_repair_node_never_drives_the_activities_budget_negative():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=99999.0)
    ])
    state = {"logs": [], "verification": v, "budget": _budget(activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    assert out["budget"].activities_cost == 0.0


def test_repair_then_verify_actually_resolves_a_fixable_overrun():
    """End-to-end on the loop's logic: one repair pass should clear the violation."""
    requirements = TripRequirements(destination="T", days=1, budget=900.0)
    state = {
        "logs": [], "requirements": requirements,
        "budget": _budget(total=1000.0, activities=300.0), "itinerary": _itinerary(),
    }
    first = verification_node(state)
    assert not first["verification"].valid

    state["verification"] = first["verification"]
    repaired = repair_node(state)
    state["budget"] = repaired["budget"]

    second = verification_node(state)
    assert second["verification"].valid


def test_repair_node_flags_exhaustion_when_there_is_no_headroom_left():
    """Reducing 0.0 -> 0.0 cannot help; re-running the scheduler would be pure waste."""
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=9000.0)
    ])
    state = {"logs": [], "verification": v, "budget": _budget(activities=0.0), "repair_attempts": 1}
    out = repair_node(state)
    assert out["repair_exhausted"] is True
    assert any("no headroom left" in line for line in out["logs"])


def test_router_stops_immediately_once_repair_is_exhausted():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=9000.0)
    ])
    state = {"verification": v, "repair_attempts": 1, "repair_exhausted": True}
    assert verification_router(state) == "node_planner"


def test_repair_node_does_not_flag_exhaustion_when_it_can_still_reduce():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=100.0)
    ])
    state = {"logs": [], "verification": v, "budget": _budget(activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    assert out["repair_exhausted"] is False


def test_router_skips_repair_entirely_when_activities_budget_is_already_zero():
    """Repair's only lever is the activities allocation. At zero, dispatching a
    repair pass would re-run the whole scheduler to reach an identical plan."""
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=9000.0)
    ])
    state = {"verification": v, "repair_attempts": 0, "budget": _budget(activities=0.0)}
    assert verification_router(state) == "node_planner"


def test_router_still_repairs_when_activities_budget_has_headroom():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=50.0)
    ])
    state = {"verification": v, "repair_attempts": 0, "budget": _budget(activities=300.0)}
    assert verification_router(state) == "node_repair"
