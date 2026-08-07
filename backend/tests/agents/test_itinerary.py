from unittest.mock import patch

from app.schemas.itinerary import ItineraryRequest
from app.agents.itinerary import generate_itinerary


MOCK_ACTIVITIES = [
    {"name": "Mock Temple", "category": "historic", "rating": 4.8, "lat": 35.0, "lon": 135.0},
    {"name": "Mock Garden", "category": "natural", "rating": 4.5, "lat": 35.001, "lon": 135.001},
    {"name": "Mock Market", "category": "cultural", "rating": 4.2, "lat": 35.002, "lon": 135.002},
]


def _mock_search_result(query, category=None):
    return {"destination": query, "results_count": len(MOCK_ACTIVITIES), "activities": MOCK_ACTIVITIES, "source": "opentripmap"}


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_only_schedules_real_mocked_places(mock_search):
    req = ItineraryRequest(destination="Testville", days=1)
    response = generate_itinerary(req)

    real_names = {a["name"] for a in MOCK_ACTIVITIES}
    scheduled_names = {slot.name for day in response.itinerary for slot in day.slots}

    assert len(scheduled_names) > 0
    assert scheduled_names.issubset(real_names)


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_deterministic_narration_mentions_real_names(mock_search):
    req = ItineraryRequest(destination="Testville", days=1)
    response = generate_itinerary(req)

    day = response.itinerary[0]
    combined_text = f"{day.morning} {day.afternoon} {day.evening}"
    assert any(slot.name in combined_text for slot in day.slots)


@patch(
    "app.agents.itinerary.destination_search",
    return_value={"destination": "Nowhere", "results_count": 0, "activities": [], "source": "unavailable"},
)
def test_generate_itinerary_returns_honest_warning_when_no_data(mock_search):
    req = ItineraryRequest(destination="Nowhere", days=2)
    response = generate_itinerary(req)

    assert all(len(day.slots) == 0 for day in response.itinerary)
    assert len(response.warnings) > 0


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_respects_activities_budget(mock_search):
    # NB: a zero budget does NOT mean "schedule nothing" -- ACTIVITY_COST_BY_CATEGORY
    # prices "natural" at 0.0, so genuinely-free attractions legitimately still fit.
    # The real invariant is that nothing with a non-zero cost gets scheduled and the
    # trip spends nothing.
    req = ItineraryRequest(destination="Testville", days=1, activities_budget=0.0)
    response = generate_itinerary(req)

    scheduled = [slot for day in response.itinerary for slot in day.slots]
    assert all(slot.estimated_cost == 0.0 for slot in scheduled)
    assert sum(slot.estimated_cost for slot in scheduled) == 0.0
    # The paid mock attractions (historic=10.0, cultural=15.0) must be excluded.
    assert {s.name for s in scheduled}.isdisjoint({"Mock Temple", "Mock Market"})


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_excludes_attractions_that_bust_a_small_budget(mock_search):
    # Budget fits the 10.0 "historic" stop but not the 15.0 "cultural" one on top.
    req = ItineraryRequest(destination="Testville", days=1, activities_budget=10.0)
    response = generate_itinerary(req)

    total = sum(slot.estimated_cost for day in response.itinerary for slot in day.slots)
    assert total <= 10.0
