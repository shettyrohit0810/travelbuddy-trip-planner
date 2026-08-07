from unittest.mock import patch

from app.schemas.accommodation import AccommodationRequest
from app.agents.accommodation import rule_based_recommend


MOCK_HOTEL_DATA = {
    "hotels": [
        {"name": "Real Hotel", "price_per_night": 150.0, "rating": 4.5, "amenities": ["WiFi"], "lat": 35.5, "lon": 135.5},
    ]
}


@patch("app.agents.accommodation.hotel_search", return_value=MOCK_HOTEL_DATA)
def test_rule_based_recommend_carries_coordinates_through(mock_hotel_search):
    req = AccommodationRequest(location="Testville")
    results = rule_based_recommend(req)

    assert len(results) == 1
    assert results[0].lat == 35.5
    assert results[0].lon == 135.5
