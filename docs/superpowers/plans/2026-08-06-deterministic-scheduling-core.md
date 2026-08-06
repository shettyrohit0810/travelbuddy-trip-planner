# Deterministic Scheduling Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LLM-invented itinerary structure with a deterministic, unit-tested scheduler — the LLM (if configured) only narrates prose for slots the scheduler already decided.

**Architecture:** A new dependency-free `backend/app/scheduling/` package (frozen dataclasses + a `TravelTimeProvider` Protocol for dependency inversion) does per-day 0/1-knapsack candidate selection and brute-force stop ordering using real coordinates and haversine-estimated travel time. `agents/itinerary.py` always calls it first; an LLM, if configured, narrates already-decided slots without altering them.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest (new), hypothesis (new), stdlib `dataclasses`/`itertools`/`math`.

**Spec:** [docs/superpowers/specs/2026-08-06-deterministic-scheduling-core-design.md](../specs/2026-08-06-deterministic-scheduling-core-design.md)

---

## Task 1: Bootstrap pytest + hypothesis test infrastructure

The backend has zero automated test infrastructure today — `test_db.py` is a manual print-statement script, not pytest-collectible.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/scheduling/__init__.py`
- Create: `backend/tests/test_sanity.py`

- [ ] **Step 1: Add pytest and hypothesis to requirements.txt**

Append to `backend/requirements.txt`:

```
pytest>=7.4.0
hypothesis>=6.100.0
```

- [ ] **Step 2: Create pytest.ini**

Create `backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 3: Create empty test package files**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/scheduling/__init__.py` (empty file).

- [ ] **Step 4: Write a sanity test**

Create `backend/tests/test_sanity.py`:

```python
def test_pytest_is_working():
    assert 1 + 1 == 2
```

- [ ] **Step 5: Rebuild the backend image and run the sanity test**

Run:
```bash
docker compose build backend
docker compose run --rm --no-deps backend pytest -v
```
Expected: `tests/test_sanity.py::test_pytest_is_working PASSED`, 1 passed.

`--no-deps` skips starting `db` — nothing in this test suite touches the database, and it avoids the port-5433 conflict with any other project's Postgres container already running on this machine.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/__init__.py backend/tests/scheduling/__init__.py backend/tests/test_sanity.py
git commit -m "chore: bootstrap pytest + hypothesis test infrastructure"
```

---

## Task 2: Scheduling domain models

**Files:**
- Create: `backend/app/scheduling/__init__.py`
- Create: `backend/app/scheduling/models.py`
- Test: `backend/tests/scheduling/test_models.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/scheduling/test_models.py`:

```python
from app.scheduling.models import (
    Coordinates,
    TimeWindow,
    Candidate,
    ScheduleConstraints,
    ScheduledSlot,
    DaySchedule,
    ScheduleResult,
)


def test_candidate_is_frozen():
    c = Candidate(
        name="Test Fort",
        category="historic",
        rating=4.5,
        coords=Coordinates(lat=1.0, lon=2.0),
        source="test",
        estimated_cost=10.0,
    )
    try:
        c.rating = 5.0
        assert False, "Candidate should be immutable"
    except AttributeError:
        pass


def test_candidate_defaults():
    c = Candidate(
        name="Test Fort",
        category="historic",
        rating=4.5,
        coords=Coordinates(lat=1.0, lon=2.0),
        source="test",
        estimated_cost=10.0,
    )
    assert c.open_windows is None
    assert c.mandatory is False


def test_schedule_constraints_defaults():
    constraints = ScheduleConstraints(days=3)
    assert constraints.day_start_min == 540
    assert constraints.day_end_min == 1260
    assert constraints.visit_duration_min == 120
    assert constraints.start_location is None
    assert constraints.activities_budget is None
    assert constraints.max_slots_per_day == 3


def test_day_schedule_and_result_default_lists():
    day = DaySchedule(day=1, slots=[])
    assert day.notes == []
    result = ScheduleResult(days=[day], total_estimated_cost=0.0)
    assert result.warnings == []


def test_time_window_and_scheduled_slot_construction():
    window = TimeWindow(start_min=540, end_min=600)
    assert window.start_min == 540
    slot = ScheduledSlot(
        day=1, slot_index=0, start_min=540, end_min=660,
        name="Test Fort", category="historic", source="test",
        travel_min_from_previous=5.0, estimated_cost=10.0,
    )
    assert slot.end_min == 660
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling'`

- [ ] **Step 3: Create the package and models**

Create `backend/app/scheduling/__init__.py` (empty file).

Create `backend/app/scheduling/models.py`:

```python
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class Coordinates:
    lat: float
    lon: float


@dataclass(frozen=True)
class TimeWindow:
    start_min: int
    end_min: int


@dataclass(frozen=True)
class Candidate:
    name: str
    category: str
    rating: float
    coords: Coordinates
    source: str
    estimated_cost: float
    open_windows: Optional[List[TimeWindow]] = None
    mandatory: bool = False


@dataclass(frozen=True)
class ScheduleConstraints:
    days: int
    day_start_min: int = 540
    day_end_min: int = 1260
    visit_duration_min: int = 120
    start_location: Optional[Coordinates] = None
    activities_budget: Optional[float] = None
    max_slots_per_day: int = 3


@dataclass(frozen=True)
class ScheduledSlot:
    day: int
    slot_index: int
    start_min: int
    end_min: int
    name: str
    category: str
    source: str
    travel_min_from_previous: float
    estimated_cost: float


@dataclass(frozen=True)
class DaySchedule:
    day: int
    slots: List[ScheduledSlot]
    notes: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class ScheduleResult:
    days: List[DaySchedule]
    total_estimated_cost: float
    warnings: List[str] = field(default_factory=list)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_models.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduling/__init__.py backend/app/scheduling/models.py backend/tests/scheduling/test_models.py
git commit -m "feat: add scheduling domain models"
```

---

## Task 3: Travel-time port + haversine adapter

**Files:**
- Create: `backend/app/scheduling/ports.py`
- Create: `backend/app/scheduling/geo.py`
- Test: `backend/tests/scheduling/test_geo.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/scheduling/test_geo.py`:

```python
from app.scheduling.models import Coordinates
from app.scheduling.geo import haversine_km, HaversineTravelTimeProvider


def test_haversine_km_same_point_is_zero():
    a = Coordinates(lat=12.34, lon=56.78)
    assert haversine_km(a, a) == 0.0


def test_haversine_km_one_degree_latitude_is_about_111km():
    a = Coordinates(lat=0.0, lon=0.0)
    b = Coordinates(lat=1.0, lon=0.0)
    distance = haversine_km(a, b)
    assert abs(distance - 111.19) < 0.5


def test_haversine_is_symmetric():
    a = Coordinates(lat=10.0, lon=20.0)
    b = Coordinates(lat=15.0, lon=25.0)
    assert abs(haversine_km(a, b) - haversine_km(b, a)) < 1e-9


def test_travel_time_provider_converts_distance_to_minutes_at_given_speed():
    a = Coordinates(lat=0.0, lon=0.0)
    b = Coordinates(lat=1.0, lon=0.0)
    provider = HaversineTravelTimeProvider(speed_kmh=20.0)
    minutes = provider.minutes_between(a, b)
    # ~111.19 km at 20 km/h = ~333.6 minutes
    assert abs(minutes - 333.6) < 2.0


def test_travel_time_provider_satisfies_the_protocol_structurally():
    from app.scheduling.ports import TravelTimeProvider
    provider = HaversineTravelTimeProvider()
    assert isinstance(provider, TravelTimeProvider)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_geo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling.geo'`

- [ ] **Step 3: Write ports.py**

Create `backend/app/scheduling/ports.py`:

```python
from typing import Protocol, runtime_checkable

from app.scheduling.models import Coordinates


@runtime_checkable
class TravelTimeProvider(Protocol):
    def minutes_between(self, a: Coordinates, b: Coordinates) -> float:
        ...


@runtime_checkable
class CostEstimator(Protocol):
    def estimate(self, category: str) -> float:
        ...
```

`@runtime_checkable` is what makes `isinstance(provider, TravelTimeProvider)` work in the test above — without it, `Protocol` only supports static type-checking, not `isinstance`.

