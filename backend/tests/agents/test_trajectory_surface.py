"""The trajectory has to survive the trip from agent to API response.

A trace that loses arguments, observations or reasons is worse than no trace: it looks
like inspection while hiding the parts that explain a decision.
"""
from app.agents.trajectory import Trajectory, summarize
from app.schemas.orchestrator import TrajectoryOut


def _sample() -> Trajectory:
    t = Trajectory(agent="acquisition", goal="find POIs", tool_call_budget=6)
    t.record("tool_call", "geocode_candidates", arguments={"name": "Goa"},
             observation={"candidates": [{"name": "Genoa", "country": "Italy"}]},
             reasoning="the name looks ambiguous", duration_ms=12.5)
    t.record("tool_call", "search_pois", arguments={"lat": 15.3, "lon": 74.0, "radius_m": 20000},
             observation={"count": 7, "sample_names": ["Fort Aguada"]},
             reasoning="widening the radius", duration_ms=980.0)
    t.outcome = "succeeded"
    t.summary = "found 7 after widening"
    t.wall_clock_ms = 1002.0
    return t


def test_trajectory_round_trips_into_the_api_schema_without_loss():
    out = TrajectoryOut(**_sample().to_dict())
    assert out.agent == "acquisition"
    assert out.tool_calls_used == 2
    assert out.tool_call_budget == 6
    assert out.outcome == "succeeded"

    first = out.steps[0]
    assert first.arguments == {"name": "Goa"}
    assert first.reasoning == "the name looks ambiguous"
    assert first.observation["candidates"][0]["name"] == "Genoa"
    assert first.duration_ms == 12.5


def test_summarize_aggregates_across_agents():
    s = summarize([_sample(), _sample()])
    assert s["agents_run"] == 2
    assert s["total_tool_calls"] == 4
    assert all(o["outcome"] == "succeeded" for o in s["outcomes"])


def test_unavailable_outcome_is_distinguishable_from_an_empty_trace():
    """No model configured and no agent needed must not look identical in the UI."""
    t = Trajectory(agent="acquisition", goal="g")
    t.outcome = "unavailable"
    t.summary = "No LLM configured, so no agent ran."
    t.record("outcome", "unavailable", reasoning=t.summary)

    out = TrajectoryOut(**t.to_dict())
    assert out.outcome == "unavailable"
    assert out.tool_calls_used == 0
    assert len(out.steps) == 1
