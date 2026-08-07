import pytest
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


def test_repair_continues_into_other_levers_when_activities_hits_zero():
    """Superseded by the widened lever set: a zero activities budget is no longer the
    end of the line, because food and lodging can still absorb some of the overspend."""
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=9000.0)
    ])
    state = {"logs": [], "verification": v, "budget": _budget(activities=0.0), "repair_attempts": 1}
    out = repair_node(state)
    assert out["repair_exhausted"] is False
    assert out["budget"].food_cost < 100.0


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


def test_router_still_repairs_when_only_activities_is_zero():
    """Superseded: with food and lodging levers available there is still headroom, so
    the router should dispatch rather than give up at zero activities."""
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=9000.0)
    ])
    state = {"verification": v, "repair_attempts": 0, "budget": _budget(activities=0.0)}
    assert verification_router(state) == "node_repair"


def test_router_still_repairs_when_activities_budget_has_headroom():
    v = PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=50.0)
    ])
    state = {"verification": v, "repair_attempts": 0, "budget": _budget(activities=300.0)}
    assert verification_router(state) == "node_repair"


# --- widened repair levers ----------------------------------------------------

from app.agents.orchestrator import (
    REPAIR_LEVERS, REPAIR_FLOOR_FRACTION, _repair_headroom, _floor_for as _floor,
)


def _overrun(amount):
    return PlanVerification(valid=False, violations=[
        Violation(code=BUDGET_OVERRUN, message="x", repairable=True, overspend_amount=amount)
    ])


def test_repair_spends_activities_first_before_touching_food_or_lodging():
    """Activities are the most discretionary lever, so a small overrun must not
    degrade lodging when activities alone can absorb it."""
    state = {"logs": [], "verification": _overrun(100.0),
             "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    assert out["budget"].activities_cost == 200.0
    assert out["budget"].food_cost == 100.0            # untouched
    assert out["budget"].accommodation_cost == 200.0   # untouched


def test_lodging_driven_overrun_is_repaired_once_activities_are_exhausted():
    """An overrun larger than the activities line must cascade into food and lodging."""
    state = {"logs": [], "verification": _overrun(500.0),
             "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    b = out["budget"]
    assert b.activities_cost == 0.0                 # fully spent
    assert b.food_cost < 100.0                      # cascaded into food
    assert b.total < 1000.0
    assert out["repair_exhausted"] is False


def test_repair_respects_floors_and_never_zeroes_food_or_lodging():
    """A budget 'balanced' by assuming the traveller neither eats nor sleeps is a lie."""
    state = {"logs": [], "verification": _overrun(99999.0),
             "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    b = repair_node(state)["budget"]
    assert b.activities_cost == 0.0
    assert b.food_cost == pytest.approx(100.0 * REPAIR_FLOOR_FRACTION["food_cost"])
    assert b.accommodation_cost == pytest.approx(200.0 * REPAIR_FLOOR_FRACTION["accommodation_cost"])
    assert b.food_cost > 0 and b.accommodation_cost > 0


def test_transport_is_never_reduced_because_it_maps_to_a_real_option():
    state = {"logs": [], "verification": _overrun(99999.0),
             "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    assert out["budget"].travel_cost == 400.0   # unchanged
    assert "travel_cost" not in REPAIR_LEVERS


def test_multi_category_overrun_reports_shortfall_when_transport_dominates():
    """Transport isn't reducible, so a transport-driven overrun should be partially
    absorbed and then honestly reported as still-unresolved."""
    state = {"logs": [], "verification": _overrun(99999.0),
             "budget": _budget(total=1000.0, activities=300.0), "repair_attempts": 0}
    out = repair_node(state)
    assert any("not reducible" in line for line in out["logs"])


def test_repair_is_exhausted_when_every_lever_sits_at_its_floor():
    """Floors are anchored to the ORIGINAL budget, so the state must carry the baseline
    -- which is exactly what repair_node threads through after its first pass."""
    baseline = _budget(total=1000.0, activities=300.0)
    floored = BudgetBreakdown(
        travel_cost=400.0,
        accommodation_cost=_floor(baseline, "accommodation_cost"),
        food_cost=_floor(baseline, "food_cost"),
        activities_cost=0.0, buffer=0.0, total=540.0,
    )
    out = repair_node({"logs": [], "verification": _overrun(500.0), "budget": floored,
                       "budget_baseline": baseline, "repair_attempts": 1})
    assert out["repair_exhausted"] is True
    assert any("already at its floor" in line for line in out["logs"])


def test_router_stops_when_total_headroom_across_all_levers_is_gone():
    """The loop must still terminate now that there are three levers, not one."""
    baseline = _budget(total=1000.0, activities=300.0)
    floored = BudgetBreakdown(
        travel_cost=400.0,
        accommodation_cost=_floor(baseline, "accommodation_cost"),
        food_cost=_floor(baseline, "food_cost"),
        activities_cost=0.0, buffer=0.0, total=540.0,
    )
    assert _repair_headroom(floored, baseline) == pytest.approx(0.0)
    assert verification_router({
        "verification": _overrun(500.0), "repair_attempts": 0,
        "budget": floored, "budget_baseline": baseline,
    }) == "node_planner"


def test_floors_are_anchored_to_the_original_budget_not_the_current_one():
    """Guards the Zeno bug: floors derived from the CURRENT value let each pass shave
    another fraction, so a lever approaches zero without ever reaching a floor and
    'exhausted' never fires."""
    baseline = _budget(total=1000.0, activities=300.0)
    once = repair_node({"logs": [], "verification": _overrun(99999.0),
                        "budget": baseline, "repair_attempts": 0})
    twice = repair_node({"logs": [], "verification": _overrun(99999.0),
                         "budget": once["budget"], "budget_baseline": baseline,
                         "repair_attempts": 1})
    assert twice["budget"].food_cost == once["budget"].food_cost
    assert twice["budget"].accommodation_cost == once["budget"].accommodation_cost
    assert twice["repair_exhausted"] is True
