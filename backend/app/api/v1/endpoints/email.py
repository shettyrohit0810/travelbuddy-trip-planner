from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.trip import Trip
from app.models.user import User
from app.core.email import send_trip_email_background

router = APIRouter()

class EmailSendRequest(BaseModel):
    email: str = Field(..., example="user@example.com")

@router.post("/{id}/email")
def send_trip_email(
    id: int,
    payload: EmailSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sends trip plan PDF/itinerary/budget summary via email.
    Runs asynchronously via BackgroundTasks.
    """
    trip = db.query(Trip).filter(Trip.id == id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip record not found")
        
    # Extract summary and total budget from plan_data
    summary = "Here is your compiled trip plan itinerary & budget breakdown details."
    budget_total = 0.0
    
    plan_data = trip.plan_data or {}
    if isinstance(plan_data, dict):
        summary = plan_data.get("executive_summary") or plan_data.get("summary") or summary
        budget_summary = plan_data.get("budget_summary") or {}
        if isinstance(budget_summary, dict):
            budget_total = budget_summary.get("total") or 0.0
            
    background_tasks.add_task(
        send_trip_email_background,
        email=payload.email,
        destination=trip.destination,
        summary=summary,
        budget_total=float(budget_total),
        itinerary_days=trip.days,
        pdf_attached=True
    )
    
    return {"success": True, "message": "Trip plan email dispatch scheduled in background"}