- [ ] **Step 4: Write geo.py**

Create `backend/app/scheduling/geo.py`:

```python
import math

from app.scheduling.models import Coordinates

EARTH_RADIUS_KM = 6371.0


def haversine_km(a: Coordinates, b: Coordinates) -> float:
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


class HaversineTravelTimeProvider:
    """TravelTimeProvider backed by real coordinates + an assumed average speed.
    Not a real routing API (no roads/traffic), but grounded in real distance, not
    guessed. See the design spec's "Travel time" decision for the tradeoff."""

    def __init__(self, speed_kmh: float = 20.0):
        self.speed_kmh = speed_kmh

    def minutes_between(self, a: Coordinates, b: Coordinates) -> float:
        distance_km = haversine_km(a, b)
        hours = distance_km / self.speed_kmh
        return hours * 60.0
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_geo.py -v`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/scheduling/ports.py backend/app/scheduling/geo.py backend/tests/scheduling/test_geo.py
git commit -m "feat: add TravelTimeProvider port and haversine adapter"
```

---

## Task 4: Cost estimator adapter

**Files:**
- Create: `backend/app/scheduling/costs.py`
- Test: `backend/tests/scheduling/test_costs.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/scheduling/test_costs.py`:

```python
from app.scheduling.costs import StaticCostEstimator, ACTIVITY_COST_BY_CATEGORY, DEFAULT_ACTIVITY_COST
from app.scheduling.ports import CostEstimator


def test_static_cost_estimator_returns_known_category_costs():
    estimator = StaticCostEstimator()
    for category, expected_cost in ACTIVITY_COST_BY_CATEGORY.items():
        assert estimator.estimate(category) == expected_cost


def test_static_cost_estimator_falls_back_to_default_for_unknown_category():
    estimator = StaticCostEstimator()
    assert estimator.estimate("some_totally_unknown_category") == DEFAULT_ACTIVITY_COST


def test_static_cost_estimator_satisfies_the_protocol_structurally():
    assert isinstance(StaticCostEstimator(), CostEstimator)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_costs.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling.costs'`

- [ ] **Step 3: Write costs.py**

Create `backend/app/scheduling/costs.py`:

```python
# Flat per-category cost heuristic, same honesty level as budget_estimator.py's
# rate table — a labeled estimate for budget enforcement, not a live-pricing claim.
# Keys are common OpenTripMap "kinds" values.
ACTIVITY_COST_BY_CATEGORY = {
    "natural": 0.0,
    "beaches": 0.0,
    "view_points": 0.0,
    "urban_environment": 0.0,
    "religion": 5.0,
    "shops": 5.0,
    "architecture": 10.0,
    "historic": 10.0,
    "foods": 10.0,
    "cultural": 15.0,
    "museums": 15.0,
    "sport": 20.0,
    "theatres_and_entertainments": 20.0,
    "amusements": 30.0,
}
DEFAULT_ACTIVITY_COST = 15.0


class StaticCostEstimator:
    def estimate(self, category: str) -> float:
        return ACTIVITY_COST_BY_CATEGORY.get(category, DEFAULT_ACTIVITY_COST)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_costs.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduling/costs.py backend/tests/scheduling/test_costs.py
git commit -m "feat: add CostEstimator port and static per-category cost table"
```

---

## Task 5: Per-day selection and ordering (day_selector.py)

This is the core algorithm: 0/1 knapsack (DP) to pick which candidates fit the day's budget/slot cap, then brute-force permutation to find the lowest-travel-time ordering that still fits the day's time window.

**Files:**
- Create: `backend/app/scheduling/day_selector.py`
- Test: `backend/tests/scheduling/test_day_selector.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scheduling/test_day_selector.py`:

```python
from app.scheduling.models import Candidate, Coordinates, ScheduleConstraints
from app.scheduling.geo import HaversineTravelTimeProvider
from app.scheduling.day_selector import _knapsack_select, _best_ordering, select_day

ALPHA = Candidate(name="Alpha Fort", category="historic", rating=5.0, coords=Coordinates(0.0, 0.0), source="test", estimated_cost=10.0)
BETA = Candidate(name="Beta Garden", category="natural", rating=4.0, coords=Coordinates(0.0, 0.01), source="test", estimated_cost=10.0)
GAMMA = Candidate(name="Gamma Point", category="natural", rating=3.0, coords=Coordinates(0.0, 5.0), source="test", estimated_cost=10.0)
DELTA = Candidate(name="Delta Museum", category="museums", rating=4.5, coords=Coordinates(0.0, 0.02), source="test", estimated_cost=100.0)


def test_knapsack_select_picks_highest_value_combo_within_budget_and_slot_cap():
    selected = _knapsack_select([ALPHA, BETA, GAMMA, DELTA], budget=25.0, max_items=2)
    assert {c.name for c in selected} == {"Alpha Fort", "Beta Garden"}


def test_knapsack_select_excludes_items_that_alone_exceed_budget():
    selected = _knapsack_select([DELTA], budget=25.0, max_items=1)
    assert selected == []


def test_knapsack_select_respects_unlimited_budget():
    selected = _knapsack_select([ALPHA, BETA, GAMMA, DELTA], budget=float("inf"), max_items=4)
    assert {c.name for c in selected} == {"Alpha Fort", "Beta Garden", "Gamma Point", "Delta Museum"}


def test_best_ordering_ties_break_lexicographically_by_name():
    ordering = _best_ordering(
        [BETA, ALPHA],
        start=None,
        day_start_min=540,
        day_end_min=1260,
        visit_duration_min=120,
        travel_provider=HaversineTravelTimeProvider(speed_kmh=20.0),
    )
    names = [c.name for c, _ in ordering]
    assert names == ["Alpha Fort", "Beta Garden"]


def test_best_ordering_returns_none_when_nothing_fits_within_day_end():
    ordering = _best_ordering(
        [ALPHA, BETA, GAMMA],
        start=None,
        day_start_min=540,
        day_end_min=560,
        visit_duration_min=120,
        travel_provider=HaversineTravelTimeProvider(speed_kmh=20.0),
    )
    assert ordering is None


def test_select_day_shrinks_slot_count_when_day_is_too_short_for_full_slate():
    constraints = ScheduleConstraints(days=1, day_start_min=540, day_end_min=700, visit_duration_min=120, max_slots_per_day=2)
    day_schedule, spent = select_day(
        day=1, pool=[ALPHA, BETA], remaining_budget=None, constraints=constraints,
        travel_provider=HaversineTravelTimeProvider(speed_kmh=20.0),
    )
    assert len(day_schedule.slots) == 1
    assert day_schedule.slots[0].name == "Alpha Fort"
    assert spent == 10.0
    assert any("left partially open" in note for note in day_schedule.notes)


def test_select_day_returns_empty_with_note_when_pool_is_empty():
    constraints = ScheduleConstraints(days=1)
    day_schedule, spent = select_day(
        day=1, pool=[], remaining_budget=None, constraints=constraints,
        travel_provider=HaversineTravelTimeProvider(speed_kmh=20.0),
    )
    assert day_schedule.slots == []
    assert spent == 0.0
    assert any("no verified points of interest" in note.lower() for note in day_schedule.notes)


def test_select_day_populates_slot_times_and_travel():
    constraints = ScheduleConstraints(days=1, day_start_min=540, day_end_min=1260, visit_duration_min=120, max_slots_per_day=2)
    day_schedule, spent = select_day(
        day=1, pool=[ALPHA, BETA], remaining_budget=100.0, constraints=constraints,
        travel_provider=HaversineTravelTimeProvider(speed_kmh=20.0),
    )
    assert len(day_schedule.slots) == 2
    first, second = day_schedule.slots
    assert first.start_min == 540
    assert first.end_min == 660
    assert second.start_min >= first.end_min
    assert spent == 20.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_day_selector.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling.day_selector'`

- [ ] **Step 3: Write day_selector.py**

Create `backend/app/scheduling/day_selector.py`:

