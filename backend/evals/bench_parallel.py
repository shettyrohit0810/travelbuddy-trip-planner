"""Measure the real latency difference between sequential and parallel research.

Builds a sequential-edge variant of the production graph and runs both over the same
request, so the parallelism claim rests on a measured number rather than an edge
diagram. Reports cold and warm POI cache separately -- they differ by roughly two
orders of magnitude and only one of them describes steady state.

Usage (from backend/):
    python -m evals.bench_parallel
    python -m evals.bench_parallel --query "Plan a 3 day trip to Kyoto for 2 people with a budget of 40000"
"""
import argparse
import statistics
import sys
import time
from typing import Dict, List

from langgraph.graph import StateGraph, END

import app.agents.orchestrator as orch


def _build_sequential_graph():
    """The pre-parallel topology: research nodes chained one after another.

    Everything else -- nodes, routers, the verify/repair cycle -- is identical to
    production, so the only variable is whether the research phase overlaps.
    """
    wf = StateGraph(orch.OrchestratorState)
    wf.add_node("node_understanding", orch.understanding_node)
    wf.add_node("node_destination", orch.destination_node)
    wf.add_node("node_weather", orch.weather_node)
    wf.add_node("node_transport", orch.transport_node)
    wf.add_node("node_accommodation", orch.accommodation_node)
    wf.add_node("node_poi_prefetch", orch.poi_prefetch_node)
    wf.add_node("node_budget", orch.budget_node)
    wf.add_node("node_itinerary", orch.itinerary_node)
    wf.add_node("node_verify", orch.verification_node)
    wf.add_node("node_repair", orch.repair_node)
    wf.add_node("node_planner", orch.planner_node)

    wf.set_entry_point("node_understanding")
    wf.add_edge("node_understanding", "node_destination")
    # The difference: strictly serial research.
    wf.add_edge("node_destination", "node_weather")
    wf.add_edge("node_weather", "node_transport")
    wf.add_edge("node_transport", "node_accommodation")
    wf.add_edge("node_accommodation", "node_poi_prefetch")
    wf.add_edge("node_poi_prefetch", "node_budget")

    wf.add_edge("node_budget", "node_itinerary")
    wf.add_edge("node_itinerary", "node_verify")
    wf.add_conditional_edges(
        "node_verify", orch.verification_router,
        {"node_repair": "node_repair", "node_planner": "node_planner"},
    )
    wf.add_edge("node_repair", "node_itinerary")
    wf.add_edge("node_planner", END)
    return wf.compile()


def _initial_state(query: str) -> Dict:
    return {
        "query": query, "source_city": "Mumbai", "user_id": None,
        "requirements": None, "destination": None, "weather": None,
        "transport": [], "accommodation": [], "budget": None, "itinerary": None,
        "plan": None, "logs": [], "retries": 0, "replan_type": None,
        "poi_prefetch": None, "verification": None, "repair_attempts": 0,
        "repair_exhausted": False, "budget_baseline": None,
    }


def _time_graph(graph, query: str) -> float:
    started = time.perf_counter()
    graph.invoke(_initial_state(query))
    return time.perf_counter() - started


def _clear_poi_cache() -> None:
    from app.tools.poi_overpass import overpass_poi_search, _geocode
    from app.tools.destination_search import destination_search
    for fn in (overpass_poi_search, _geocode, destination_search):
        clear = getattr(fn, "cache_clear", None)
        if clear:
            clear()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="Plan a 3 day cultural trip to Kyoto for 2 people with a budget of 40000")
    parser.add_argument("--warm-repeats", type=int, default=3)
    args = parser.parse_args()

    parallel = orch.orchestrator_graph
    sequential = _build_sequential_graph()

    print(f"query: {args.query}\n")
    rows: List[tuple] = []

    # --- cold: one run each, cache cleared before both -----------------------
    # Each cold run pays its own POI lookup, so this is a fair comparison of the
    # topology rather than of who ran first.
    _clear_poi_cache()
    seq_cold = _time_graph(sequential, args.query)
    _clear_poi_cache()
    par_cold = _time_graph(parallel, args.query)
    rows.append(("cold POI cache", seq_cold, par_cold))

    # --- warm: cache now populated, repeat for a stable median ---------------
    seq_warm = statistics.median(_time_graph(sequential, args.query) for _ in range(args.warm_repeats))
    par_warm = statistics.median(_time_graph(parallel, args.query) for _ in range(args.warm_repeats))
    rows.append((f"warm POI cache (median of {args.warm_repeats})", seq_warm, par_warm))

    print(f"{'scenario':<34}{'sequential':<14}{'parallel':<14}{'speedup':<10}")
    print("-" * 72)
    for label, seq, par in rows:
        speedup = f"{seq / par:.2f}x" if par > 0 else "n/a"
        print(f"{label:<34}{seq:<14.2f}{par:<14.2f}{speedup:<10}")

    print(
        "\nNOTE: the cold row is a single run each. Overpass latency varies widely "
        "(60-100s observed, plus occasional 504s), so treat the cold speedup as "
        "indicative, not precise. The warm row is the steady-state figure."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
