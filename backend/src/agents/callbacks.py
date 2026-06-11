from typing import Any

from google.adk.tools import ToolContext
from src.core.config import get_settings


class HITLRequiredException(Exception):
    def __init__(self, tool_name: str, arguments: dict):
        self.tool_name = tool_name
        self.arguments = arguments


def enforce_hitl_policy_callback(
    tool: Any,
    args: dict[str, Any],
    tool_context: ToolContext,
) -> dict | None:
    """Programmatic chokepoint for all write actions."""
    settings = get_settings()

    tool_name: str = getattr(tool, "name", "")
    if tool_name not in settings.SENSITIVE_TOOLS:
        return None

    state = tool_context.state

    if state.get("auto_approve") is True:
        return None

    approved_action_id = state.get("last_approved_hitl_id")  # TODO
    if not approved_action_id:
        raise HITLRequiredException(tool_name=tool_name, arguments=args)

    return None