```python
from itertools import permutations
from typing import List, Optional, Tuple

from app.scheduling.models import Candidate, Coordinates, DaySchedule, ScheduleConstraints, ScheduledSlot
from app.scheduling.ports import TravelTimeProvider


def _knapsack_select(candidates: List[Candidate], budget: float, max_items: int) -> List[Candidate]:
    """0/1 knapsack: maximize total rating, weight = estimated_cost, capacity =
    budget, additionally capped at max_items. Exact DP over (count, cost_used_cents)
    states -- small in practice since candidate pools and slot counts are both small."""
    if not candidates or max_items <= 0:
        return []

    budget_cents = 10**9 if budget == float("inf") else max(int(round(budget * 100)), 0)
    costs_cents = [max(int(round(c.estimated_cost * 100)), 0) for c in candidates]

    # states: (count_used, cost_used_cents) -> (total_rating, indices_tuple)
    states = {(0, 0): (0.0, ())}
    for i, cost in enumerate(costs_cents):
        rating = candidates[i].rating
        new_states = dict(states)
        for (count, used), (value, indices) in states.items():
            if count >= max_items:
                continue
            new_used = used + cost
            if new_used > budget_cents:
                continue
            key = (count + 1, new_used)
            new_value = value + rating
            if key not in new_states or new_states[key][0] < new_value:
                new_states[key] = (new_value, indices + (i,))
        states = new_states

    best_value = -1.0
    best_indices: Tuple[int, ...] = ()
    for value, indices in states.values():
        if value > best_value:
            best_value = value
            best_indices = indices

    return [candidates[i] for i in best_indices]


def _best_ordering(
    selected: List[Candidate],
    start: Optional[Coordinates],
    day_start_min: int,
    day_end_min: int,
    visit_duration_min: int,
    travel_provider: TravelTimeProvider,
) -> Optional[List[Tuple[Candidate, float]]]:
    """Try every ordering of `selected`, return the one with the earliest finish
    time that still fits within day_end_min, as a list of (candidate, travel_minutes
    from the previous stop). Ties break on lexicographic stop-name order for
    determinism. Returns None if no ordering fits, or [] if selected is empty."""
    if not selected:
        return []

    best_key = None
    best_ordering: Optional[List[Tuple[Candidate, float]]] = None

    for perm in permutations(selected):
        clock = float(day_start_min)
        prev_coords = start
        ordered_with_travel: List[Tuple[Candidate, float]] = []
        for candidate in perm:
            travel = travel_provider.minutes_between(prev_coords, candidate.coords) if prev_coords is not None else 0.0
            clock += travel + visit_duration_min
            ordered_with_travel.append((candidate, travel))
            prev_coords = candidate.coords

        if clock > day_end_min:
            continue

        key = (clock, tuple(c.name for c in perm))
        if best_key is None or key < best_key:
            best_key = key
            best_ordering = ordered_with_travel

    return best_ordering


def select_day(
    day: int,
    pool: List[Candidate],
    remaining_budget: Optional[float],
    constraints: ScheduleConstraints,
    travel_provider: TravelTimeProvider,
) -> Tuple[DaySchedule, float]:
    """
    Select and order stops for one day from `pool` (already filtered by the caller
    to exclude names used on previous days). Shrinks the slot count until an
    ordering fits the day's time window, or gives up with an explanatory note.
    Returns the DaySchedule and the budget actually spent (the caller subtracts
    this from the running trip total).
    """
    budget_for_knapsack = remaining_budget if remaining_budget is not None else float("inf")

    ordering: Optional[List[Tuple[Candidate, float]]] = None
    max_items = constraints.max_slots_per_day
    while max_items > 0:
        selected = _knapsack_select(pool, budget_for_knapsack, max_items)
        ordering = _best_ordering(
            selected,
            constraints.start_location,
            constraints.day_start_min,
            constraints.day_end_min,
            constraints.visit_duration_min,
            travel_provider,
        )
        if ordering:
            break
        max_items -= 1

    notes: List[str] = []
    if not ordering:
        ordering = []
        if pool:
            notes.append(f"no combination of available attractions fit within the time/budget limits")
        else:
            notes.append(f"no verified points of interest available to schedule")

    slots: List[ScheduledSlot] = []
    clock = float(constraints.day_start_min)
    spent = 0.0
    for slot_index, (candidate, travel) in enumerate(ordering):
        clock += travel
        start_min = int(round(clock))
        clock += constraints.visit_duration_min
        end_min = int(round(clock))
        spent += candidate.estimated_cost
        slots.append(ScheduledSlot(
            day=day,
            slot_index=slot_index,
            start_min=start_min,
            end_min=end_min,
            name=candidate.name,
            category=candidate.category,
            source=candidate.source,
            travel_min_from_previous=round(travel, 1),
            estimated_cost=candidate.estimated_cost,
        ))

    if 0 < len(slots) < constraints.max_slots_per_day:
        notes.append(f"left partially open — only {len(slots)} suitable stop(s) found within constraints")

    return DaySchedule(day=day, slots=slots, notes=notes), spent
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_day_selector.py -v`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduling/day_selector.py backend/tests/scheduling/test_day_selector.py
git commit -m "feat: add per-day knapsack selection and brute-force ordering"
```

---

## Task 6: Cross-day orchestration (scheduler.py)

Owns the used-candidate set, budget depletion across days, and the repeat-fallback policy (revisit the best candidate rather than leave a day fully blank).

**Files:**
- Create: `backend/app/scheduling/scheduler.py`
- Test: `backend/tests/scheduling/test_scheduler.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scheduling/test_scheduler.py`:

```python
from app.scheduling.models import Candidate, Coordinates, ScheduleConstraints
from app.scheduling.geo import HaversineTravelTimeProvider
from app.scheduling.scheduler import build_schedule

ALPHA = Candidate(name="Alpha Fort", category="historic", rating=5.0, coords=Coordinates(0.0, 0.0), source="test", estimated_cost=10.0)
BETA = Candidate(name="Beta Garden", category="natural", rating=4.0, coords=Coordinates(0.0, 0.01), source="test", estimated_cost=10.0)
GAMMA = Candidate(name="Gamma Point", category="natural", rating=3.0, coords=Coordinates(0.0, 5.0), source="test", estimated_cost=10.0)

PROVIDER = HaversineTravelTimeProvider(speed_kmh=20.0)


def test_build_schedule_produces_one_day_schedule_per_requested_day():
    constraints = ScheduleConstraints(days=3)
    result = build_schedule([ALPHA, BETA, GAMMA], constraints, PROVIDER)
    assert len(result.days) == 3
    assert [d.day for d in result.days] == [1, 2, 3]


def test_build_schedule_does_not_repeat_a_candidate_while_unused_ones_remain():
    constraints = ScheduleConstraints(days=2, max_slots_per_day=1)
    result = build_schedule([ALPHA, BETA], constraints, PROVIDER)
    day1_names = {s.name for s in result.days[0].slots}
    day2_names = {s.name for s in result.days[1].slots}
    assert day1_names.isdisjoint(day2_names)
    assert day1_names | day2_names == {"Alpha Fort", "Beta Garden"}


def test_build_schedule_revisits_best_candidate_when_day_has_no_unused_options():
    constraints = ScheduleConstraints(days=2, max_slots_per_day=2)
    result = build_schedule([ALPHA], constraints, PROVIDER)
    assert result.days[0].slots[0].name == "Alpha Fort"
    assert result.days[1].slots[0].name == "Alpha Fort"
    assert any("Revisiting Alpha Fort" in w for w in result.warnings)


def test_build_schedule_with_no_candidates_returns_empty_days_with_warnings():
    constraints = ScheduleConstraints(days=2)
    result = build_schedule([], constraints, PROVIDER)
    assert all(d.slots == [] for d in result.days)
    assert len(result.warnings) == 2


def test_build_schedule_total_cost_matches_sum_of_slot_costs():
    constraints = ScheduleConstraints(days=1, max_slots_per_day=2)
    result = build_schedule([ALPHA, BETA], constraints, PROVIDER)
    slot_cost_sum = sum(s.estimated_cost for d in result.days for s in d.slots)
    assert result.total_estimated_cost == slot_cost_sum


