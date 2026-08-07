"""Provider resolution.

Every supported backend speaks the OpenAI wire format, so they differ only by base_url
and model. These tests exist because a mis-resolved provider fails at request time with
an opaque auth error rather than at configuration time.
"""
import pytest

from app.core import config, llm


@pytest.fixture(autouse=True)
def _clear_keys(monkeypatch):
    monkeypatch.setattr(config.settings, "XAI_API_KEY", None, raising=False)
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", None, raising=False)


def test_no_keys_means_no_provider():
    assert config.settings.LLM_PROVIDER is None


@pytest.mark.parametrize("attr,value,expected", [
    ("XAI_API_KEY", "xai-abc", "xai"),
    ("OPENAI_API_KEY", "gsk_abc", "groq"),
    ("OPENAI_API_KEY", "sk-abc", "openai"),
])
def test_provider_is_resolved_from_the_key(monkeypatch, attr, value, expected):
    monkeypatch.setattr(config.settings, attr, value, raising=False)
    assert config.settings.LLM_PROVIDER == expected
    assert llm.get_model_name() == llm.PROVIDERS[expected]["model"]


def test_xai_routes_to_its_own_base_url(monkeypatch):
    monkeypatch.setattr(config.settings, "XAI_API_KEY", "xai-abc", raising=False)
    client = llm.get_openai_client()
    assert "api.x.ai" in str(client.base_url)


def test_helpers_raise_clearly_when_nothing_is_configured():
    with pytest.raises(RuntimeError, match="No LLM provider configured"):
        llm.get_model_name()
    with pytest.raises(RuntimeError, match="No LLM provider configured"):
        llm.get_openai_client()
