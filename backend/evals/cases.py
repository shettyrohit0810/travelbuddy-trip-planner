"""Benchmark cases for the planner.

Deliberately includes cases that SHOULD fail. A harness that only measures happy
paths tells you nothing about whether the verifier actually catches anything --
the infeasible cases are the ones that prove the constraint enforcement is real
rather than decorative.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class EvalCase:
    name: str
    query: str
    category: str
    # None = no budget stated, so no budget constraint to satisfy.
    expect_satisfiable: Optional[bool] = None
    notes: str = ""


CASES = [
    # --- ordinary requests -------------------------------------------------
    EvalCase(
        name="goa_generous_budget",
        query="Plan a 3 day beach trip to Goa for 2 people with a budget of 60000",
        category="normal",
        expect_satisfiable=True,
        notes="Comfortable budget; should need no repair.",
    ),
    EvalCase(
        name="kyoto_moderate_budget",
        query="Plan a 2 day cultural trip to Kyoto for 2 people with a budget of 20000",
        category="normal",
        expect_satisfiable=True,
    ),
    EvalCase(
        name="paris_no_budget_stated",
        query="Plan a 4 day trip to Paris for 1 person",
        category="normal",
        expect_satisfiable=None,
        notes="No budget stated -- nothing to violate, but must not crash.",
    ),
    EvalCase(
        name="delhi_short_trip",
        query="Plan a 1 day trip to Delhi for 1 person with a budget of 15000",
        category="normal",
        expect_satisfiable=True,
    ),

    # --- tight but repairable ---------------------------------------------
    EvalCase(
        name="kyoto_tight_budget",
        query="Plan a 2 day cultural trip to Kyoto for 2 people with a budget of 16000",
        category="tight",
        expect_satisfiable=True,
        notes="Overruns on first pass; the repair loop should absorb it into activities.",
    ),

    # --- genuinely infeasible ---------------------------------------------
    EvalCase(
        name="kyoto_impossible_budget",
        query="Plan a 2 day cultural trip to Kyoto for 2 people with a budget of 5000",
        category="infeasible",
        expect_satisfiable=False,
        notes="Transport alone exceeds the budget. Must report failure, not fake success.",
    ),
    EvalCase(
        name="goa_absurd_budget",
        query="Plan a 5 day trip to Goa for 4 people with a budget of 100",
        category="infeasible",
        expect_satisfiable=False,
        notes="Must terminate quickly rather than spinning on repairs.",
    ),

    # --- malformed / adversarial input ------------------------------------
    EvalCase(
        name="gibberish_destination",
        query="Plan a 2 day trip to Zzqxwblahfake123 for 1 person with a budget of 20000",
        category="edge",
        notes="Unresolvable destination must degrade honestly, not fabricate places.",
    ),
    EvalCase(
        name="no_destination_at_all",
        query="I want to go somewhere nice for a few days",
        category="edge",
        notes="Vague request must still produce a coherent plan or a clear failure.",
    ),
    EvalCase(
        name="very_long_trip",
        query="Plan a 30 day trip to Goa for 2 people with a budget of 500000",
        category="edge",
        notes="Upper bound on days; scheduler must not blow up.",
    ),
]
