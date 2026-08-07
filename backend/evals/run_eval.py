"""Run the planner over the benchmark set and report real numbers.

Usage (from backend/, with the DB reachable):
    python -m evals.run_eval
    python -m evals.run_eval --json results.json

Reports per-case and aggregate: constraint-satisfaction rate, repair iterations,
latency, and how many scheduled stops were grounded in a real source. Anything it
cannot measure is reported as such rather than guessed.
"""
import argparse
import json
import statistics
import sys
import time
from typing import Any, Dict, List

from evals.cases import CASES


def _run_case(case) -> Dict[str, Any]:
    from app.agents.orchestrator import plan_trip_workflow

    started = time.perf_counter()
    error = None
    state: Dict[str, Any] = {}
    try:
        state = plan_trip_workflow(query=case.query)
    except Exception as e:  # a crash is itself a result worth recording
        error = f"{type(e).__name__}: {e}"
    elapsed_s = time.perf_counter() - started

    verification = state.get("verification") if state else None
    itinerary = state.get("itinerary") if state else None

    slots = []
    if itinerary is not None:
        for day in itinerary.itinerary:
            slots.extend(day.slots)

    return {
        "name": case.name,
        "category": case.category,
        "expect_satisfiable": case.expect_satisfiable,
        "error": error,
        "latency_s": round(elapsed_s, 2),
        "valid": None if verification is None else verification.valid,
        "violations": [] if verification is None else [v.code for v in verification.violations],
        "repair_attempts": (state.get("repair_attempts", 0) if state else 0),
        "days_scheduled": len(itinerary.itinerary) if itinerary else 0,
        "slots_scheduled": len(slots),
        "slots_grounded": sum(1 for s in slots if s.source and s.source.strip()),
    }


def _summarize(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    latencies = [r["latency_s"] for r in results]
    # Only cases that stated a budget have a constraint to satisfy.
    constrained = [r for r in results if r["valid"] is not None and r["expect_satisfiable"] is not None]
    correct = [r for r in constrained if r["valid"] == r["expect_satisfiable"]]
    total_slots = sum(r["slots_scheduled"] for r in results)
    grounded = sum(r["slots_grounded"] for r in results)

    return {
        "cases": len(results),
        "crashes": sum(1 for r in results if r["error"]),
        "constrained_cases": len(constrained),
        "verifier_correct": len(correct),
        "verifier_accuracy_pct": round(100 * len(correct) / len(constrained), 1) if constrained else None,
        "mean_latency_s": round(statistics.mean(latencies), 2) if latencies else None,
        "p95_latency_s": round(sorted(latencies)[max(int(0.95 * len(latencies)) - 1, 0)], 2) if latencies else None,
        "total_repair_attempts": sum(r["repair_attempts"] for r in results),
        "slots_scheduled": total_slots,
        "slots_grounded": grounded,
        "grounding_pct": round(100 * grounded / total_slots, 1) if total_slots else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", dest="json_path", default=None, help="write raw results to this path")
    args = parser.parse_args()

    results = [_run_case(c) for c in CASES]

    header = f"{'case':<26}{'cat':<11}{'valid':<7}{'exp':<7}{'rep':<5}{'slots':<7}{'sec':<7}"
    print(header)
    print("-" * len(header))
    for r in results:
        exp = "-" if r["expect_satisfiable"] is None else str(r["expect_satisfiable"])
        valid = "ERR" if r["error"] else ("-" if r["valid"] is None else str(r["valid"]))
        print(
            f"{r['name']:<26}{r['category']:<11}{valid:<7}{exp:<7}"
            f"{r['repair_attempts']:<5}{r['slots_scheduled']:<7}{r['latency_s']:<7}"
        )

    summary = _summarize(results)
    print("\n--- summary ---")
    for k, v in summary.items():
        print(f"{k:<24} {v}")

    mismatches = [
        r for r in results
        if r["expect_satisfiable"] is not None and not r["error"] and r["valid"] != r["expect_satisfiable"]
    ]
    if mismatches:
        print("\n--- verifier disagreed with expectation ---")
        for r in mismatches:
            print(f"  {r['name']}: expected {r['expect_satisfiable']}, got {r['valid']} ({r['violations']})")

    if summary["slots_scheduled"] == 0:
        print(
            "\nNOTE: zero stops were scheduled across every case. That means no POI source "
            "is configured (OPENTRIPMAP_API_KEY absent), so the grounding and scheduling "
            "numbers above are NOT evidence the real-data path works -- only that the "
            "pipeline degrades honestly without it."
        )

    if args.json_path:
        with open(args.json_path, "w") as fh:
            json.dump({"results": results, "summary": summary}, fh, indent=2)
        print(f"\nwrote {args.json_path}")

    return 1 if (summary["crashes"] or mismatches) else 0


if __name__ == "__main__":
    sys.exit(main())
