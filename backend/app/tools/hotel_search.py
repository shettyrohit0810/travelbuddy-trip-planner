import logging
from app.core.config import settings
from app.core.cache import ttl_cache
from app.tools._http import get_json, post_form

logger = logging.getLogger("app.tools.hotel_search")

MAX_HOTELS_QUERIED = 10


def _base_url() -> str:
    return f"https://{settings.AMADEUS_HOSTNAME}"


@ttl_cache(seconds=1500)  # tokens last ~1799s server-side; refresh a bit early
def _get_access_token() -> str | None:
    if not (settings.AMADEUS_API_KEY and settings.AMADEUS_API_SECRET):
        return None
    try:
        resp = post_form(f"{_base_url()}/v1/security/oauth2/token", {
            "grant_type": "client_credentials",
            "client_id": settings.AMADEUS_API_KEY,
            "client_secret": settings.AMADEUS_API_SECRET,
        })
        return resp.get("access_token")
    except Exception as e:
        logger.error(f"Amadeus OAuth2 token request failed: {e}")
        return None


@ttl_cache(seconds=1800)
def _resolve_city_code(token: str, location: str) -> str | None:
    data = get_json(
        f"{_base_url()}/v1/reference-data/locations",
        {"subType": "CITY", "keyword": location, "page[limit]": 1},
        {"Authorization": f"Bearer {token}"},
    )
    results = data.get("data") or []
    return results[0]["iataCode"] if results else None


@ttl_cache(seconds=1800)
def hotel_search(location: str, check_in: str, check_out: str, budget: float | None = None) -> dict:
    """
    Real hotel search via Amadeus for Developers (self-service dev tier). Requires
    AMADEUS_API_KEY / AMADEUS_API_SECRET (see .env.example). Returns an empty hotel
    list (not fake data) if credentials are missing or any step fails.
    """
    token = _get_access_token()
    if not token:
        logger.warning("AMADEUS_API_KEY/AMADEUS_API_SECRET not configured; hotel_search returning no results.")
        return {"location": location, "check_in": check_in, "check_out": check_out, "results_count": 0, "hotels": [], "source": "unavailable"}

    try:
        city_code = _resolve_city_code(token, location)
        if not city_code:
            logger.warning(f"Amadeus city search found no IATA city code for {location!r}")
            return {"location": location, "check_in": check_in, "check_out": check_out, "results_count": 0, "hotels": [], "source": "amadeus"}

        hotel_list = get_json(
            f"{_base_url()}/v1/reference-data/locations/hotels/by-city",
            {"cityCode": city_code},
            {"Authorization": f"Bearer {token}"},
        )
        hotel_entries = (hotel_list.get("data") or [])[:MAX_HOTELS_QUERIED]
        hotel_ids = [h["hotelId"] for h in hotel_entries if h.get("hotelId")]
        if not hotel_ids:
            return {"location": location, "check_in": check_in, "check_out": check_out, "results_count": 0, "hotels": [], "source": "amadeus"}

        offers = get_json(
            f"{_base_url()}/v3/shopping/hotel-offers",
            {"hotelIds": ",".join(hotel_ids), "checkInDate": check_in, "checkOutDate": check_out, "adults": 1},
            {"Authorization": f"Bearer {token}"},
        )
    except Exception as e:
        logger.error(f"Amadeus hotel search failed for {location!r}: {e}")
        return {"location": location, "check_in": check_in, "check_out": check_out, "results_count": 0, "hotels": [], "source": "amadeus"}

    hotels = []
    for entry in offers.get("data") or []:
        hotel_info = entry.get("hotel", {})
        cheapest_offer = min(
            entry.get("offers", []),
            key=lambda o: float(o.get("price", {}).get("total", "inf")),
            default=None,
        )
        if not cheapest_offer:
            continue
        price = float(cheapest_offer["price"]["total"])
        if budget is not None and price > budget:
            continue
        hotels.append({
            "name": hotel_info.get("name", "Unknown Hotel"),
            "price_per_night": price,
            "currency": cheapest_offer["price"].get("currency", "EUR"),
            # Amadeus's hotel-offers response doesn't reliably include a star rating;
            # 0.0 (rather than None) so downstream min_rating filtering doesn't crash.
            "rating": hotel_info.get("rating") or 0.0,
            "amenities": hotel_info.get("amenities", []),
        })

    return {
        "location": location,
        "check_in": check_in,
        "check_out": check_out,
        "results_count": len(hotels),
        "hotels": hotels,
        "source": "amadeus",
    }