def test_build_schedule_depletes_budget_across_days():
    constraints = ScheduleConstraints(days=2, max_slots_per_day=1, activities_budget=10.0)
    result = build_schedule([ALPHA, BETA], constraints, PROVIDER)
    # Only enough budget (10.0) for exactly one 10.0-cost stop across the whole trip.
    total_slots = sum(len(d.slots) for d in result.days)
    assert total_slots == 1
    assert result.total_estimated_cost == 10.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_scheduler.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling.scheduler'`

- [ ] **Step 3: Write scheduler.py**

Create `backend/app/scheduling/scheduler.py`:

```python
from typing import List, Optional

from app.scheduling.models import Candidate, DaySchedule, ScheduleConstraints, ScheduleResult
from app.scheduling.day_selector import select_day
from app.scheduling.ports import TravelTimeProvider


def build_schedule(
    candidates: List[Candidate],
    constraints: ScheduleConstraints,
    travel_provider: TravelTimeProvider,
) -> ScheduleResult:
    """
    Build a day-by-day schedule. Deterministic: same candidates + constraints always
    produce the same result. Each candidate is used at most once across the trip
    unless the repeat-fallback kicks in (a day would otherwise be completely empty
    and at least one candidate exists trip-wide).
    """
    used_names: set = set()
    days: List[DaySchedule] = []
    total_spent = 0.0
    remaining_budget: Optional[float] = constraints.activities_budget
    warnings: List[str] = []

    for day in range(1, constraints.days + 1):
        pool = [c for c in candidates if c.name not in used_names]
        day_schedule, spent = select_day(day, pool, remaining_budget, constraints, travel_provider)

        if not day_schedule.slots and candidates:
            best_overall = max(candidates, key=lambda c: (c.rating, c.name))
            fallback_schedule, fallback_spent = select_day(
                day, [best_overall], remaining_budget, constraints, travel_provider
            )
            if fallback_schedule.slots:
                day_schedule = DaySchedule(
                    day=day,
                    slots=fallback_schedule.slots,
                    notes=[f"Revisiting {best_overall.name} — limited new options found nearby"],
                )
                spent = fallback_spent

        for slot in day_schedule.slots:
            used_names.add(slot.name)
        total_spent += spent
        if remaining_budget is not None:
            remaining_budget = max(remaining_budget - spent, 0.0)

        days.append(day_schedule)
        warnings.extend(f"Day {day}: {note}" for note in day_schedule.notes)

    return ScheduleResult(days=days, total_estimated_cost=total_spent, warnings=warnings)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_scheduler.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduling/scheduler.py backend/tests/scheduling/test_scheduler.py
git commit -m "feat: add build_schedule cross-day orchestration with repeat fallback"
```

---

## Task 7: Independent invariant validator

**Files:**
- Create: `backend/app/scheduling/validator.py`
- Test: `backend/tests/scheduling/test_validator.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scheduling/test_validator.py`:

```python
from app.scheduling.models import DaySchedule, ScheduleConstraints, ScheduledSlot, ScheduleResult
from app.scheduling.validator import validate


def _slot(name, start_min, end_min, cost=10.0):
    return ScheduledSlot(
        day=1, slot_index=0, start_min=start_min, end_min=end_min,
        name=name, category="historic", source="test",
        travel_min_from_previous=0.0, estimated_cost=cost,
    )


def test_validate_accepts_a_well_formed_schedule():
    day = DaySchedule(day=1, slots=[_slot("X", 540, 660)])
    result = ScheduleResult(days=[day], total_estimated_cost=10.0)
    constraints = ScheduleConstraints(days=1, activities_budget=100.0)
    v = validate(result, constraints)
    assert v.valid
    assert v.violations == []


def test_validate_flags_overlapping_slots():
    day = DaySchedule(day=1, slots=[_slot("X", 540, 660), _slot("Y", 600, 720)])
    result = ScheduleResult(days=[day], total_estimated_cost=20.0)
    constraints = ScheduleConstraints(days=1)
    v = validate(result, constraints)
    assert not v.valid
    assert any("overlaps" in msg for msg in v.violations)


def test_validate_flags_slot_starting_before_day_start():
    day = DaySchedule(day=1, slots=[_slot("X", 500, 620)])
    result = ScheduleResult(days=[day], total_estimated_cost=10.0)
    constraints = ScheduleConstraints(days=1, day_start_min=540)
    v = validate(result, constraints)
    assert not v.valid
    assert any("day_start_min" in msg for msg in v.violations)


def test_validate_flags_slot_ending_after_day_end():
    day = DaySchedule(day=1, slots=[_slot("X", 1200, 1300)])
    result = ScheduleResult(days=[day], total_estimated_cost=10.0)
    constraints = ScheduleConstraints(days=1, day_end_min=1260)
    v = validate(result, constraints)
    assert not v.valid
    assert any("day_end_min" in msg for msg in v.violations)


def test_validate_flags_budget_overrun():
    day = DaySchedule(day=1, slots=[_slot("X", 540, 660, cost=999.0)])
    result = ScheduleResult(days=[day], total_estimated_cost=999.0)
    constraints = ScheduleConstraints(days=1, activities_budget=100.0)
    v = validate(result, constraints)
    assert not v.valid
    assert any("exceeds activities_budget" in msg for msg in v.violations)


def test_validate_ignores_budget_when_none_given():
    day = DaySchedule(day=1, slots=[_slot("X", 540, 660, cost=999.0)])
    result = ScheduleResult(days=[day], total_estimated_cost=999.0)
    constraints = ScheduleConstraints(days=1, activities_budget=None)
    v = validate(result, constraints)
    assert v.valid
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_validator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scheduling.validator'`

- [ ] **Step 3: Write validator.py**

Create `backend/app/scheduling/validator.py`:

```python
from dataclasses import dataclass, field
from typing import List

from app.scheduling.models import ScheduleConstraints, ScheduleResult


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    violations: List[str] = field(default_factory=list)


def validate(result: ScheduleResult, constraints: ScheduleConstraints) -> ValidationResult:
    """
    Independently re-checks a ScheduleResult against ScheduleConstraints -- a
    trust-but-verify safety net over build_schedule's own logic, and the reusable
    seed for Phase 4's hard-constraint plan verifier.
    """
    violations: List[str] = []

    for day_schedule in result.days:
        prev_end = None
        for slot in day_schedule.slots:
            if slot.start_min < constraints.day_start_min:
                violations.append(
                    f"Day {day_schedule.day}: slot '{slot.name}' starts before day_start_min"
                )
            if slot.end_min > constraints.day_end_min:
                violations.append(
                    f"Day {day_schedule.day}: slot '{slot.name}' ends after day_end_min"
                )
            if prev_end is not None and slot.start_min < prev_end:
                violations.append(
                    f"Day {day_schedule.day}: slot '{slot.name}' overlaps the previous slot"
                )
            prev_end = slot.end_min

    if constraints.activities_budget is not None and result.total_estimated_cost > constraints.activities_budget + 1e-6:
        violations.append(
            f"Total estimated cost {result.total_estimated_cost} exceeds activities_budget {constraints.activities_budget}"
        )

    return ValidationResult(valid=not violations, violations=violations)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_validator.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduling/validator.py backend/tests/scheduling/test_validator.py
git commit -m "feat: add independent schedule invariant validator"
```

---

## Task 8: Property-based invariant tests

Proves the invariants `validate()` checks hold universally, not just for hand-picked examples — the strongest form of the kickoff doc's "known-correct outputs" ask.

**Files:**
- Create: `backend/tests/scheduling/test_properties.py`

- [ ] **Step 1: Write the property tests**

Create `backend/tests/scheduling/test_properties.py`:

