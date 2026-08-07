import logging
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

# Import database session
from app.core.database import SessionLocal
from app.agents.memory import search_user_memory

# Import existing agents
from app.agents.understanding import parse_trip_request
from app.agents.recommendation import get_recommendations
from app.agents.weather import analyze_weather
from app.agents.transport import plan_transport
from app.agents.accommodation import recommend_accommodation
from app.agents.budget import optimize_budget
from app.agents.itinerary import generate_itinerary
from app.agents.planner import compile_final_plan

# Import schemas
from app.schemas.understanding import TripRequirements
from app.schemas.recommendation import RecommendationInput
from app.schemas.weather import WeatherRequest, WeatherIntelligence
from app.schemas.transport import TransportRequest, TransportOption
from app.schemas.accommodation import AccommodationRequest, AccommodationOption
from app.schemas.budget import BudgetBreakdown
from app.schemas.itinerary import ItineraryRequest, ItineraryResponse
from app.schemas.planner import FinalTripPlan
from app.verification.plan_verifier import (
    verify_plan,
    PlanVerification,
    BUDGET_OVERRUN,
    ACTIVITIES_OVERSPEND,
)

logger = logging.getLogger("app.agents.orchestrator")

# How many times the graph may loop verify -> repair -> re-plan before giving up
# and surfacing the unresolved violations instead of spinning. Bounded on purpose:
# an unbounded repair loop is how "agentic" turns into "burns tokens forever".
MAX_REPAIR_ATTEMPTS = 2

# 1. Define Orchestrator Shared State
class OrchestratorState(TypedDict):
    query: str
    source_city: str
    user_id: Optional[int]
    requirements: Optional[TripRequirements]
    destination: Optional[str]
    weather: Optional[WeatherIntelligence]
    transport: List[TransportOption]
    accommodation: List[AccommodationOption]
    budget: Optional[BudgetBreakdown]
    itinerary: Optional[ItineraryResponse]
    plan: Optional[FinalTripPlan]
    logs: List[str]
    retries: int
    replan_type: Optional[str]
    verification: Optional[PlanVerification]
    repair_attempts: int
    repair_exhausted: bool
    budget_baseline: Optional[BudgetBreakdown]

