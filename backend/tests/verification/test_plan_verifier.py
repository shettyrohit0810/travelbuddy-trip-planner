from app.schemas.understanding import TripRequirements
from app.schemas.budget import BudgetBreakdown
from app.schemas.itinerary import ItineraryResponse, DailySchedule, ScheduledSlotOut
from app.verification.plan_verifier import (
    verify_plan,
    BUDGET_OVERRUN,
    DAY_COUNT_MISMATCH,
    SLOT_OVERLAP,
    UNGROUNDED_FACT,
    ACTIVITIES_OVERSPEND,
)


def _slot(name="Real Place", start="09:00", end="11:00", cost=10.0, source="opentripmap"):
    return ScheduledSlotOut(
        name=name, category="historic", source=source,
        start_time=start, end_time=end,
        travel_minutes_from_previous=0.0, estimated_cost=cost,
    )


def _itinerary(days=1, slots_per_day=None):
    slots_per_day = slots_per_day if slots_per_day is not None else [[_slot()]] * days
    return ItineraryResponse(
        destination="Testville",
        itinerary=[
            DailySchedule(day=i + 1, morning="m", afternoon="a", evening="e", slots=slots_per_day[i])
            for i in range(days)
        ],
        warnings=[],
    )


def _budget(total=1000.0, activities=100.0):
    return BudgetBreakdown(
        travel_cost=0.0, accommodation_cost=0.0, food_cost=0.0,
        activities_cost=activities, buffer=0.0, total=total,
    )


def test_verify_plan_accepts_a_well_formed_plan():
    req = TripRequirements(destination="Testville", days=1, budget=2000.0)
    v = verify_plan(req, _budget(), _itinerary())
    assert v.valid
    assert v.violations == []


def test_verify_plan_flags_budget_overrun_and_reports_amount():
    req = TripRequirements(destination="Testville", days=1, budget=500.0)
    v = verify_plan(req, _budget(total=800.0), _itinerary())
    assert not v.valid
    overrun = [x for x in v.violations if x.code == BUDGET_OVERRUN]
    assert len(overrun) == 1
    assert overrun[0].overspend_amount == 300.0
    assert overrun[0].repairable


def test_verify_plan_passes_when_no_budget_was_requested():
    req = TripRequirements(destination="Testville", days=1, budget=None)
    v = verify_plan(req, _budget(total=999999.0), _itinerary())
    assert v.valid


def test_verify_plan_flags_day_count_mismatch():
    req = TripRequirements(destination="Testville", days=5, budget=None)
    v = verify_plan(req, _budget(), _itinerary(days=2))
    assert not v.valid
    assert any(x.code == DAY_COUNT_MISMATCH for x in v.violations)


def test_verify_plan_flags_overlapping_slots():
    overlapping = [[_slot(name="A", start="09:00", end="12:00"), _slot(name="B", start="11:00", end="13:00")]]
    req = TripRequirements(destination="Testville", days=1, budget=None)
    v = verify_plan(req, _budget(), _itinerary(days=1, slots_per_day=overlapping))
    assert not v.valid
    assert any(x.code == SLOT_OVERLAP for x in v.violations)


def test_verify_plan_flags_ungrounded_fact_with_no_source():
    ungrounded = [[_slot(name="Invented Place", source="")]]
    req = TripRequirements(destination="Testville", days=1, budget=None)
    v = verify_plan(req, _budget(), _itinerary(days=1, slots_per_day=ungrounded))
    assert not v.valid
    assert any(x.code == UNGROUNDED_FACT for x in v.violations)


def test_verify_plan_flags_activities_overspend():
    pricey = [[_slot(name="Pricey", cost=500.0)]]
    req = TripRequirements(destination="Testville", days=1, budget=None)
    v = verify_plan(req, _budget(activities=100.0), _itinerary(days=1, slots_per_day=pricey))
    assert not v.valid
    spend = [x for x in v.violations if x.code == ACTIVITIES_OVERSPEND]
    assert len(spend) == 1
    assert spend[0].repairable