```python
import string

from hypothesis import given, settings as hyp_settings, strategies as st

from app.scheduling.models import Candidate, Coordinates, ScheduleConstraints
from app.scheduling.geo import HaversineTravelTimeProvider
from app.scheduling.scheduler import build_schedule
from app.scheduling.validator import validate

PROVIDER = HaversineTravelTimeProvider(speed_kmh=20.0)


def _candidate_strategy():
    return st.builds(
        Candidate,
        name=st.text(alphabet=string.ascii_letters, min_size=1, max_size=12),
        category=st.sampled_from(["historic", "museums", "natural", "cultural"]),
        rating=st.floats(min_value=0.0, max_value=5.0, allow_nan=False, allow_infinity=False),
        coords=st.builds(
            Coordinates,
            lat=st.floats(min_value=-60.0, max_value=60.0, allow_nan=False, allow_infinity=False),
            lon=st.floats(min_value=-170.0, max_value=170.0, allow_nan=False, allow_infinity=False),
        ),
        source=st.just("test"),
        estimated_cost=st.floats(min_value=0.0, max_value=50.0, allow_nan=False, allow_infinity=False),
        open_windows=st.none(),
        mandatory=st.just(False),
    )


@given(
    candidates=st.lists(_candidate_strategy(), min_size=0, max_size=15, unique_by=lambda c: c.name),
    days=st.integers(min_value=1, max_value=5),
    budget=st.one_of(st.none(), st.floats(min_value=0.0, max_value=500.0, allow_nan=False, allow_infinity=False)),
)
@hyp_settings(max_examples=100)
def test_build_schedule_never_violates_constraints(candidates, days, budget):
    constraints = ScheduleConstraints(days=days, activities_budget=budget)
    result = build_schedule(candidates, constraints, PROVIDER)
    validation = validate(result, constraints)
    assert validation.valid, validation.violations


@given(
    candidates=st.lists(_candidate_strategy(), min_size=0, max_size=15, unique_by=lambda c: c.name),
    days=st.integers(min_value=1, max_value=5),
)
@hyp_settings(max_examples=50)
def test_build_schedule_is_deterministic(candidates, days):
    constraints = ScheduleConstraints(days=days)
    result1 = build_schedule(candidates, constraints, PROVIDER)
    result2 = build_schedule(candidates, constraints, PROVIDER)
    assert result1 == result2


@given(
    candidates=st.lists(_candidate_strategy(), min_size=0, max_size=15, unique_by=lambda c: c.name),
    days=st.integers(min_value=1, max_value=5),
)
@hyp_settings(max_examples=50)
def test_build_schedule_always_returns_exactly_one_day_schedule_per_day(candidates, days):
    constraints = ScheduleConstraints(days=days)
    result = build_schedule(candidates, constraints, PROVIDER)
    assert [d.day for d in result.days] == list(range(1, days + 1))
```

- [ ] **Step 2: Run the tests**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/test_properties.py -v`
Expected: 3 passed. (If hypothesis finds a counterexample, it prints a minimal failing case — fix the bug it reveals in `day_selector.py`/`scheduler.py` before proceeding; do not weaken the test to make it pass.)

- [ ] **Step 3: Run the full scheduling test suite together**

Run: `docker compose run --rm --no-deps backend pytest tests/scheduling/ -v`
Expected: all tests across Tasks 2-8 pass together.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/scheduling/test_properties.py
git commit -m "test: add property-based invariant tests for the scheduler"
```

---

## Task 9: Capture real coordinates in destination_search.py

`destination_search.py` (built in Phase 1) currently discards the `point` (lat/lon) field OpenTripMap already returns. The scheduler needs real coordinates to compute travel time.

**Files:**
- Modify: `backend/app/tools/destination_search.py`
- Test: `backend/tests/tools/__init__.py` (create)
- Test: `backend/tests/tools/test_destination_search.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/tools/__init__.py` (empty file).

Create `backend/tests/tools/test_destination_search.py`:

```python
from unittest.mock import patch

from app.tools.destination_search import destination_search


MOCK_GEOCODE_RESPONSE = {"lat": 35.0, "lon": 135.0, "status": "ok"}

MOCK_RADIUS_RESPONSE = [
    {"name": "Real Temple", "kinds": "historic,religion", "rate": "3", "point": {"lat": 35.001, "lon": 135.001}},
    {"name": "No Coords Place", "kinds": "natural", "rate": "2", "point": {}},
    {"name": "", "kinds": "shops", "rate": "1", "point": {"lat": 35.002, "lon": 135.002}},
]


@patch("app.tools.destination_search.get_json")
@patch("app.tools.destination_search.settings")
def test_destination_search_captures_coordinates_and_skips_incomplete_places(mock_settings, mock_get_json):
    mock_settings.OPENTRIPMAP_API_KEY = "fake-key"
    mock_get_json.side_effect = [MOCK_GEOCODE_RESPONSE, MOCK_RADIUS_RESPONSE]

    # destination_search() calls _geocode() internally, and _geocode is ALSO
    # independently @ttl_cache-decorated -- clearing only the outer cache isn't
    # enough, or a stale cached geocode result from an earlier test run could mask
    # this test's mocked response.
    from app.tools.destination_search import _geocode
    destination_search.cache_clear()
    _geocode.cache_clear()
    result = destination_search("Testville")

    assert result["results_count"] == 1
    activity = result["activities"][0]
    assert activity["name"] == "Real Temple"
    assert activity["lat"] == 35.001
    assert activity["lon"] == 135.001
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm --no-deps backend pytest tests/tools/test_destination_search.py -v`
Expected: FAIL — `AssertionError` (activities currently have no `lat`/`lon` keys) or `KeyError`.

- [ ] **Step 3: Update destination_search.py to capture coordinates**

Modify `backend/app/tools/destination_search.py` — replace the activity-building loop inside `destination_search()`:

```python
    activities = []
    for place in places:
        name = place.get("name")
        point = place.get("point") or {}
        lat, lon = point.get("lat"), point.get("lon")
        if not name or lat is None or lon is None:
            continue
        kinds = (place.get("kinds") or "").split(",")
        activities.append({
            "name": name,
            "category": kinds[0] if kinds and kinds[0] else "attraction",
            "rating": _RATE_TO_SCORE.get(str(place.get("rate")), 3.0),
            "lat": lat,
            "lon": lon,
        })
```

This replaces the existing loop that only captured `name`/`category`/`rating`. Places missing a name or coordinates are skipped rather than defaulting to fabricated `(0, 0)` coordinates, which would silently corrupt travel-time math.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm --no-deps backend pytest tests/tools/test_destination_search.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/destination_search.py backend/tests/tools/__init__.py backend/tests/tools/test_destination_search.py
git commit -m "feat: capture real POI coordinates in destination_search"
```

---

## Task 10: Capture real hotel coordinates

Amadeus's `hotel-offers` response already includes `hotel.latitude`/`hotel.longitude`; `hotel_search.py` (Phase 1) currently discards them. This is what makes "the day starts from the hotel" a real travel-time calculation instead of a fabricated zero.

**Files:**
- Modify: `backend/app/tools/hotel_search.py`
- Modify: `backend/app/schemas/accommodation.py`
- Modify: `backend/app/agents/accommodation.py`
- Test: `backend/tests/tools/test_hotel_search.py`
- Test: `backend/tests/agents/__init__.py` (create)
- Test: `backend/tests/agents/test_accommodation.py`

- [ ] **Step 1: Write the failing test for hotel_search.py**

Create `backend/tests/tools/test_hotel_search.py`:

```python
from unittest.mock import patch

from app.tools.hotel_search import hotel_search


MOCK_OFFERS_RESPONSE = {
    "data": [
        {
            "hotel": {"name": "Real Hotel", "latitude": 35.5, "longitude": 135.5, "rating": "4"},
            "offers": [{"price": {"total": "150.00", "currency": "USD"}}],
        }
    ]
}


