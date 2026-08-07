from pydantic import BaseModel, Field
from typing import List, Optional

class AccommodationRequest(BaseModel):
    location: str = Field(..., description="The city or area to find accommodations in")
    budget: Optional[float] = Field(default=None, description="Maximum budget price per night")
    min_rating: Optional[float] = Field(default=None, description="Minimum acceptable guest rating (e.g. 4.0)")
    amenities: List[str] = Field(default_factory=list, description="Preferred amenities list (e.g. 'WiFi', 'Pool')")

class AccommodationOption(BaseModel):
    hotel: str = Field(..., description="Name of the accommodation")
    price: float = Field(..., description="Price per night")
    rating: float = Field(..., description="Guest rating out of 5")
    lat: Optional[float] = Field(default=None, description="Latitude, when known from a real API")
    lon: Optional[float] = Field(default=None, description="Longitude, when known from a real API")

class AccommodationResponse(BaseModel):
    accommodations: List[AccommodationOption]
