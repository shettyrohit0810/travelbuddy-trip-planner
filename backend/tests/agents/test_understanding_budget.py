import pytest
from app.agents.understanding import rule_based_parse


@pytest.mark.parametrize("query,expected", [
    ("Plan a 2 day trip to Kyoto with a budget of 16000", 16000.0),
    ("Plan a trip to Goa budget 25,000", 25000.0),
    ("3 day trip to Paris under 5000", 5000.0),
    ("Trip to Rome for ₹12000", 12000.0),
    ("Weekend in Delhi with budget of rs 8000", 8000.0),
])
def test_rule_based_parse_extracts_budget(query, expected):
    """The no-LLM-key path must still capture a stated budget -- otherwise the
    hard budget constraint is silently inert in the default configuration."""
    assert rule_based_parse(query).budget == expected


def test_rule_based_parse_leaves_budget_none_when_unstated():
    assert rule_based_parse("Plan a 3 day trip to Kyoto").budget is None