@patch("app.tools.hotel_search.get_json")
@patch("app.tools.hotel_search._get_access_token", return_value="fake-token")
def test_hotel_search_captures_hotel_coordinates(mock_token, mock_get_json):
    mock_get_json.side_effect = [
        {"data": [{"iataCode": "TST"}]},
        {"data": [{"hotelId": "H1"}]},
        MOCK_OFFERS_RESPONSE,
    ]

    # _resolve_city_code is ALSO independently @ttl_cache-decorated -- same reasoning
    # as _geocode in test_destination_search.py, clear it too so a stale cached city
    # code from an earlier test run can't mask this test's mocked responses.
    from app.tools.hotel_search import _resolve_city_code
    hotel_search.cache_clear()
    _resolve_city_code.cache_clear()
    result = hotel_search("Testville", "2026-10-01", "2026-10-08")

    assert result["results_count"] == 1
    hotel = result["hotels"][0]
    assert hotel["lat"] == 35.5
    assert hotel["lon"] == 135.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm --no-deps backend pytest tests/tools/test_hotel_search.py -v`
Expected: FAIL — `KeyError: 'lat'`

- [ ] **Step 3: Update hotel_search.py to capture coordinates**

Modify `backend/app/tools/hotel_search.py` — in `hotel_search()`, update the hotel-building loop:

```python
        hotels.append({
            "name": hotel_info.get("name", "Unknown Hotel"),
            "price_per_night": price,
            "currency": cheapest_offer["price"].get("currency", "EUR"),
            # Amadeus's hotel-offers response doesn't reliably include a star rating;
            # 0.0 (rather than None) so downstream min_rating filtering doesn't crash.
            "rating": hotel_info.get("rating") or 0.0,
            "amenities": hotel_info.get("amenities", []),
            "lat": hotel_info.get("latitude"),
            "lon": hotel_info.get("longitude"),
        })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm --no-deps backend pytest tests/tools/test_hotel_search.py -v`
Expected: 1 passed.

- [ ] **Step 5: Add lat/lon to AccommodationOption**

Modify `backend/app/schemas/accommodation.py` — update the `AccommodationOption` class:

```python
class AccommodationOption(BaseModel):
    hotel: str = Field(..., description="Name of the accommodation")
    price: float = Field(..., description="Price per night")
    rating: float = Field(..., description="Guest rating out of 5")
    lat: Optional[float] = Field(default=None, description="Latitude, when known from a real API")
    lon: Optional[float] = Field(default=None, description="Longitude, when known from a real API")
```

- [ ] **Step 6: Write the failing test for accommodation.py wiring**

Create `backend/tests/agents/__init__.py` (empty file).

Create `backend/tests/agents/test_accommodation.py`:

```python
from unittest.mock import patch

from app.schemas.accommodation import AccommodationRequest
from app.agents.accommodation import rule_based_recommend


MOCK_HOTEL_DATA = {
    "hotels": [
        {"name": "Real Hotel", "price_per_night": 150.0, "rating": 4.5, "amenities": ["WiFi"], "lat": 35.5, "lon": 135.5},
    ]
}


@patch("app.agents.accommodation.hotel_search", return_value=MOCK_HOTEL_DATA)
def test_rule_based_recommend_carries_coordinates_through(mock_hotel_search):
    req = AccommodationRequest(location="Testville")
    results = rule_based_recommend(req)

    assert len(results) == 1
    assert results[0].lat == 35.5
    assert results[0].lon == 135.5
```

- [ ] **Step 7: Run test to verify it fails**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_accommodation.py -v`
Expected: FAIL — `AssertionError` (`results[0].lat` is `None`).

- [ ] **Step 8: Wire coordinates through in accommodation.py**

Modify `backend/app/agents/accommodation.py` — in `rule_based_recommend()`, update the `AccommodationOption` construction:

```python
        results.append({
            "option": AccommodationOption(
                hotel=name,
                price=price,
                rating=rating,
                lat=h.get("lat"),
                lon=h.get("lon"),
            ),
            "match_count": match_count
        })
```

- [ ] **Step 9: Run test to verify it passes**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_accommodation.py -v`
Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add backend/app/tools/hotel_search.py backend/app/schemas/accommodation.py backend/app/agents/accommodation.py backend/tests/tools/test_hotel_search.py backend/tests/agents/__init__.py backend/tests/agents/test_accommodation.py
git commit -m "feat: capture real hotel coordinates end-to-end for scheduler start location"
```

---

## Task 11: Widen itinerary schemas

Adds the request fields the orchestrator needs to pass through (budget cap, hotel location), the structured/traceable slot output, and a narration-only schema for the LLM.

**Files:**
- Modify: `backend/app/schemas/itinerary.py`

- [ ] **Step 1: Rewrite schemas/itinerary.py**

Replace the full contents of `backend/app/schemas/itinerary.py`:

```python
from pydantic import BaseModel, Field
from typing import List, Optional


class ItineraryRequest(BaseModel):
    destination: str = Field(..., description="Target destination for the itinerary")
    days: int = Field(..., ge=1, le=30, description="Number of days for the trip")
    interests: List[str] = Field(default_factory=list, description="User interests for sightseeing filters")
    weather_score: Optional[int] = Field(default=None, description="Travel weather suitability score")
    activities_budget: Optional[float] = Field(default=None, description="Total budget available for activities across the whole trip")
    accommodation_lat: Optional[float] = Field(default=None, description="Latitude of the recommended accommodation, if known")
    accommodation_lon: Optional[float] = Field(default=None, description="Longitude of the recommended accommodation, if known")


class ScheduledSlotOut(BaseModel):
    name: str = Field(..., description="Real attraction name, traceable to the source API call")
    category: str = Field(..., description="Attraction category")
    source: str = Field(..., description="Which tool/API this fact came from, e.g. 'opentripmap'")
    start_time: str = Field(..., description="Scheduled start time, HH:MM 24h")
    end_time: str = Field(..., description="Scheduled end time, HH:MM 24h")
    travel_minutes_from_previous: float = Field(..., description="Estimated travel time from the previous stop")
    estimated_cost: float = Field(..., description="Heuristic per-visit cost estimate")


class DailySchedule(BaseModel):
    day: int = Field(..., description="Day number of the trip (1-indexed)")
    morning: str = Field(..., description="Morning activity description")
    afternoon: str = Field(..., description="Afternoon activity description")
    evening: str = Field(..., description="Evening activity description")
    slots: List[ScheduledSlotOut] = Field(default_factory=list, description="Structured, traceable schedule for the day, in order")


class ItineraryResponse(BaseModel):
    destination: str = Field(..., description="Name of the destination")
    itinerary: List[DailySchedule]
    warnings: List[str] = Field(default_factory=list, description="Constraint issues the scheduler could not fully resolve")


class DayNarration(BaseModel):
    day: int = Field(..., description="Day number this narration is for")
    morning: str
    afternoon: str
    evening: str


class NarrationResponse(BaseModel):
    days: List[DayNarration]
```

- [ ] **Step 2: Verify the schema module imports cleanly**

Run: `docker compose run --rm --no-deps backend python -c "from app.schemas.itinerary import ItineraryRequest, ScheduledSlotOut, DailySchedule, ItineraryResponse, DayNarration, NarrationResponse; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/itinerary.py
git commit -m "feat: widen itinerary schemas for scheduler integration and narration-only LLM output"
```

---

## Task 12: Rewrite agents/itinerary.py — mandatory scheduler backbone

Retires `DESTINATION_DATABASE` and the old ad hoc fallback logic entirely. `generate_itinerary()` always builds the schedule deterministically first; an LLM, if configured, only narrates prose for already-decided slots.

**Files:**
- Modify: `backend/app/agents/itinerary.py`
- Test: `backend/tests/agents/test_itinerary.py`

- [ ] **Step 1: Write the failing integration tests**

Create `backend/tests/agents/test_itinerary.py`:

```python
from unittest.mock import patch

from app.schemas.itinerary import ItineraryRequest
from app.agents.itinerary import generate_itinerary


MOCK_ACTIVITIES = [
    {"name": "Mock Temple", "category": "historic", "rating": 4.8, "lat": 35.0, "lon": 135.0},
    {"name": "Mock Garden", "category": "natural", "rating": 4.5, "lat": 35.001, "lon": 135.001},
    {"name": "Mock Market", "category": "cultural", "rating": 4.2, "lat": 35.002, "lon": 135.002},
]


def _mock_search_result(query, category=None):
    return {"destination": query, "results_count": len(MOCK_ACTIVITIES), "activities": MOCK_ACTIVITIES, "source": "opentripmap"}


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_only_schedules_real_mocked_places(mock_search):
    req = ItineraryRequest(destination="Testville", days=1)
    response = generate_itinerary(req)

    real_names = {a["name"] for a in MOCK_ACTIVITIES}
    scheduled_names = {slot.name for day in response.itinerary for slot in day.slots}

    assert len(scheduled_names) > 0
    assert scheduled_names.issubset(real_names)


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_deterministic_narration_mentions_real_names(mock_search):
    req = ItineraryRequest(destination="Testville", days=1)
    response = generate_itinerary(req)

    day = response.itinerary[0]
    combined_text = f"{day.morning} {day.afternoon} {day.evening}"
    assert any(slot.name in combined_text for slot in day.slots)


@patch(
    "app.agents.itinerary.destination_search",
    return_value={"destination": "Nowhere", "results_count": 0, "activities": [], "source": "unavailable"},
)
def test_generate_itinerary_returns_honest_warning_when_no_data(mock_search):
    req = ItineraryRequest(destination="Nowhere", days=2)
    response = generate_itinerary(req)

    assert all(len(day.slots) == 0 for day in response.itinerary)
    assert len(response.warnings) > 0


@patch("app.agents.itinerary.destination_search", side_effect=_mock_search_result)
def test_generate_itinerary_respects_activities_budget(mock_search):
    # Each mock activity costs at least DEFAULT_ACTIVITY_COST or a category rate;
    # a budget of 0 should schedule nothing.
    req = ItineraryRequest(destination="Testville", days=1, activities_budget=0.0)
    response = generate_itinerary(req)

    scheduled_names = {slot.name for day in response.itinerary for slot in day.slots}
    assert scheduled_names == set()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_itinerary.py -v`
