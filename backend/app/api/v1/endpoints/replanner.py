from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripResponse
from app.agents.orchestrator import plan_trip_workflow
from app.schemas.understanding import TripRequirements

router = APIRouter()

class ReplanRequest(BaseModel):
    replan_type: str = Field(..., description="Type of replanning: 'budget', 'weather', or 'itinerary'")
    budget_override: Optional[float] = Field(default=None, description="New total budget override")
    destination_override: Optional[str] = Field(default=None, description="New destination override")
    closed_attraction: Optional[str] = Field(default=None, description="Attraction that is closed and needs replacement")

@router.post("/{id}/replan-selective", response_model=TripResponse)
def replan_trip_selective(
    id: int,
    payload: ReplanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Selectively replans only the affected sections of an existing trip plan.
    """
    trip = db.query(Trip).filter(Trip.id == id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip record not found")

    try:
        plan_data = trip.plan_data or {}
        if not isinstance(plan_data, dict):
            plan_data = {}
            
        # Reconstruct existing state
        destination = payload.destination_override or plan_data.get("destination") or trip.destination
        days = plan_data.get("days") or trip.days
        travelers = plan_data.get("travelers") or trip.travelers
        
        # Build requirements
        reqs = TripRequirements(
            destination=destination,
            days=days,
            people=travelers,
            budget=payload.budget_override if payload.budget_override is not None else (plan_data.get("budget_summary", {}).get("total") if plan_data.get("budget_summary") else None),
            trip_type=None,
            dates=None,
            interests=[],
            accommodation_preferences=None
        )
        
        existing_state = {
            "requirements": reqs,
            "destination": destination,
            "weather": plan_data.get("weather_analysis"),
            "transport": [plan_data.get("transport_recommendation")] if plan_data.get("transport_recommendation") else [],
            "accommodation": [plan_data.get("hotel_recommendation")] if plan_data.get("hotel_recommendation") else [],
            "budget": plan_data.get("budget_summary"),
            "itinerary": plan_data.get("day_wise_itinerary"),
            "plan": None,
            "logs": [],
            "retries": 0
        }
        
        # Construct dynamic prompt for the graph
        query_prompt = f"Plan trip to {destination} for {days} days, budget: {reqs.budget}."
        if payload.closed_attraction:
            query_prompt += f" Note: Attraction '{payload.closed_attraction}' is closed, please suggest alternatives."
            # Clear itinerary in state to force regeneration with alternatives
            existing_state["itinerary"] = None
            
        if payload.destination_override:
            # Clear destination-dependent state so they must be updated
            existing_state["weather"] = None
            existing_state["transport"] = []
            existing_state["accommodation"] = []
            existing_state["budget"] = None
            existing_state["itinerary"] = None
            
        result = plan_trip_workflow(
            query=query_prompt,
            user_id=trip.user_id,
            replan_type=payload.replan_type,
            existing_state=existing_state
        )
        
        # Save new plan (handling Pydantic serialization)
        plan_obj = result.get("plan")
        if plan_obj and hasattr(plan_obj, "model_dump"):
            trip.plan_data = plan_obj.model_dump()
        elif plan_obj and hasattr(plan_obj, "dict"):
            trip.plan_data = plan_obj.dict()
        else:
            trip.plan_data = plan_obj
            
        if payload.destination_override:
            trip.destination = payload.destination_override
            
        db.commit()
        db.refresh(trip)
        return trip
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to selectively replan trip: {str(e)}")