# 2. Define Retry Decorator / Error Recovery Helper
def run_node_with_retry(node_name: str, state: OrchestratorState, func, *args, **kwargs):
    """
    Executes a node function with built-in retry and graceful fallback logging.
    """
    state["logs"].append(f"Starting {node_name} execution...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            state["retries"] += 1
            state["logs"].append(
                f"[Attempt {attempt}/{max_retries}] Error in {node_name}: {str(e)}"
            )
            if attempt == max_retries:
                state["logs"].append(f"Failed {node_name} after {max_retries} attempts. Proceeding with fallback/partial state.")
                raise e

# 3. Define Graph Nodes
def understanding_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    user_id = state.get("user_id")
    
    local_state = {"logs": logs, "retries": retries}
    
    query = state["query"]
    
    # Check if there is long-term memory personalization
    if user_id:
        db = SessionLocal()
        try:
            # Semantic search or retrieve all user memories
            memories = search_user_memory(db, user_id, query_text=query, limit=5)
            if memories:
                local_state["logs"].append(f"Found {len(memories)} personalization memory context(s).")
                prefs = []
                for m in memories:
                    prefs.append(f"{m.memory.category}: {m.memory.content}")
                pref_str = " | ".join(prefs)
                # Inject personalization context to query
                query = f"{query} [Preferences: {pref_str}]"
        except Exception as e:
            local_state["logs"].append(f"Failed loading user memory context: {str(e)}")
        finally:
            db.close()

    reqs = run_node_with_retry(
        "Trip Understanding Agent",
        local_state,
        parse_trip_request,
        query
    )
    
    local_state["logs"].append(f"Trip Understanding completed. Destination extracted: {reqs.destination}")
    return {
        "requirements": reqs,
        "destination": reqs.destination if reqs.destination and reqs.destination != "Unknown" else None,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def destination_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}
    
    reqs = state["requirements"]
    destination = state["destination"]
    
    if not destination:
        local_state["logs"].append("No explicit destination found. Querying Destination Recommendation Agent...")
        rec_input = RecommendationInput(
            budget=reqs.budget,
            interests=reqs.interests,
            traveler_type=reqs.trip_type
        )
        recommendations = run_node_with_retry(
            "Destination Agent",
            local_state,
            get_recommendations,
            rec_input
        )
        if recommendations:
            destination = recommendations[0].destination
            local_state["logs"].append(f"Destination Recommendation Agent selected top choice: {destination}")
        else:
            destination = "Goa"
            local_state["logs"].append(f"No recommendations found. Using fallback destination: {destination}")

    return {
        "destination": destination,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def weather_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}
    
    destination = state["destination"] or "Goa"
    reqs = state["requirements"]
    days = reqs.days if reqs and reqs.days else 5
    
    weather_req = WeatherRequest(location=destination, days=days)
    weather_info = run_node_with_retry(
        "Weather Intelligence Agent",
        local_state,
        analyze_weather,
        weather_req
    )
    
    local_state["logs"].append(f"Weather lookup complete for {destination}. Score: {weather_info.suitability_score}")
    return {
        "weather": weather_info,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def transport_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}
    
    destination = state["destination"] or "Goa"
    source = state["source_city"] or "Mumbai"
    reqs = state["requirements"]
    dates = reqs.dates if reqs and reqs.dates else "2026-10-01"
    
    transport_req = TransportRequest(
        source_city=source,
        destination=destination,
        travel_dates=str(dates)
    )
    
    transport_options = run_node_with_retry(
        "Transport Planning Agent",
        local_state,
        plan_transport,
        transport_req
    )
    
    local_state["logs"].append(f"Transport planning complete. Options found: {len(transport_options)}")
    return {
        "transport": transport_options,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def accommodation_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    user_id = state.get("user_id")
    local_state = {"logs": logs, "retries": retries}
    
    destination = state["destination"] or "Goa"
    reqs = state["requirements"]
    
    budget = reqs.budget if reqs else None
    interests = reqs.interests if reqs else []
    pref = reqs.accommodation_preferences if reqs else None
    
    amenities = []
    if "beach" in [i.lower() for i in interests]:
        amenities.append("Beach Access")
        
    # Personalization: check travel_style memories for style keywords (e.g. WiFi, Pool, Spa)
    if user_id:
        db = SessionLocal()
        try:
            memories = search_user_memory(db, user_id, query_text="accommodation amenities wifi pool spa", category="travel_style", limit=3)
            for m in memories:
                content = m.memory.content.lower()
                for keyword in ["wifi", "pool", "spa", "gym", "bar", "beach access"]:
                    if keyword in content and keyword.title() not in amenities:
                        amenities.append(keyword.title())
        except Exception as e:
            local_state["logs"].append(f"Failed personalized accommodation context: {str(e)}")
        finally:
            db.close()
            
    if pref and pref not in amenities:
        amenities.append(pref)
        
    acc_req = AccommodationRequest(
        location=destination,
        budget=budget,
        min_rating=4.0,
        amenities=amenities
    )
    
    accommodations = run_node_with_retry(
        "Accommodation Agent",
        local_state,
        recommend_accommodation,
        acc_req
    )
    
    local_state["logs"].append(f"Accommodation recommendations complete. Matches found: {len(accommodations)}")
    return {
        "accommodation": accommodations,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def budget_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}
    
    destination = state["destination"] or "Goa"
    reqs = state["requirements"]
    days = reqs.days if reqs and reqs.days else 5
    people = reqs.people if reqs and reqs.people else 1
    
    transport_cost = None
    if state["transport"]:
        transport_cost = state["transport"][0].cost
        
    accommodation_cost = None
    if state["accommodation"]:
        accommodation_cost = state["accommodation"][0].price * days
        
    breakdown = run_node_with_retry(
        "Budget Agent",
        local_state,
        optimize_budget,
        destination=destination,
        days=days,
        travelers=people,
        transport_cost=transport_cost,
        accommodation_cost=accommodation_cost
    )
    
    local_state["logs"].append(f"Budget Optimization Agent completed. Total: {breakdown.total}")
    return {
        "budget": breakdown,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def itinerary_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}
    
    destination = state["destination"] or "Goa"
    reqs = state["requirements"]
    days = reqs.days if reqs and reqs.days else 5
    interests = reqs.interests if reqs else []
    
    weather_score = None
    if state["weather"]:
        weather_score = state["weather"].suitability_score

    # The budget node runs before this one in the graph, so its activities
    # allocation is the hard ceiling the scheduler enforces per trip.
    activities_budget = None
    if state["budget"]:
        activities_budget = state["budget"].activities_cost

    # Days start from the hotel, so the top accommodation pick's real coordinates
    # (when a live API supplied them) anchor the travel-time math.
    accommodation_lat = None
    accommodation_lon = None
    if state["accommodation"]:
        top_pick = state["accommodation"][0]
        accommodation_lat = top_pick.lat
        accommodation_lon = top_pick.lon

    itinerary_req = ItineraryRequest(
        destination=destination,
        days=days,
        interests=interests,
        weather_score=weather_score,
        activities_budget=activities_budget,
        accommodation_lat=accommodation_lat,
        accommodation_lon=accommodation_lon,
    )
    
    itinerary_response = run_node_with_retry(
        "Itinerary Agent",
        local_state,
        generate_itinerary,
        itinerary_req
    )
    
    local_state["logs"].append("Itinerary Generation Agent complete. Workflow finalized.")
    return {
        "itinerary": itinerary_response,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

def verification_node(state: OrchestratorState) -> dict:
    """Re-check the assembled plan against the traveler's hard constraints.

    Deliberately arithmetic, not an LLM self-review: the graph routes on this
    result, so a violation has to be a fact rather than an opinion.
    """
    logs = list(state.get("logs", []))
    logs.append("Starting Verification Agent execution...")

    verification = verify_plan(
        state.get("requirements"),
        state.get("budget"),
        state.get("itinerary"),
    )

    if verification.valid:
        logs.append("Verification Agent: plan satisfies all hard constraints.")
    else:
        for violation in verification.violations:
            logs.append(f"Verification Agent: VIOLATION [{violation.code}] {violation.message}")

    return {"verification": verification, "logs": logs}


# Order in which repair spends down allocations. Activities first because they are the
# most discretionary and the scheduler can genuinely re-solve against a tighter ceiling;
# food next; lodging last among the reducible lines because "cheaper hotel" degrades the
# trip more than "fewer paid attractions".
#
# Transport is deliberately NOT reducible: the transport agent picks a concrete mode
# (flight/train) with a concrete cost, so arbitrarily writing that number down would
# produce a plan whose total no longer corresponds to any real option -- a budget that
# balances only because it lies. An overrun driven by transport is reported as
# unresolved instead.
REPAIR_LEVERS = ("activities_cost", "food_cost", "accommodation_cost")

# Floors: how far each line may be driven down, as a fraction of its original value.
# Zeroing lodging or food outright would "satisfy" the budget by pretending the
# traveller neither sleeps nor eats.
REPAIR_FLOOR_FRACTION = {
    "activities_cost": 0.0,
    "food_cost": 0.4,
    "accommodation_cost": 0.5,
}


def _floor_for(baseline: "BudgetBreakdown", lever: str) -> float:
    """Absolute floor for a lever, always relative to the ORIGINAL allocation.

    Deriving the floor from the *current* value instead is a subtle trap: each pass
    would take a fraction of an already-reduced number, so the line approaches zero
    without ever reaching a floor (Zeno-style) and "exhausted" never becomes true.
    Anchoring to the baseline makes the floor a fixed point the loop can actually hit.
    """
    return round(getattr(baseline, lever) * REPAIR_FLOOR_FRACTION[lever], 2)


def _repair_headroom(budget: "BudgetBreakdown", baseline: Optional["BudgetBreakdown"] = None) -> float:
    """Total reducible amount across every lever, given the floors."""
    baseline = baseline or budget
    return sum(
        max(round(getattr(budget, lever) - _floor_for(baseline, lever), 2), 0.0)
        for lever in REPAIR_LEVERS
    )


def repair_node(state: OrchestratorState) -> dict:
    """Apply a targeted, deterministic fix for a budget violation.

    Spends the required reduction across the levers in REPAIR_LEVERS order, each bounded
    by its floor, then recomputes the total from its components and lets the graph
    re-run the itinerary so the scheduler re-solves against the tighter ceiling. No LLM
    involved -- the repair is arithmetic, so it either resolves the violation or provably
    cannot.
    """
    logs = list(state.get("logs", []))
    attempts = state.get("repair_attempts", 0) + 1
    verification = state.get("verification")
    budget = state.get("budget")
    # Captured on the first repair pass so floors stay anchored to the original plan
    # rather than drifting downward with each reduction.
    baseline = state.get("budget_baseline") or budget

    reductions = [
        v.overspend_amount for v in (verification.violations if verification else [])
        if v.code in (BUDGET_OVERRUN, ACTIVITIES_OVERSPEND) and v.overspend_amount
    ]
    reduction = max(reductions) if reductions else 0.0

    remaining = reduction
    new_values = {lever: getattr(budget, lever) for lever in REPAIR_LEVERS}
    pulled = []

    for lever in REPAIR_LEVERS:
        if remaining <= 0:
            break
        current = new_values[lever]
        floor = _floor_for(baseline, lever)
        available = max(round(current - floor, 2), 0.0)
        if available <= 0:
            continue
        take = min(available, remaining)
        new_values[lever] = round(current - take, 2)
        remaining = round(remaining - take, 2)
        pulled.append(f"{lever} {current} -> {new_values[lever]}")

    new_budget = BudgetBreakdown(
        travel_cost=budget.travel_cost,
        accommodation_cost=new_values["accommodation_cost"],
        food_cost=new_values["food_cost"],
        activities_cost=new_values["activities_cost"],
        buffer=budget.buffer,
        total=round(
            budget.travel_cost + new_values["accommodation_cost"] + new_values["food_cost"]
            + new_values["activities_cost"] + budget.buffer,
            2,
        ),
    )

    # If nothing moved, every lever is already at its floor and another pass would
    # re-run the whole scheduler to reach the identical result. Mark it exhausted so
    # the router stops now instead of burning the attempt.
    exhausted = not pulled
    if exhausted:
        logs.append(
            f"Repair Agent (attempt {attempts}/{MAX_REPAIR_ATTEMPTS}): every reducible "
            f"allocation is already at its floor — no headroom left to absorb the "
            f"{reduction} overspend. Stopping repairs and reporting the violation honestly."
        )
    else:
        shortfall = (
            f" Still {remaining} short; transport is not reducible, so this may remain unresolved."
            if remaining > 0 else ""
        )
        logs.append(
            f"Repair Agent (attempt {attempts}/{MAX_REPAIR_ATTEMPTS}): absorbing an overspend "
            f"of {reduction} via {', '.join(pulled)}; re-running the scheduler against the new "
            f"ceiling.{shortfall}"
        )

    return {
        "budget": new_budget,
        "budget_baseline": baseline,
        "repair_attempts": attempts,
        "repair_exhausted": exhausted,
        "logs": logs,
    }


def verification_router(state: OrchestratorState) -> str:
    """Decide whether to repair-and-retry or accept the plan as-is."""
    verification = state.get("verification")
    if verification is None or verification.valid:
        return "node_planner"

    if not verification.repairable_violations:
        # e.g. an ungrounded fact or a scheduler-shape bug -- retrying the same
        # deterministic pipeline would produce the identical result.
        return "node_planner"

    if state.get("repair_exhausted"):
        # A previous repair had no headroom left to give; retrying is provably futile.
        return "node_planner"

    if state.get("repair_attempts", 0) >= MAX_REPAIR_ATTEMPTS:
        return "node_planner"

    # Check headroom BEFORE dispatching: the only lever repair_node has is the
    # activities allocation, so if that is already at zero a repair pass would
    # re-run the whole scheduler just to reach the identical plan. Catching it
    # here saves that wasted pass rather than discovering it one node too late.
    budget = state.get("budget")
    budget_only = all(
        v.code in (BUDGET_OVERRUN, ACTIVITIES_OVERSPEND)
        for v in verification.repairable_violations
    )
    if budget is not None and budget_only and _repair_headroom(budget, state.get("budget_baseline")) <= 0:
        return "node_planner"

    return "node_repair"


def planner_node(state: OrchestratorState) -> dict:
    logs = list(state.get("logs", []))
    retries = state.get("retries", 0)
    local_state = {"logs": logs, "retries": retries}

    # Extract top options
    transport_option = state["transport"][0] if state["transport"] else None
    accommodation_option = state["accommodation"][0] if state["accommodation"] else None

    compiled_plan = run_node_with_retry(
        "Final Planner Agent",
        local_state,
        compile_final_plan,
        requirements=state["requirements"],
        weather=state["weather"],
        transport=transport_option,
        accommodation=accommodation_option,
        budget=state["budget"],
        itinerary=state["itinerary"]
    )

    local_state["logs"].append("Final Planner Agent compiled structured plan.")
    return {
        "plan": compiled_plan,
        "logs": local_state["logs"],
        "retries": local_state["retries"]
    }

# 4. Assemble Graph Workflow
workflow = StateGraph(OrchestratorState)

workflow.add_node("node_understanding", understanding_node)
workflow.add_node("node_destination", destination_node)
workflow.add_node("node_weather", weather_node)
workflow.add_node("node_transport", transport_node)
workflow.add_node("node_accommodation", accommodation_node)
workflow.add_node("node_budget", budget_node)
workflow.add_node("node_itinerary", itinerary_node)
workflow.add_node("node_verify", verification_node)
workflow.add_node("node_repair", repair_node)
workflow.add_node("node_planner", planner_node)

def replan_entry_router(state: OrchestratorState) -> str:
    rt = state.get("replan_type")
    if rt == "budget":
        return "node_accommodation"
    elif rt == "weather":
        return "node_weather"
    elif rt == "itinerary":
        return "node_itinerary"
    else:
        return "node_understanding"

workflow.set_conditional_entry_point(
    replan_entry_router,
    {
        "node_understanding": "node_understanding",
        "node_weather": "node_weather",
        "node_accommodation": "node_accommodation",
        "node_itinerary": "node_itinerary"
    }
)

workflow.add_edge("node_understanding", "node_destination")
workflow.add_edge("node_destination", "node_weather")
workflow.add_edge("node_weather", "node_transport")
workflow.add_edge("node_transport", "node_accommodation")
workflow.add_edge("node_accommodation", "node_budget")

def budget_router(state: OrchestratorState) -> str:
    if state.get("replan_type") == "budget":
        return "node_verify"
    return "node_itinerary"

workflow.add_conditional_edges(
    "node_budget",
    budget_router,
    {
        "node_verify": "node_verify",
        "node_itinerary": "node_itinerary"
    }
)

# The verify -> repair -> itinerary -> verify cycle. This is the bounded replan
# loop: the verifier decides on hard constraints, the repair step makes a targeted
# deterministic change, and the scheduler re-solves. verification_router is what
# terminates it -- on success, on an unrepairable violation, or on hitting
# MAX_REPAIR_ATTEMPTS.
workflow.add_edge("node_itinerary", "node_verify")

workflow.add_conditional_edges(
    "node_verify",
    verification_router,
    {
        "node_repair": "node_repair",
        "node_planner": "node_planner"
    }
)

workflow.add_edge("node_repair", "node_itinerary")
workflow.add_edge("node_planner", END)

orchestrator_graph = workflow.compile()

def plan_trip_workflow(
    query: str, 
    source_city: str = "Mumbai", 
    user_id: Optional[int] = None,
    replan_type: Optional[str] = None,
    existing_state: Optional[dict] = None
) -> OrchestratorState:
    """
    Run the LangGraph orchestrator graph to plan a complete trip, supporting selective replanning.
    """
    initial_state = {
        "query": query,
        "source_city": source_city,
        "user_id": user_id,
        "requirements": None,
        "destination": None,
        "weather": None,
        "transport": [],
        "accommodation": [],
        "budget": None,
        "itinerary": None,
        "plan": None,
        "logs": [],
        "retries": 0,
        "replan_type": replan_type,
        "verification": None,
        "repair_attempts": 0,
        "repair_exhausted": False,
        "budget_baseline": None
    }
    
    if existing_state:
        for k, v in existing_state.items():
            if v is not None:
                initial_state[k] = v
                
    # Ensure correct values
    initial_state["query"] = query
    initial_state["replan_type"] = replan_type
    
    return orchestrator_graph.invoke(initial_state)