Expected: FAIL (current `generate_itinerary` doesn't populate `day.slots`, has no `warnings` handling of this shape, doesn't respect `activities_budget`).

- [ ] **Step 3: Rewrite agents/itinerary.py**

Replace the full contents of `backend/app/agents/itinerary.py`:

```python
import json
import logging
from typing import List, Optional, Tuple

from app.core.config import settings
from app.schemas.itinerary import (
    ItineraryRequest,
    DailySchedule,
    ItineraryResponse,
    ScheduledSlotOut,
    DayNarration,
    NarrationResponse,
)
from app.tools.destination_search import destination_search
from app.scheduling.models import Candidate, Coordinates, ScheduleConstraints, ScheduleResult, DaySchedule as SchedulerDaySchedule
from app.scheduling.scheduler import build_schedule
from app.scheduling.validator import validate
from app.scheduling.geo import HaversineTravelTimeProvider
from app.scheduling.costs import StaticCostEstimator

logger = logging.getLogger("app.agents.itinerary")


def _fetch_candidates(destination: str) -> List[Candidate]:
    """Real points of interest, converted to scheduler Candidates. Returns [] (not
    fake data) if destination_search is unavailable or the location can't be
    resolved."""
    try:
        activities = destination_search(destination).get("activities", [])
    except Exception as e:
        logger.error(f"destination_search failed for {destination!r}: {e}")
        return []

    estimator = StaticCostEstimator()
    candidates = []
    for a in activities:
        lat, lon = a.get("lat"), a.get("lon")
        if lat is None or lon is None:
            continue
        category = a.get("category", "attraction")
        candidates.append(Candidate(
            name=a["name"],
            category=category,
            rating=float(a.get("rating", 3.0)),
            coords=Coordinates(lat=lat, lon=lon),
            source="opentripmap",
            estimated_cost=estimator.estimate(category),
        ))
    return candidates


def _minutes_to_hhmm(minutes: float) -> str:
    total = int(round(minutes)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def _build_schedule_result(req: ItineraryRequest, candidates: List[Candidate]) -> ScheduleResult:
    start_location = None
    if req.accommodation_lat is not None and req.accommodation_lon is not None:
        start_location = Coordinates(lat=req.accommodation_lat, lon=req.accommodation_lon)

    constraints = ScheduleConstraints(
        days=req.days,
        start_location=start_location,
        activities_budget=req.activities_budget,
    )
    result = build_schedule(candidates, constraints, HaversineTravelTimeProvider())

    validation = validate(result, constraints)
    if not validation.valid:
        logger.error(f"Scheduler produced an invalid result for {req.destination!r}: {validation.violations}")

    return result


def _deterministic_narration(day_schedule: SchedulerDaySchedule) -> Tuple[str, str, str]:
    texts = [
        f"Visit {slot.name} ({slot.category}). ~{round(slot.travel_min_from_previous)} min travel from the previous stop."
        for slot in day_schedule.slots
    ]
    while len(texts) < 3:
        texts.append("Free time to explore at your own pace.")
    return texts[0], texts[1], texts[2]


def _llm_narration(req: ItineraryRequest, result: ScheduleResult) -> Optional[List[DayNarration]]:
    """Ask the LLM to write prose ONLY for the already-decided slot list -- it
    cannot reorder, invent, or drop attractions; the structured slot data always
    comes from `result`, never from this narration."""
    slot_summary = []
    for day_schedule in result.days:
        stops = [
            f"{s.name} ({_minutes_to_hhmm(s.start_min)}-{_minutes_to_hhmm(s.end_min)})"
            for s in day_schedule.slots
        ]
        slot_summary.append(f"Day {day_schedule.day}: {', '.join(stops) if stops else 'no stops scheduled'}")

    prompt = (
        f"You are writing narrative descriptions for an already-finalized trip itinerary to {req.destination}. "
        f"The schedule below is FIXED — do not add, remove, reorder, or rename any stop. "
        f"For each day, write a 1-2 sentence description for morning, afternoon, and evening covering only the "
        f"stops listed for that day (if a time slot has no stop, write a short free-time suggestion).\n\n"
        + "\n".join(slot_summary)
    )

    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=NarrationResponse
                )
            )
            data = json.loads(response.text)
            return NarrationResponse(**data).days
        except Exception as e:
            logger.error(f"Gemini itinerary narration failed, falling back: {str(e)}")

    if settings.OPENAI_API_KEY:
        try:
            from app.core.llm import generate_structured_output
            return generate_structured_output(prompt, NarrationResponse).days
        except Exception as e:
            logger.error(f"OpenAI/Groq itinerary narration failed, falling back: {str(e)}")

    return None


def generate_itinerary(req: ItineraryRequest) -> ItineraryResponse:
    """
    Generate a day-by-day itinerary. The deterministic scheduler always decides
    which real attraction goes in which slot (respecting travel time and budget);
    an LLM, if configured, only narrates prose for those already-decided slots and
    cannot alter the schedule.
    """
    candidates = _fetch_candidates(req.destination)
    result = _build_schedule_result(req, candidates)

    narrations_by_day = {}
    llm_narrations = _llm_narration(req, result)
    if llm_narrations:
        narrations_by_day = {n.day: n for n in llm_narrations}

    daily_schedules = []
    for day_schedule in result.days:
        narration = narrations_by_day.get(day_schedule.day)
        if narration:
            morning, afternoon, evening = narration.morning, narration.afternoon, narration.evening
        else:
            morning, afternoon, evening = _deterministic_narration(day_schedule)

        slots_out = [
            ScheduledSlotOut(
                name=s.name,
                category=s.category,
                source=s.source,
                start_time=_minutes_to_hhmm(s.start_min),
                end_time=_minutes_to_hhmm(s.end_min),
                travel_minutes_from_previous=s.travel_min_from_previous,
                estimated_cost=s.estimated_cost,
            )
            for s in day_schedule.slots
        ]

        daily_schedules.append(DailySchedule(
            day=day_schedule.day,
            morning=morning,
            afternoon=afternoon,
            evening=evening,
            slots=slots_out,
        ))

    return ItineraryResponse(
        destination=req.destination,
        itinerary=daily_schedules,
        warnings=result.warnings,
    )
```

This deletes `DESTINATION_DATABASE`, `rule_based_generate()`, and the old ad hoc "3-per-day modulo" indexing entirely — there is no code path left that invents structure instead of scheduling it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_itinerary.py -v`
Expected: 4 passed.

- [ ] **Step 5: Run the full backend test suite**

Run: `docker compose run --rm --no-deps backend pytest -v`
Expected: all tests from Tasks 1-12 pass together.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/itinerary.py backend/tests/agents/test_itinerary.py
git commit -m "feat: make the deterministic scheduler the mandatory itinerary backbone

Retires DESTINATION_DATABASE and the old ad hoc fallback logic. The LLM,
when configured, now only narrates prose for slots the scheduler already
decided -- it cannot reorder, invent, or drop attractions. Without a key,
deterministic templated narration is built straight from the schedule."
```

