import logging
from typing import Optional
from app.core.config import settings
from app.schemas.budget import BudgetBreakdown
from app.tools.budget_estimator import budget_estimator

logger = logging.getLogger("app.agents.budget")

def optimize_budget(
    destination: str,
    days: int,
    travelers: int = 1,
    transport_cost: Optional[float] = None,
    accommodation_cost: Optional[float] = None
) -> BudgetBreakdown:
    """
    Calculate and optimize trip budget.
    Merges actual transport and accommodation inputs if available, falling back
    to budget_estimator's rate-table baseline.
    """
    days = max(days, 1)
    travelers = max(travelers, 1)

    # 1. Fetch baseline estimate
    base_data = budget_estimator(location=destination, days=days, travelers=travelers)
    
    # 2. Extract breakdown components
    # If explicit costs were found in pipeline, override default rates
    final_transport = transport_cost if transport_cost is not None else (1500.0 * travelers)
    final_accommodation = accommodation_cost if accommodation_cost is not None else base_data["breakdown"]["total_accommodation"]
    
    # Allowances based on travelers count and duration
    food_rate = 1000.0  # per person per day (INR scale or similar local scale)
    activity_rate = 800.0  # per person per day
    
    food_cost = food_rate * days * travelers
    activities_cost = activity_rate * days * travelers
    
    subtotal = final_transport + final_accommodation + food_cost + activities_cost
    buffer = subtotal * 0.10  # 10% emergency buffer
    total = subtotal + buffer

    return BudgetBreakdown(
        travel_cost=float(final_transport),
        accommodation_cost=float(final_accommodation),
        food_cost=float(food_cost),
        activities_cost=float(activities_cost),
        buffer=float(buffer),
        total=float(total)
    )
