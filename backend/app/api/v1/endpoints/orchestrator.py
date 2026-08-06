from fastapi import APIRouter, HTTPException, Depends
from app.agents.orchestrator import plan_trip_workflow
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.orchestrator import OrchestratorRequest, OrchestratorResponse

router = APIRouter()

@router.post("/plan", response_model=OrchestratorResponse)
def plan_trip(
    payload: OrchestratorRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Triggers the complete LangGraph multi-agent orchestrator workflow.
    Funnels trip requirements, weather forecasts, transit routing, hotel options,
    budget details, and daily schedule suggestions.
    """
    try:
        result = plan_trip_workflow(
            query=payload.query,
            source_city=payload.source_city,
            user_id=current_user.id
        )
        return OrchestratorResponse(
            requirements=result.get("requirements"),
            destination=result.get("destination"),
            weather=result.get("weather"),
            transport=result.get("transport", []),
            accommodation=result.get("accommodation", []),
            budget=result.get("budget"),
            itinerary=result.get("itinerary"),
            plan=result.get("plan"),
            logs=result.get("logs", []),
            success=True
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orchestrator execution failed: {str(e)}")
