from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, auth, users, understanding, recommendation,
    weather, transport, accommodation, itinerary, orchestrator, memory, trips,
    email, replanner, travel_intelligence, ai_chat
)

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(understanding.router, prefix="/understanding", tags=["understanding"])
api_router.include_router(recommendation.router, prefix="/recommendation", tags=["recommendation"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(transport.router, prefix="/transport", tags=["transport"])
api_router.include_router(accommodation.router, prefix="/accommodation", tags=["accommodation"])
api_router.include_router(itinerary.router, prefix="/itinerary", tags=["itinerary"])
api_router.include_router(orchestrator.router, prefix="/orchestrator", tags=["orchestrator"])
api_router.include_router(travel_intelligence.router, prefix="/orchestrator", tags=["orchestrator"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(email.router, prefix="/trips", tags=["trips"])
api_router.include_router(replanner.router, prefix="/trips", tags=["trips"])
api_router.include_router(ai_chat.router, prefix="/ai", tags=["ai-chat"])









