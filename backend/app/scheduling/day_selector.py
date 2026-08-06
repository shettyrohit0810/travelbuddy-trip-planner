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
