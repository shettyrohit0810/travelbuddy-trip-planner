import json
import logging
from typing import List
from app.core.config import settings
from app.schemas.itinerary import ItineraryRequest, DailySchedule, ItineraryResponse
from app.tools.destination_search import destination_search

logger = logging.getLogger("app.agents.itinerary")


def _fetch_real_pois(destination: str) -> List[dict]:
    """Real points of interest, used both to ground LLM prompts and to build the
    rule-based fallback schedule. Returns [] (not fake data) if unavailable."""
    try:
        return destination_search(destination).get("activities", [])
    except Exception as e:
        logger.error(f"destination_search failed for {destination!r}: {e}")
        return []


def generate_itinerary(req: ItineraryRequest) -> ItineraryResponse:
    """
    Generate detailed daily itineraries matching days, interests, and weather parameters.
    Uses LLMs if API keys are set (grounded with real nearby points of interest);
    otherwise falls back to rule-based generation.
    """
    real_pois = _fetch_real_pois(req.destination)

    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = _build_grounded_prompt(req, real_pois)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=ItineraryResponse
                )
            )
            data = json.loads(response.text)
            return ItineraryResponse(**data)
        except Exception as e:
            logger.error(f"Gemini itinerary generation failed, falling back: {str(e)}")

    if settings.OPENAI_API_KEY:
        try:
            from app.core.llm import generate_structured_output
            prompt = _build_grounded_prompt(req, real_pois)
            return generate_structured_output(prompt, ItineraryResponse)
        except Exception as e:
            logger.error(f"OpenAI/Groq itinerary generation failed, falling back: {str(e)}")

    # Heuristic fallback matching
    logger.info("Executing rule-based itinerary generation.")
    return rule_based_generate(req, real_pois)


def _build_grounded_prompt(req: ItineraryRequest, real_pois: List[dict]) -> str:
    prompt = f"Generate travel itinerary details for: {req.model_dump_json()}"
    if real_pois:
        names = ", ".join(p["name"] for p in real_pois[:15])
        prompt += (
            f"\n\nGROUNDING: verified real points of interest near {req.destination}: {names}. "
            f"Prefer these real names over invented ones wherever they fit the traveler's interests."
        )
    return prompt


