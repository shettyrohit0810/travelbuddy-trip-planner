from unittest.mock import patch

from app.agents.orchestrator import itinerary_node
from app.schemas.understanding import TripRequirements
from app.schemas.budget import BudgetBreakdown
from app.schemas.accommodation import AccommodationOption
from app.schemas.weather import WeatherIntelligence
from app.schemas.itinerary import ItineraryRequest, ItineraryResponse


def test_itinerary_node_passes_budget_and_accommodation_coords_through():
    captured = {}

    def fake_generate_itinerary(req: ItineraryRequest, prefetched_pois=None) -> ItineraryResponse:
        captured["req"] = req
        return ItineraryResponse(destination=req.destination, itinerary=[], warnings=[])

    state = {
        "logs": [],
        "retries": 0,
        "poi_prefetch": None,
        "destination": "Testville",
        "requirements": TripRequirements(destination="Testville", days=3, people=2, interests=[]),
        "weather": WeatherIntelligence(temperature="25C", rain_probability="10%", suitability_score=80, warnings=[]),
        "budget": BudgetBreakdown(travel_cost=0, accommodation_cost=0, food_cost=0, activities_cost=240.0, buffer=0, total=240.0),
        "accommodation": [AccommodationOption(hotel="Test Hotel", price=100.0, rating=4.5, lat=35.0, lon=135.0)],
    }

    with patch("app.agents.orchestrator.generate_itinerary", side_effect=fake_generate_itinerary):
        itinerary_node(state)

    assert captured["req"].activities_budget == 240.0
    assert captured["req"].accommodation_lat == 35.0
    assert captured["req"].accommodation_lon == 135.0


def test_itinerary_node_handles_no_accommodation_gracefully():
    captured = {}

    def fake_generate_itinerary(req: ItineraryRequest, prefetched_pois=None) -> ItineraryResponse:
        captured["req"] = req
        return ItineraryResponse(destination=req.destination, itinerary=[], warnings=[])

    state = {
        "logs": [],
        "retries": 0,
        "poi_prefetch": None,
        "destination": "Testville",
        "requirements": TripRequirements(destination="Testville", days=2, people=1, interests=[]),
        "weather": None,
        "budget": None,
        "accommodation": [],
    }

    with patch("app.agents.orchestrator.generate_itinerary", side_effect=fake_generate_itinerary):
        itinerary_node(state)

    assert captured["req"].activities_budget is None
    assert captured["req"].accommodation_lat is None
    assert captured["req"].accommodation_lon is None


def test_itinerary_node_forwards_the_parallel_poi_prefetch():
    """The prefetch exists only to move the slow POI lookup off the critical path, so
    the itinerary node must actually consume it rather than re-fetching."""
    captured = {}

    def fake_generate_itinerary(req: ItineraryRequest, prefetched_pois=None) -> ItineraryResponse:
        captured["prefetched"] = prefetched_pois
        return ItineraryResponse(destination=req.destination, itinerary=[], warnings=[])

    prefetch = {"activities": [], "source": "overpass", "resolved_location": "Testville, Japan"}
    state = {
        "logs": [], "retries": 0, "destination": "Testville",
        "requirements": TripRequirements(destination="Testville", days=2, people=1, interests=[]),
        "weather": None, "budget": None, "accommodation": [],
        "poi_prefetch": prefetch,
    }
    with patch("app.agents.orchestrator.generate_itinerary", side_effect=fake_generate_itinerary):
        itinerary_node(state)

    assert captured["prefetched"] is prefetch
