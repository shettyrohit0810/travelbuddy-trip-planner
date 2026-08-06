from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import math

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripSave, TripUpdate, TripResponse, TripListResponse
from app.agents.orchestrator import plan_trip_workflow

router = APIRouter()


def _get_owned_trip(id: int, current_user: User, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip record not found")
    return trip


@router.post("", response_model=TripResponse)
def save_trip(
    payload: TripSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a compiled trip plan to user history.
    """
    try:
        db_trip = Trip(
            user_id=current_user.id,
            destination=payload.destination,
            days=payload.days,
            travelers=payload.travelers,
            plan_data=payload.plan_data,
            is_favorite=False
        )
        db.add(db_trip)
        db.commit()
        db.refresh(db_trip)
        return db_trip
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

@router.get("", response_model=TripListResponse)
def list_trips(
    page: int = 1,
    limit: int = 5,
    query: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List user trips with search, favorite filters, and pagination.
    """
    try:
        q = db.query(Trip).filter(Trip.user_id == current_user.id)
        
        # Apply search filter
        if query:
            q = q.filter(Trip.destination.ilike(f"%{query}%"))
            
        # Apply favorite filter
        if is_favorite is not None:
            q = q.filter(Trip.is_favorite == is_favorite)
            
        # Total counts
        total = q.count()
        pages = math.ceil(total / limit) if total > 0 else 1
        
        # Pagination offsets
        offset = (page - 1) * limit
        trips = q.order_by(Trip.created_at.desc()).offset(offset).limit(limit).all()
        
        return TripListResponse(
            trips=trips,
            total=total,
            page=page,
            pages=pages,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list history: {str(e)}")

@router.get("/{id}", response_model=TripResponse)
def get_trip(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve details of a single trip.
    """
    return _get_owned_trip(id, current_user, db)

@router.put("/{id}", response_model=TripResponse)
def update_trip(
    id: int,
    payload: TripUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle favorites flag or update details.
    """
    trip = _get_owned_trip(id, current_user, db)

    try:
        if payload.is_favorite is not None:
            trip.is_favorite = payload.is_favorite
        db.commit()
        db.refresh(trip)
        return trip
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update trip: {str(e)}")

@router.delete("/{id}")
def delete_trip(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a trip from history.
    """
    trip = _get_owned_trip(id, current_user, db)

    try:
        db.delete(trip)
        db.commit()
        return {"success": True, "message": "Trip deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete trip: {str(e)}")

@router.post("/{id}/replan", response_model=TripResponse)
def replan_trip(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Replan an existing trip by running the agent orchestrator graph.
    """
    trip = _get_owned_trip(id, current_user, db)

    try:
        # Re-run the planning graph using stored configurations
        query_prompt = f"Plan a trip to {trip.destination} for {trip.days} days and {trip.travelers} travelers"
        result = plan_trip_workflow(query=query_prompt, user_id=trip.user_id)
        
        # Save the new plan (handling Pydantic serialization)
        plan_obj = result.get("plan")
        if plan_obj and hasattr(plan_obj, "model_dump"):
            trip.plan_data = plan_obj.model_dump()
        elif plan_obj and hasattr(plan_obj, "dict"):
            trip.plan_data = plan_obj.dict()
        else:
            trip.plan_data = plan_obj
            
        db.commit()
        db.refresh(trip)
        return trip
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to replan trip: {str(e)}")
