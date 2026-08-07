import re
import json
import logging
from typing import Optional
from app.core.config import settings
from app.schemas.understanding import TripRequirements

logger = logging.getLogger("app.agents.understanding")

def parse_trip_request(query: str) -> TripRequirements:
    """
    Parse a natural language query into structured trip requirements.
    Uses Gemini or OpenAI structured output if keys are present; otherwise,
    falls back to a rule-based parsing engine.
    """
    # 1. Attempt Gemini structured output
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = f"Extract trip requirements from this query: \"{query}\""
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=TripRequirements
                )
            )
            
            data = json.loads(response.text)
            return TripRequirements(**data)
        except Exception as e:
            logger.error(f"Gemini structured parse failed, falling back: {str(e)}")

    # 2. Attempt OpenAI/Groq structured output
    if settings.OPENAI_API_KEY:
        try:
            from app.core.llm import generate_structured_output
            prompt = f"Extract trip requirements from this query: \"{query}\""
            return generate_structured_output(prompt, TripRequirements)
        except Exception as e:
            logger.error(f"OpenAI/Groq structured parse failed, falling back: {str(e)}")

    # 3. Rule-based Fallback Extraction
    logger.info("Executing rule-based fallback parser.")
    return rule_based_parse(query)


def rule_based_parse(query: str) -> TripRequirements:
    """
    Heuristics-based fallback extraction matching common travel query patterns.
    """
    q = query.lower()

    # Destination Extraction
    destination = "Unknown"
    # Basic matches: "Goa trip", "to Paris", "in London", "Kyoto tour"
    dest_matches = re.findall(r'(?:to|in|at|visit|plan a)\s+([a-zA-Z\s]+?)(?:\s+trip|\s+tour|\s+for|\s+under|\s+budget|\s+days|\s+holiday|$)', q)
    if dest_matches:
        destination = dest_matches[0].strip().title()
    else:
        # Fallback keyword match
        for word in ["goa", "paris", "kyoto", "tokyo", "hawaii", "london", "mumbai"]:
            if word in q:
                destination = word.title()
                break

    # Duration/Days Extraction
    days = None
    days_match = re.search(r'(\d+)\s*-?\s*day', q)
    if days_match:
        days = int(days_match.group(1))

    # Traveler/People Extraction
    people = 1
    people_match = re.search(r'(\d+)\s*(?:people|friends|travelers|members|persons|person)', q)
    if people_match:
        people = int(people_match.group(1))
    elif "couple" in q or "romantic" in q:
        people = 2
    elif "solo" in q:
        people = 1

    # Budget Extraction
    budget = None
    # Matches: under 40000, Rs. 50000, $3000, "budget of 16000", "budget of rs 8000".
    # The optional "of" and trailing currency word matter more than they look: without
    # them a perfectly ordinary phrasing ("with a budget of 16000") parses to no budget
    # at all, which silently disables the hard budget constraint downstream.
    budget_match = re.search(
        r'(?:under|budget|rs\.?|inr|₹|\$)\s*(?:of\s+)?(?:rs\.?|inr|₹|\$)?\s*([\d,]+)', q
    )
    if budget_match:
        # Clean currency separators
        cleaned_num = budget_match.group(1).replace(",", "")
        budget = float(cleaned_num)

    # Trip Type
    trip_type = "solo"
    if "friends" in q:
        trip_type = "friends"
    elif "couple" in q or "romantic" in q or "honeymoon" in q or "wife" in q or "husband" in q:
        trip_type = "romantic"
    elif "family" in q or "kids" in q or "parents" in q:
        trip_type = "family"
    elif "business" in q or "conference" in q or "work" in q:
        trip_type = "business"
    elif people > 1:
        trip_type = "group"

    # Dates
    dates = None
    months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "dec", "jan", "oct"]
    for m in months:
        if m in q:
            dates = m.title()
            break
    if "next week" in q:
        dates = "Next Week"
    elif "tomorrow" in q:
        dates = "Tomorrow"

    # Accommodation preferences
    accommodation = None
    for acc in ["hostel", "resort", "hotel", "villa", "homestay", "camp"]:
        if acc in q:
            accommodation = acc.title()
            break

    # Interests
    interests = []
    interest_keywords = {
        "beach": ["beach", "beaches", "scuba", "sea", "sand"],
        "culture": ["temple", "temples", "museum", "history", "historical", "culture"],
        "nightlife": ["club", "clubs", "party", "bars", "pub", "nightlife"],
        "nature": ["trekking", "mountain", "mountains", "nature", "forest", "hiking"],
        "shopping": ["market", "markets", "shopping", "bazaar"]
    }
    for category, keywords in interest_keywords.items():
        if any(kw in q for kw in keywords):
            interests.append(category)

    return TripRequirements(
        destination=destination,
        days=days,
        people=people,
        budget=budget,
        trip_type=trip_type,
        dates=dates,
        interests=interests,
        accommodation_preferences=accommodation
    )
