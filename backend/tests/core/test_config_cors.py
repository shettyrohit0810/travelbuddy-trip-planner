"""Both env formats must work.

Regression: the field carries NoDecode so this validator owns all parsing. An earlier
version handled only the comma-separated form and returned JSON-array strings
unparsed, so `BACKEND_CORS_ORIGINS=["http://x"]` crashed startup with a bare
`list_type` error -- the exact format that worked before NoDecode was introduced.
"""
import pytest

from app.core.config import Settings


@pytest.mark.parametrize("raw,expected", [
    ("http://a.com,http://b.com", ["http://a.com", "http://b.com"]),
    (" http://a.com , http://b.com ", ["http://a.com", "http://b.com"]),
    ('["http://a.com","http://b.com"]', ["http://a.com", "http://b.com"]),
    ('  ["http://a.com"]  ', ["http://a.com"]),
    ("http://a.com", ["http://a.com"]),
])
def test_cors_origins_accepts_both_formats(raw, expected):
    assert Settings.assemble_cors_origins(raw) == expected


def test_cors_origins_passes_lists_through():
    assert Settings.assemble_cors_origins(["http://a.com"]) == ["http://a.com"]
