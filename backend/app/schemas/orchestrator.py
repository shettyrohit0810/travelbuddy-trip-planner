from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.understanding import TripRequirements
from app.schemas.weather import WeatherIntelligence
from app.schemas.transport import TransportOption
from app.schemas.accommodation import AccommodationOption
from app.schemas.budget import BudgetBreakdown
from app.schemas.itinerary import ItineraryResponse

from app.schemas.planner import FinalTripPlan

class OrchestratorRequest(BaseModel):
    query: str = Field(..., description="Natural language request detailing the desired trip")
    source_city: Optional[str] = Field(default="Mumbai", description="Starting location/departure city")

class OrchestratorResponse(BaseModel):
    requirements: Optional[TripRequirements] = None
    destination: Optional[str] = None
    weather: Optional[WeatherIntelligence] = None
    transport: List[TransportOption] = Field(default_factory=list)
    accommodation: List[AccommodationOption] = Field(default_factory=list)
    budget: Optional[BudgetBreakdown] = None
    itinerary: Optional[ItineraryResponse] = None
    plan: Optional[FinalTripPlan] = None
    logs: List[str] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None
