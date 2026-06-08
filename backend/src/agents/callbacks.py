from google.adk.tools import ToolContext
from src.api.hitl_events import HITLRequiredEvent
from src.core.config import get_settings

class HITLRequiredException(Exception):
    def __init__(self, tool_name: str, arguments: dict):
        self.tool_name = tool_name
        self.arguments = arguments


def enforce_hitl_policy_callback(callback_context: ToolContext, tool_call):
    """Programmatic chokepoint for all write actions."""
    settings = get_settings()
    
    tool_name = tool_call.name
    if tool_name not in settings.SENSITIVE_TOOLS:
        return

    state = callback_context.state

    # 1. Check for global auto-approval preference
    if state.get("auto_approve") is True:
        return

    # 2. Check if this specific tool call was ALREADY approved
    # This ID would be injected into the state by your resolve_hitl endpoint
    approved_action_id = state.get("last_approved_hitl_id") # TODO

    if not approved_action_id:
        # Halt execution and trigger the HITL flow
        raise HITLRequiredException(tool_name=tool_name, arguments=tool_call.args)