# A high-fidelity local database of top destinations to ensure beautiful, landmark-specific fallbacks
DESTINATION_DATABASE = {
    "goa": {
        "title": "Goa Beach & Culture Retreat",
        "days": [
            {
                "title": "North Goa Beaches & Sunset Forts",
                "morning": "Kick off your day at Fort Aguada, exploring the 17th-century Portuguese lighthouse and panoramic ocean views. Grab a hearty breakfast at Artjuna Garden Cafe in Anjuna.",
                "afternoon": "Head to Calangute and Baga beaches. Sunbathe, enjoy watersports like parasailing, and lunch at Britto's beach shack, sampling fresh Goan butter garlic prawns.",
                "evening": "Stroll through the lively Anjuna Flea Market, then head to Vagator Beach to watch the sunset from the cliffs near Chapora Fort. Dine at Thalassa for Greek vibes by the sea."
            },
            {
                "title": "Heritage of Old Goa & Spice Plantations",
                "morning": "Visit the majestic Basilica of Bom Jesus (holding the mortal remains of St. Francis Xavier) and the stunning Se Cathedral in Old Goa.",
                "afternoon": "Take a guided tour of the Sahakari Spice Farm. Enjoy a traditional Goan buffet lunch served on banana leaves, complete with local feni tasting.",
                "evening": "Head to Panaji (capital city). Walk through Fontainhas, the beautiful Latin Quarter, admiring the colorful Portuguese-style homes. Enjoy dinner at Mum's Kitchen."
            },
            {
                "title": "Waterfalls & Backwater Cruises",
                "morning": "Take an early morning trek/jeep safari to the majestic Dudhsagar Waterfalls, watching the water cascade down four tiers.",
                "afternoon": "Travel back towards Panaji. Enjoy a traditional thali lunch at Ritz Classic, famous for its Goan fish curry thali.",
                "evening": "Board a scenic evening cruise along the Mandovi River with traditional Goan folk dances and music. Relax at a beach shack in Candolim for dinner."
            },
            {
                "title": "South Goa Tranquility & Hidden Coves",
                "morning": "Drive south to the crescent-shaped Palolem Beach. Rent a kayak to explore Monkey Island or take a boat trip to Butterfly Beach.",
                "afternoon": "Relax under the palm trees and have lunch at The Dropadi Restaurant right on Palolem beach, enjoying grilled red snapper.",
                "evening": "Visit the historic Cabo de Rama Fort for breathtaking views of the Arabian Sea. Dine at a cliffside lounge overlooking the waves."
            },
            {
                "title": "Dolphin Spotting & Local Markets",
                "morning": "Embark on an early morning dolphin-spotting boat trip from Sinquerim Beach.",
                "afternoon": "Explore the Mapusa Local Market for local spices, cashews, and handcrafted souvenirs. Eat authentic Goan vindaloo at a local tavern.",
                "evening": "Spend your final evening at Curlies Beach Shack on Anjuna beach. Watch the bonfire, listen to music, and celebrate your trip."
            }
        ]
    },
    "kyoto": {
        "title": "Kyoto Cultural & Temple Exploration",
        "days": [
            {
                "title": "Historic Arashiyama & Golden Pavilions",
                "morning": "Arrive early at the Arashiyama Bamboo Grove. Walk through the towering green stalks before the crowds arrive. Visit the historic Tenryu-ji Temple.",
                "afternoon": "Cross the Togetsukyo Bridge, then travel to the iconic Kinkaku-ji (The Golden Pavilion), reflecting beautifully over its mirror pond.",
                "evening": "Stroll down the historic Pontocho Alley, a narrow street lined with traditional wooden buildings and lanterns. Dine on authentic Kyoto-style ramen or yakitori."
            },
            {
                "title": "Torii Gates & Traditional Tea Ceremonies",
                "morning": "Hike through the thousands of vibrant vermilion torii gates at Fushimi Inari-taisha Shrine. Reach the Yotsutsuji intersection for views of Kyoto.",
                "afternoon": "Walk through the historic Higashiyama District. Stop for a traditional matcha green tea ceremony at a local teahouse near Kodai-ji Temple.",
                "evening": "Explore the famous Kiyomizu-dera Temple, standing on its wooden stage overlooking Cherry blossoms/maples. Eat a multi-course Kaiseki dinner in Gion."
            },
            {
                "title": "Imperial Heritage & Zen Gardens",
                "morning": "Tour the expansive grounds of the Kyoto Imperial Palace and the historic Nijo Castle, famous for its 'nightingale' squeaking floors.",
                "afternoon": "Visit the tranquil rock Zen garden at Ryoan-ji Temple. Enjoy a peaceful vegetarian tofu lunch (Yudofu) nearby.",
                "evening": "Walk along the Philosopher's Path, following a stone trail lined with canals and cherry trees. Dinner at a boutique sushi bar near Sanjo."
            },
            {
                "title": "Nishiki Market & Modern Kyoto",
                "morning": "Visit the beautiful Heian Shrine with its massive red torii gate and landscaped gardens.",
                "afternoon": "Dive into the bustling Nishiki Market, tasting local street food like octopus skewers, tamagoyaki, and matcha ice cream.",
                "evening": "Visit the modern Kyoto Tower for a 360-degree view of the city skyline. Enjoy dinner at a high-end teppanyaki restaurant."
            },
            {
                "title": "Uji Tea Fields or Nara Day Trip",
                "morning": "Take a short train ride to Nara Park to feed the friendly bowing sika deer and see the Giant Buddha at Todai-ji Temple.",
                "afternoon": "Walk through Naramachi, the old merchant district, and enjoy a traditional bento box lunch.",
                "evening": "Return to Kyoto. Spend your final night shopping at Kawaramachi and enjoying craft sake at a cozy local izakaya."
            }
        ]
    },
    "jaipur": {
        "title": "Jaipur Royal Heritage Tour",
        "days": [
            {
                "title": "Forts & Palaces of Amber",
                "morning": "Explore the majestic Amber Fort, marveling at the intricate Sheesh Mahal (Mirror Palace). Stop at Jal Mahal (Water Palace) for photographs on your way back.",
                "afternoon": "Visit the iconic Hawa Mahal (Palace of Winds). Walk across to the grand City Palace complex and see the royal royal museum. Lunch at The Verandah.",
                "evening": "Explore the astronomical wonders at Jantar Mantar observatory. Walk through the Johri Bazar for traditional jewelry and textiles, followed by dinner at Peacock Rooftop Restaurant."
            },
            {
                "title": "Royal Fort Views & Traditional Dining",
                "morning": "Trek up to Nahargarh Fort for a breathtaking panoramic view of the Pink City. Walk through Jaigarh Fort to see the world's largest cannon on wheels.",
                "afternoon": "Savor authentic Rajasthani Pyaz Kachori at Rawat Mishtan Bhandar. Visit the Albert Hall Museum to admire colonial-era arts.",
                "evening": "Experience Rajasthani village culture, folk dances, and an unlimited traditional Rajasthani thali at the famous Chokhi Dhani ethnic resort."
            },
            {
                "title": "Artisans & Blue Pottery",
                "morning": "Take a trip to Sanganer village to watch local artisans perform traditional block printing and handmade paper making.",
                "afternoon": "Visit the Anokhi Museum of Hand Printing. Enjoy a multi-cuisine lunch at Cafe Palladio, decorated in stunning blue and white motifs.",
                "evening": "Shop for exquisite Jaipur Blue Pottery. Relax with a sunset view and drinks at the rooftop lounge of Fort Jaipur."
            }
        ]
    },
    "paris": {
        "title": "Parisian Art & Romance Itinerary",
        "days": [
            {
                "title": "Eiffel Tower & Seine Cruise",
                "morning": "Arrive early at the Champ de Mars to ascend the iconic Eiffel Tower for panoramic city views. Walk across the Pont d'Iéna.",
                "afternoon": "Stroll down the famous Avenue des Champs-Élysées. Stop for delicious macarons at Ladurée and admire the Arc de Triomphe.",
                "evening": "Embark on a romantic sunset cruise along the River Seine. Dine at a classic French bistro in the Saint-Germain-des-Prés neighborhood."
            },
            {
                "title": "Louvre Masterpieces & Bohemian Montmartre",
                "morning": "Spend your morning admiring the Mona Lisa and Venus de Milo in the world-famous Louvre Museum.",
                "afternoon": "Walk through the beautiful Tuileries Garden. Grab a lunch crepe at a local street stand, then climb the hill of Montmartre.",
                "evening": "Visit the white-domed Sacré-Cœur Basilica. Walk through the Place du Tertre to see portrait artists, and enjoy dinner in bohemian Montmartre."
            },
            {
                "title": "Notre-Dame & Latin Quarter",
                "morning": "Explore the historic Île de la Cité, seeing the exterior of Notre-Dame Cathedral and the breathtaking stained glass of Sainte-Chapelle.",
                "afternoon": "Cross into the lively Latin Quarter. Explore the Shakespeare and Company bookstore and enjoy a French onion soup lunch.",
                "evening": "Relax in the beautiful Luxembourg Gardens. Enjoy a candle-lit dinner with French wine at a cozy restaurant in the Marais district."
            }
        ]
    }
}