---

## Task 13: Wire orchestrator's itinerary_node

Passes the trip's activities budget (already computed by the budget node, which runs before itinerary in the graph) and the top accommodation pick's coordinates into `ItineraryRequest`.

**Files:**
- Modify: `backend/app/agents/orchestrator.py`
- Test: `backend/tests/agents/test_orchestrator_itinerary_node.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/agents/test_orchestrator_itinerary_node.py`:

```python
from unittest.mock import patch

from app.agents.orchestrator import itinerary_node
from app.schemas.understanding import TripRequirements
from app.schemas.budget import BudgetBreakdown
from app.schemas.accommodation import AccommodationOption
from app.schemas.weather import WeatherIntelligence
from app.schemas.itinerary import ItineraryRequest, ItineraryResponse


def test_itinerary_node_passes_budget_and_accommodation_coords_through():
    captured = {}

    def fake_generate_itinerary(req: ItineraryRequest) -> ItineraryResponse:
        captured["req"] = req
        return ItineraryResponse(destination=req.destination, itinerary=[], warnings=[])

    state = {
        "logs": [],
        "retries": 0,
        "destination": "Testville",
        "requirements": TripRequirements(destination="Testville", days=3, people=2, interests=[]),
        "weather": WeatherIntelligence(temperature="25C", rain_probability="10%", suitability_score=80, warnings=[]),
        "budget": BudgetBreakdown(travel_cost=0, accommodation_cost=0, food_cost=0, activities_cost=240.0, buffer=0, total=240.0),
        "accommodation": [AccommodationOption(hotel="Test Hotel", price=100.0, rating=4.5, lat=35.0, lon=135.0)],
    }

    with patch("app.agents.orchestrator.generate_itinerary", side_effect=fake_generate_itinerary):
        itinerary_node(state)

    assert captured["req"].activities_budget == 240.0
    assert captured["req"].accommodation_lat == 35.0
    assert captured["req"].accommodation_lon == 135.0


def test_itinerary_node_handles_no_accommodation_gracefully():
    captured = {}

    def fake_generate_itinerary(req: ItineraryRequest) -> ItineraryResponse:
        captured["req"] = req
        return ItineraryResponse(destination=req.destination, itinerary=[], warnings=[])

    state = {
        "logs": [],
        "retries": 0,
        "destination": "Testville",
        "requirements": TripRequirements(destination="Testville", days=2, people=1, interests=[]),
        "weather": None,
        "budget": None,
        "accommodation": [],
    }

    with patch("app.agents.orchestrator.generate_itinerary", side_effect=fake_generate_itinerary):
        itinerary_node(state)

    assert captured["req"].activities_budget is None
    assert captured["req"].accommodation_lat is None
    assert captured["req"].accommodation_lon is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_orchestrator_itinerary_node.py -v`
Expected: FAIL — `AttributeError` or `AssertionError` (`ItineraryRequest` construction in `itinerary_node` doesn't yet pass these fields).

- [ ] **Step 3: Update itinerary_node in orchestrator.py**

Modify `backend/app/agents/orchestrator.py` — in `itinerary_node()`, between the `weather_score` computation and the `ItineraryRequest` construction, add:

```python
    weather_score = None
    if state["weather"]:
        weather_score = state["weather"].suitability_score

    activities_budget = None
    if state["budget"]:
        activities_budget = state["budget"].activities_cost

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
```

This replaces the existing `weather_score` block and `ItineraryRequest(...)` construction in that function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm --no-deps backend pytest tests/agents/test_orchestrator_itinerary_node.py -v`
Expected: 2 passed.

- [ ] **Step 5: Run the full backend test suite**

Run: `docker compose run --rm --no-deps backend pytest -v`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/orchestrator.py backend/tests/agents/test_orchestrator_itinerary_node.py
git commit -m "feat: wire activities budget and accommodation coordinates into itinerary_node"
```

---

## Task 14: Live verification and DECISIONS.md

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Bring up db + backend for a live check**

Use the same local port-override approach as Phases 0-1 to avoid colliding with any other project's Postgres container on this machine (temporarily edit `docker-compose.yml`'s `db` port from `5433:5432` to an unused local port, e.g. `5544:5432`, and add a matching `POSTGRES_PORT` override — or reuse a saved override file from earlier phases if still present). Bring up with:

```bash
docker compose up -d db backend
```

Wait for `Application startup complete` in `docker compose logs backend --tail 20`.

- [ ] **Step 2: Verify a real destination schedules real, traceable attractions**

```bash
curl -s -X POST http://localhost:8000/api/v1/itinerary/generate -H "Content-Type: application/json" -d '{"destination":"Kyoto","days":2}' | python3 -m json.tool
```

Expected: real named attractions in `itinerary[].slots[]` (not the old hardcoded Kinkaku-ji/Fushimi Inari narrative text), each slot has `start_time`/`end_time`/`travel_minutes_from_previous`/`estimated_cost`/`source`, and the `morning`/`afternoon`/`evening` text mentions those same real names.

- [ ] **Step 3: Verify the budget cap is actually enforced**

```bash
curl -s -X POST http://localhost:8000/api/v1/itinerary/generate -H "Content-Type: application/json" -d '{"destination":"Kyoto","days":2,"activities_budget":0}' | python3 -m json.tool
```

Expected: every day has `slots: []` and `warnings` explains why (budget exhausted).

- [ ] **Step 4: Verify honest failure for an unresolvable destination**

```bash
curl -s -X POST http://localhost:8000/api/v1/itinerary/generate -H "Content-Type: application/json" -d '{"destination":"Zzqxwblahfake123","days":2}' | python3 -m json.tool
```

Expected: empty `slots` for every day, `warnings` present, no fabricated place names or generic filler text (confirming `DESTINATION_DATABASE` and the old generic-template fallback are actually gone, not just bypassed).

- [ ] **Step 5: Tear down and restore docker-compose.yml exactly**

```bash
docker compose down
git checkout -- docker-compose.yml
git status --short docker-compose.yml
```
Expected: no output from the last command (file matches committed state).

- [ ] **Step 6: Update DECISIONS.md**

Add a "## Phase 3 — Deterministic scheduling core" section to `DECISIONS.md` summarizing: the new `backend/app/scheduling/` package and its test coverage (unit, property-based, integration), the coordinate-capture fixes to `destination_search.py`/`hotel_search.py`, the retirement of `DESTINATION_DATABASE`, the live verification results from Steps 2-4, and a pointer to the design spec and this plan.

- [ ] **Step 7: Commit**

```bash
git add DECISIONS.md
git commit -m "docs: log Phase 3 deterministic scheduling core completion"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec maps to a task — domain models (Task 2), ports/geo adapter (Task 3), cost adapter (Task 4), DP-knapsack + brute-force ordering algorithm (Task 5), cross-day orchestration + repeat fallback (Task 6), independent validator (Task 7), property-based invariants (Task 8), coordinate capture in both tool files (Tasks 9-10), schema widening (Task 11), the mandatory-backbone rewrite of `generate_itinerary` (Task 12), orchestrator wiring (Task 13), and live verification + documentation (Task 14). Explicitly-out-of-scope items (real routing API, opening hours, OR-Tools, the `accommodation.py` LLM-pricing precedence bug) have no tasks, matching the spec.
- **No placeholders:** every step has complete, runnable code — no TBD/TODO, no "add appropriate tests" without the actual test code.
- **Type consistency checked:** `Candidate.estimated_cost` (Task 2) is set once via `StaticCostEstimator` in `_fetch_candidates` (Task 12) and read directly in `day_selector.py` (Task 5) — `CostEstimator` is not re-threaded through the allocator, only used at candidate-construction time, consistent across all tasks that touch it. `ScheduleConstraints.max_slots_per_day`, `day_start_min`, `day_end_min`, `visit_duration_min` field names match between `models.py` (Task 2) and every consumer (`day_selector.py`, `scheduler.py`, `validator.py`, `itinerary.py`). `AccommodationOption.lat`/`.lon` (Task 10) match the field names read in `orchestrator.py`'s `itinerary_node` (Task 13) and `ItineraryRequest.accommodation_lat`/`.accommodation_lon` (Task 11).
