"""Guards the parallel research fan-out.

Parallelism is a claim about wall-clock behaviour, so it is asserted by measuring
concurrency rather than by inspecting the edge list -- an edge diagram looks identical
whether or not the runtime actually overlaps the work.
"""
import threading
import time

from langgraph.graph import StateGraph, END

from app.agents.orchestrator import OrchestratorState, research_join_node

NODE_DELAY_S = 0.4
BRANCHES = ["node_weather", "node_transport", "node_accommodation", "node_poi_prefetch"]


def _probe_graph():
    active, peak, lock = [], [0], threading.Lock()

    def make(name):
        def node(state):
            with lock:
                active.append(name)
                peak[0] = max(peak[0], len(active))
            time.sleep(NODE_DELAY_S)
            with lock:
                active.remove(name)
            return {"logs": [name]}
        return node

    wf = StateGraph(OrchestratorState)
    wf.add_node("start", lambda s: {"logs": []})
    for name in BRANCHES:
        wf.add_node(name, make(name))
    wf.add_node("join", lambda s: {"logs": []})
    wf.set_entry_point("start")
    for name in BRANCHES:
        wf.add_edge("start", name)
        wf.add_edge(name, "join")
    wf.add_edge("join", END)
    return wf.compile(), peak


def test_research_branches_actually_run_concurrently():
    graph, peak = _probe_graph()
    started = time.perf_counter()
    graph.invoke({"logs": [], "retries": 0})
    elapsed = time.perf_counter() - started

    assert peak[0] == len(BRANCHES), f"expected {len(BRANCHES)} concurrent, saw {peak[0]}"
    # Sequential would be ~4x NODE_DELAY_S. Generous bound so a loaded CI box does not
    # flake, but still far below the sequential floor.
    assert elapsed < NODE_DELAY_S * 2.5, f"took {elapsed:.2f}s — looks sequential"


def test_logs_reducer_merges_concurrent_writes_without_loss():
    """Every branch writes `logs` at once. Without the operator.add reducer this either
    raises InvalidUpdateError or silently drops all but one branch's entries."""
    graph, _ = _probe_graph()
    out = graph.invoke({"logs": [], "retries": 0})
    assert sorted(x for x in out["logs"] if x) == sorted(BRANCHES)


def test_research_join_reports_missing_branches_rather_than_failing():
    out = research_join_node({"weather": None, "transport": [], "accommodation": [], "poi_prefetch": None})
    joined = " ".join(out["logs"])
    for expected in ("weather", "transport", "accommodation", "points of interest"):
        assert expected in joined
    assert "Proceeding" in joined


def test_research_join_is_quiet_when_everything_resolved():
    out = research_join_node({
        "weather": object(), "transport": [object()],
        "accommodation": [object()], "poi_prefetch": {"activities": [{"name": "x"}]},
    })
    assert "all branches returned data" in " ".join(out["logs"])
