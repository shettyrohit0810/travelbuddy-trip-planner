from pydantic import BaseModel, Field
from typing import Any, List, Optional
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

class ViolationOut(BaseModel):
    code: str = Field(..., description="Machine-readable violation code, e.g. 'budget_overrun'")
    message: str = Field(..., description="Human-readable explanation of the violation")
    repairable: bool = Field(..., description="Whether the repair loop can act on this")
    overspend_amount: Optional[float] = Field(default=None, description="Amount over the limit, when applicable")


class PlanVerificationOut(BaseModel):
    valid: bool = Field(..., description="True when the plan satisfies every hard constraint")
    violations: List[ViolationOut] = Field(default_factory=list)
    repair_attempts: int = Field(default=0, description="How many repair passes the graph ran")


class TrajectoryStepOut(BaseModel):
    index: int
    kind: str = Field(..., description="tool_call | decision | outcome")
    name: str
    arguments: Optional[dict] = None
    observation: Optional[Any] = Field(default=None, description="What the tool actually returned")
    reasoning: Optional[str] = Field(default=None, description="Why the agent took this step")
    duration_ms: Optional[float] = None
    error: Optional[str] = None


class TrajectoryOut(BaseModel):
    agent: str
    goal: str
    steps: List[TrajectoryStepOut] = Field(default_factory=list)
    outcome: Optional[str] = Field(default=None, description="succeeded | gave_up | budget_exhausted | timeout | error | unavailable")
    summary: Optional[str] = None
    tool_calls_used: int = 0
    tool_call_budget: Optional[int] = None
    wall_clock_ms: Optional[float] = None


class OrchestratorResponse(BaseModel):
    requirements: Optional[TripRequirements] = None
    destination: Optional[str] = None
    weather: Optional[WeatherIntelligence] = None
    transport: List[TransportOption] = Field(default_factory=list)
    accommodation: List[AccommodationOption] = Field(default_factory=list)
    budget: Optional[BudgetBreakdown] = None
    itinerary: Optional[ItineraryResponse] = None
    plan: Optional[FinalTripPlan] = None
    verification: Optional[PlanVerificationOut] = None
    trajectories: List[TrajectoryOut] = Field(default_factory=list, description="Agent traces for this request; empty when no agent was needed")
    logs: List[str] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None
