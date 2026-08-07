from pydantic import BaseModel, Field
from typing import List, Optional


class ItineraryRequest(BaseModel):
    destination: str = Field(..., description="Target destination for the itinerary")
    days: int = Field(..., ge=1, le=30, description="Number of days for the trip")
    interests: List[str] = Field(default_factory=list, description="User interests for sightseeing filters")
    weather_score: Optional[int] = Field(default=None, description="Travel weather suitability score")
    activities_budget: Optional[float] = Field(default=None, description="Total budget available for activities across the whole trip")
    accommodation_lat: Optional[float] = Field(default=None, description="Latitude of the recommended accommodation, if known")
    accommodation_lon: Optional[float] = Field(default=None, description="Longitude of the recommended accommodation, if known")


class ScheduledSlotOut(BaseModel):
    name: str = Field(..., description="Real attraction name, traceable to the source API call")
    category: str = Field(..., description="Attraction category")
    source: str = Field(..., description="Which tool/API this fact came from, e.g. 'opentripmap'")
    start_time: str = Field(..., description="Scheduled start time, HH:MM 24h")
    end_time: str = Field(..., description="Scheduled end time, HH:MM 24h")
    travel_minutes_from_previous: float = Field(..., description="Estimated travel time from the previous stop")
    estimated_cost: float = Field(..., description="Heuristic per-visit cost estimate")


class DailySchedule(BaseModel):
    day: int = Field(..., description="Day number of the trip (1-indexed)")
    morning: str = Field(..., description="Morning activity description")
    afternoon: str = Field(..., description="Afternoon activity description")
    evening: str = Field(..., description="Evening activity description")
    slots: List[ScheduledSlotOut] = Field(default_factory=list, description="Structured, traceable schedule for the day, in order")


class ItineraryResponse(BaseModel):
    destination: str = Field(..., description="Name of the destination")
    itinerary: List[DailySchedule]
    warnings: List[str] = Field(default_factory=list, description="Constraint issues the scheduler could not fully resolve")


class DayNarration(BaseModel):
    day: int = Field(..., description="Day number this narration is for")
    morning: str
    afternoon: str
    evening: str


class NarrationResponse(BaseModel):
    days: List[DayNarration]
