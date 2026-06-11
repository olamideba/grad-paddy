import logging
import re
from typing import Any

from google.adk.tools import ToolContext
from src.core.config import get_settings

logger = logging.getLogger(__name__)

# Destructive / irreversible actions that must ALWAYS go through the human
# approval gate, even when the user has turned on auto_approve. auto_approve is a
# convenience for low-stakes writes (creates/updates); it must never silently
# bulk-delete a user's records.
ALWAYS_GATE_TOOLS = frozenset(
    {"delete_application", "delete_draft", "delete_shortlist_faculty"}
)


def enforce_hitl_policy_callback(
    tool: Any,
    args: dict[str, Any],
    tool_context: ToolContext,
) -> dict | None:
    """Single safety chokepoint for write actions.

    There is exactly ONE approval gate in the system: the request_hitl tool. The
    agent opens it, the human approves, and the backend applies the change
    deterministically (HITLService._apply_change). This callback does NOT open a
    second gate — it is a passive backstop that blocks a sensitive tool from
    being called *directly* (bypassing request_hitl). The only time a direct call
    is allowed is under auto_approve, and even then never for destructive ops.

    Returning a dict short-circuits the tool (the dict becomes its result), so a
    blocked call surfaces as a normal tool error the agent can recover from by
    opening the gate — it never executes the write.
    """
    settings = get_settings()

    tool_name: str = getattr(tool, "name", "")
    if tool_name not in settings.SENSITIVE_TOOLS:
        return None

    always_gate = tool_name in ALWAYS_GATE_TOOLS
    if tool_context.state.get("auto_approve") is True and not always_gate:
        return None

    logger.warning(
        "Blocked direct call to gated tool '%s' (always_gate=%s); agent must use request_hitl.",
        tool_name,
        always_gate,
    )
    return {
        "success": False,
        "error_code": "APPROVAL_REQUIRED",
        "message": (
            "This action requires human approval and is applied by the system once approved. "
            "Do NOT call this tool directly. Open the approval gate by calling request_hitl with "
            "the entity, action, ref_id (for update/delete), and fields/content, then stop and wait."
        ),
    }


# ── Output leak guardrail ─────────────────────────────────────────────────────
# Last line of defense: tool errors are already sanitized at the tool boundary
# and the system prompt forbids disclosing internals, but anything that slips
# through (e.g. an unsanitized tool, a prompt-injected instruction) is caught
# here before it reaches the chat or the live reasoning feed.

# Case-insensitive phrases that have no legitimate place in a grad-school
# assistant's replies. Kept narrow to avoid redacting honest answers.
_LEAK_PHRASES_RE = re.compile(
    r"(?i)(?:"
    r"api[\s_-]?key"
    r"|traceback \(most recent call last\)"
    r"|stack trace"
    r"|environment variable"
    r"|elasticsearch"
    r"|\b(?:401|403|500|502|503)\s+(?:unauthorized|forbidden|internal server error|bad gateway|service unavailable)"
    r")"
)

# Uppercase env-var style credential names, e.g. ELASTIC_API_KEY, GOOGLE_SECRET.
_ENV_VAR_RE = re.compile(r"\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS?)\b")

_SAFE_OUTPUT_MESSAGE = (
    "I ran into an internal issue while preparing that response. "
    "Please try again in a moment."
)


def _contains_leak(text: str, secret_values: list[str]) -> bool:
    if any(secret in text for secret in secret_values):
        return True
    return bool(_LEAK_PHRASES_RE.search(text) or _ENV_VAR_RE.search(text))


def redact_sensitive_output_callback(
    callback_context: Any,
    llm_response: Any,
) -> None:
    """after_model callback: redact responses that leak infrastructure details.

    Scans every text part — including thought parts, which the frontend
    surfaces in the live reasoning feed — and replaces leaking text with a
    generic message. The full offending text goes to server logs only.
    """
    content = getattr(llm_response, "content", None)
    parts = getattr(content, "parts", None) or []

    settings = get_settings()
    secret_values = [
        value
        for value in (settings.ELASTIC_API_KEY.strip(), settings.ES_URL.strip())
        if value
    ]

    redacted = False
    for part in parts:
        text = getattr(part, "text", None)
        if not text:
            continue
        if _contains_leak(text, secret_values):
            logger.warning(
                "Output guardrail redacted a leaking model response (agent=%s): %r",
                getattr(callback_context, "agent_name", "unknown"),
                text[:500],
            )
            part.text = "" if redacted else _SAFE_OUTPUT_MESSAGE
            redacted = True

    return None
