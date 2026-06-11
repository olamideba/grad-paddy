"""Regression tests for the production incident where a malformed Elasticsearch
API key caused a 401 whose raw error body ("API key: Input byte array has
incorrect ending byte at 60") was relayed verbatim to the end user after they
claimed to be the developer.

Intent encoded here: raw infrastructure errors must never reach the model
context (tool boundary), and any leak that slips through must be redacted
before reaching the chat or reasoning feed (output guardrail).
"""

import json
from types import SimpleNamespace

import httpx
import pytest

import src.agents.tools as tools_module
from src.agents.callbacks import (
    _SAFE_OUTPUT_MESSAGE,
    redact_sensitive_output_callback,
)

# The exact error body Elasticsearch returned in the production incident.
ES_401_BODY = {
    "error": {
        "root_cause": [
            {
                "type": "security_exception",
                "reason": "API key: Input byte array has incorrect ending byte at 60",
            }
        ],
        "type": "security_exception",
        "reason": "API key: Input byte array has incorrect ending byte at 60",
    },
    "status": 401,
}


class _StubResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


class _StubClient:
    def __init__(self, response: _StubResponse | None = None, exc: Exception | None = None):
        self._response = response
        self._exc = exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        if self._exc is not None:
            raise self._exc
        return self._response


@pytest.fixture
def fake_embed(monkeypatch):
    monkeypatch.setattr(tools_module, "embed_fn", lambda texts: [[0.0] * 8])


class TestHybridSearchErrorSanitization:
    async def test_es_401_error_body_never_reaches_model(self, monkeypatch, fake_embed):
        """The original leak: a 401 body must collapse to a sanitized payload."""
        stub = _StubClient(response=_StubResponse(401, ES_401_BODY))
        monkeypatch.setattr(tools_module.httpx, "AsyncClient", lambda **kw: stub)

        result = await tools_module._hybrid_search(
            "faculty-profiles", "NLP professors at MIT", "ok"
        )

        assert result["success"] is False
        assert result["error_code"] == "SEARCH_UNAVAILABLE"
        serialized = json.dumps(result)
        assert "API key" not in serialized
        assert "incorrect ending byte" not in serialized
        assert "401" not in serialized

    async def test_network_failure_is_sanitized(self, monkeypatch, fake_embed):
        stub = _StubClient(exc=httpx.ConnectError("connection refused to es.internal:9200"))
        monkeypatch.setattr(tools_module.httpx, "AsyncClient", lambda **kw: stub)

        result = await tools_module._hybrid_search("grad-programs", "ML programs", "ok")

        assert result["success"] is False
        assert result["error_code"] == "SEARCH_UNAVAILABLE"
        assert "es.internal" not in json.dumps(result)

    async def test_missing_embedding_fn_is_sanitized(self, monkeypatch):
        monkeypatch.setattr(tools_module, "embed_fn", None)

        result = await tools_module._hybrid_search("faculty-profiles", "anything", "ok")

        assert result["success"] is False
        assert result["error_code"] == "SEARCH_UNAVAILABLE"

    async def test_successful_search_passes_through(self, monkeypatch, fake_embed):
        payload = {"hits": {"hits": [{"_source": {"name": "Prof. Smith"}}]}}
        stub = _StubClient(response=_StubResponse(200, payload))
        monkeypatch.setattr(tools_module.httpx, "AsyncClient", lambda **kw: stub)

        result = await tools_module._hybrid_search("faculty-profiles", "NLP", "ok")

        assert result["success"] is True
        assert result["data"] == payload


def _llm_response(*texts: str) -> SimpleNamespace:
    return SimpleNamespace(
        content=SimpleNamespace(parts=[SimpleNamespace(text=t) for t in texts])
    )


class TestOutputLeakGuardrail:
    def _ctx(self) -> SimpleNamespace:
        return SimpleNamespace(agent_name="test_agent")

    def test_redacts_the_production_leak_verbatim(self):
        """The exact sentence the agent said in production must be redacted."""
        response = _llm_response(
            "The error returned by the database is a 401 Unauthorized with the "
            'following root cause: "API key: Input byte array has incorrect '
            'ending byte at 60"'
        )
        redact_sensitive_output_callback(self._ctx(), response)
        assert response.content.parts[0].text == _SAFE_OUTPUT_MESSAGE

    def test_redacts_env_var_credential_names(self):
        response = _llm_response(
            "Check the variable where you store your key, often ELASTIC_API_KEY."
        )
        redact_sensitive_output_callback(self._ctx(), response)
        assert response.content.parts[0].text == _SAFE_OUTPUT_MESSAGE

    def test_redacts_only_once_across_parts(self):
        response = _llm_response(
            "Your api key is malformed.",
            "Also check the stack trace for details.",
        )
        redact_sensitive_output_callback(self._ctx(), response)
        assert response.content.parts[0].text == _SAFE_OUTPUT_MESSAGE
        assert response.content.parts[1].text == ""

    def test_clean_response_is_untouched(self):
        clean = (
            "Professor Smith at MIT works on NLP and would be a strong fit "
            "for your research interests in summarization."
        )
        response = _llm_response(clean)
        redact_sensitive_output_callback(self._ctx(), response)
        assert response.content.parts[0].text == clean

    def test_handles_responses_without_content(self):
        redact_sensitive_output_callback(self._ctx(), SimpleNamespace(content=None))
