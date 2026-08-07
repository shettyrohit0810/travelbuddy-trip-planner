from unittest.mock import patch

from app.tools.hotel_search import hotel_search


MOCK_OFFERS_RESPONSE = {
    "data": [
        {
            "hotel": {"name": "Real Hotel", "latitude": 35.5, "longitude": 135.5, "rating": "4"},
            "offers": [{"price": {"total": "150.00", "currency": "USD"}}],
        }
    ]
}


@patch("app.tools.hotel_search.get_json")
@patch("app.tools.hotel_search._get_access_token", return_value="fake-token")
def test_hotel_search_captures_hotel_coordinates(mock_token, mock_get_json):
    mock_get_json.side_effect = [
        {"data": [{"iataCode": "TST"}]},
        {"data": [{"hotelId": "H1"}]},
        MOCK_OFFERS_RESPONSE,
    ]

    # _resolve_city_code is ALSO independently @ttl_cache-decorated -- same reasoning
    # as _geocode in test_destination_search.py, clear it too so a stale cached city
    # code from an earlier test run can't mask this test's mocked responses.
    from app.tools.hotel_search import _resolve_city_code
    hotel_search.cache_clear()
    _resolve_city_code.cache_clear()
    result = hotel_search("Testville", "2026-10-01", "2026-10-08")

    assert result["results_count"] == 1
    hotel = result["hotels"][0]
    assert hotel["lat"] == 35.5
    assert hotel["lon"] == 135.5
