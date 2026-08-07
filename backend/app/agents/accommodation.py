import json
import logging
from typing import List
from app.core.config import settings
from app.schemas.accommodation import AccommodationRequest, AccommodationOption, AccommodationResponse
from app.tools.hotel_search import hotel_search

logger = logging.getLogger("app.agents.accommodation")

def recommend_accommodation(req: AccommodationRequest) -> List[AccommodationOption]:
    """
    Formulate accommodation recommendations.
    Uses LLMs if API keys are set; otherwise, calls hotel_search and processes filters.
    """
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = (
                f"Recommend accommodations for: {req.model_dump_json()}.\n"
                f"IMPORTANT: You MUST plan, calculate, and provide all prices in Indian Rupees (INR, ₹). "
                f"Ensure the price values are realistic Indian Rupee amounts for hotels (e.g., between ₹1500 and ₹25000+ per night)."
            )
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=AccommodationResponse
                )
            )
            data = json.loads(response.text)
            return [AccommodationOption(**acc) for acc in data.get("accommodations", [])]
        except Exception as e:
            logger.error(f"Gemini accommodation recommendation failed, falling back: {str(e)}")

    if settings.OPENAI_API_KEY:
        try:
            from app.core.llm import generate_structured_output
            prompt = (
                f"Recommend accommodations for: {req.model_dump_json()}.\n"
                f"IMPORTANT: You MUST plan, calculate, and provide all prices in Indian Rupees (INR, ₹). "
                f"Ensure the price values are realistic Indian Rupee amounts for hotels (e.g., between ₹1500 and ₹25000+ per night)."
            )
            result = generate_structured_output(prompt, AccommodationResponse)
            return result.accommodations
        except Exception as e:
            logger.error(f"OpenAI/Groq accommodation recommendation failed, falling back: {str(e)}")

    # Heuristic fallback: query hotel_search directly
    logger.info("Executing rule-based accommodation recommendation.")
    return rule_based_recommend(req)


def rule_based_recommend(req: AccommodationRequest) -> List[AccommodationOption]:
    """
    Queries hotel_search and filters by budget, rating, and amenity preferences.
    """
    # NOTE: AccommodationRequest has no check-in/check-out dates today, so these are
    # placeholder dates rather than the traveler's real ones — hotel_search still
    # returns real Amadeus availability/pricing for *some* valid date range, but not
    # necessarily the trip's actual dates. Threading real dates through requires
    # widening AccommodationRequest and the orchestrator's state; out of scope for
    # this pass (see DECISIONS.md).
    raw_data = hotel_search(location=req.location, check_in="2026-10-01", check_out="2026-10-08", budget=req.budget)
    hotels = raw_data.get("hotels", [])

    results = []
    preferred_amenities = [a.lower() for a in req.amenities]

    for h in hotels:
        name = h["name"]
        price = h["price_per_night"]
        rating = h["rating"]
        amenities = [a.lower() for a in h.get("amenities", [])]

        # 1. Filter by budget
        if req.budget is not None and price > req.budget:
            continue

        # 2. Filter by minimum rating
        if req.min_rating is not None and rating < req.min_rating:
            continue

        # 3. Score based on matching amenities
        match_count = 0
        if preferred_amenities:
            match_count = sum(1 for a in preferred_amenities if a in amenities)

        results.append({
            "option": AccommodationOption(
                hotel=name,
                price=price,
                rating=rating,
                lat=h.get("lat"),
                lon=h.get("lon"),
            ),
            "match_count": match_count
        })

    # Sort primarily by matching amenities descending, and then by rating descending
    results.sort(key=lambda x: (x["match_count"], x["option"].rating), reverse=True)

    return [r["option"] for r in results]