def rule_based_generate(req: ItineraryRequest, real_pois: List[dict] = None) -> ItineraryResponse:
    """
    Generates daily morning, afternoon, and evening slots.
    If the destination matches our curated database, returns that hand-authored plan.
    Otherwise builds the schedule from real_pois (destination_search results) when
    available, and only falls back to generic unnamed templates if no real data
    could be fetched (no API key, unresolvable location, etc).
    """
    dest = req.destination
    days = req.days or 5
    dest_key = dest.lower().strip()
    
    # 1. Match against our rich local database
    matched_db = None
    for key, data in DESTINATION_DATABASE.items():
        if key in dest_key:
            matched_db = data
            break
            
    if matched_db:
        logger.info(f"High-fidelity rule-based matched for: {dest}")
        schedule = []
        db_days = matched_db["days"]
        
        for day in range(1, days + 1):
            # Loop around if the request is longer than the mock database
            db_day = db_days[(day - 1) % len(db_days)]
            schedule.append(
                DailySchedule(
                    day=day,
                    title=f"Day {day}: {db_day['title']}",
                    morning=db_day["morning"],
                    afternoon=db_day["afternoon"],
                    evening=db_day["evening"],
                    why_selected_rationale="Highly rated highlight recommended by local travel vlogs."
                )
            )
        return ItineraryResponse(
            destination=dest,
            itinerary=schedule
        )

    # 2. Real points-of-interest, if destination_search returned any (see .env.example
    # for OPENTRIPMAP_API_KEY) — grounds the schedule in real named attractions instead
    # of generic filler text.
    if real_pois:
        logger.info(f"Building rule-based itinerary for {dest} from {len(real_pois)} real POIs")
        schedule = []
        for day in range(1, days + 1):
            picks = [real_pois[((day - 1) * 3 + i) % len(real_pois)]["name"] for i in range(3)]
            morning, afternoon, evening = picks
            schedule.append(
                DailySchedule(
                    day=day,
                    morning=f"Visit {morning}.",
                    afternoon=f"Visit {afternoon}, then take a break at a nearby local cafe.",
                    evening=f"Wind down at {evening}, or explore the surrounding neighborhood for dinner."
                )
            )
        return ItineraryResponse(
            destination=dest,
            itinerary=schedule
        )

    # 3. Generic template generator — last resort when there's no curated entry and no
    # real POI data (missing OPENTRIPMAP_API_KEY or an unresolvable location). Kept
    # deliberately vague/unnamed rather than inventing specific place names.
    logger.info(f"Executing generic rule-based generator for unknown destination: {dest}")
    schedule = []

    # Famous fallback activity templates
    morning_activities = [
        "Arrive early at the central historic square to admire the local architecture and take photos before crowds arrive.",
        "Take a guided walking tour of the famous city center, exploring historic side streets and hidden courtyards.",
        "Visit the prominent regional museum and art gallery, showcasing local heritage and historical artifacts.",
        "Embark on a scenic morning hike to the top local viewpoint or public hilltop park overlooking the cityscape.",
        "Explore the beautiful local botanical gardens and glasshouses, enjoying the fresh morning air."
    ]
    
    afternoon_activities = [
        "Head to a highly recommended local market hall. Try regional specialty dishes and fresh local street food.",
        "Enjoy a leisure lunch at a popular traditional bistro, sampling the region's signature dishes.",
        "Stroll through the lively shopping district, stopping at independent craft boutiques and specialty cafes.",
        "Take a scenic boat cruise along the local river or bay, enjoying a relaxing afternoon on the water.",
        "Participate in a local cooking workshop or craft masterclass, learning authentic regional techniques."
    ]
    
    evening_activities = [
        "Stroll along the lively waterfront promenade or central boardwalk to watch a beautiful sunset.",
        "Visit the trendy arts district, checking out local galleries, street performances, and boutique bars.",
        "Enjoy a wonderful dinner at a top-rated traditional restaurant, followed by a cozy drink at a historic tavern.",
        "Check out a live local music performance or cultural show in the historic theater district.",
        "Relax at a popular rooftop terrace cafe, enjoying panoramic night views of the illuminated city."
    ]
    
    for day in range(1, days + 1):
        m_act = morning_activities[(day - 1) % len(morning_activities)]
        a_act = afternoon_activities[(day - 1) % len(afternoon_activities)]
        e_act = evening_activities[(day - 1) % len(evening_activities)]
        
        schedule.append(
            DailySchedule(
                day=day,
                title=f"Day {day}: Exploring {dest} Sights",
                morning=f"Morning: {m_act} Enjoy breakfast at a highly rated local cafe nearby.",
                afternoon=f"Afternoon: {a_act} Sample local desserts and coffee during a relaxing mid-day break.",
                evening=f"Evening: {e_act} Take a leisurely stroll through the illuminated streets as the city comes alive.",
                why_selected_rationale=f"Structured based on top travel vlog reviews for optimal sightseeing in {dest}."
            )
        )
        
    return ItineraryResponse(
        destination=dest,
        itinerary=schedule
    )

