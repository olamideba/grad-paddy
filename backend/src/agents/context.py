from google.adk.tools import ToolContext

USER_ID_STATE_KEY = "user_id"


def require_user_id(tool_context: ToolContext) -> str:
    """Return the authenticated user id from agent session state."""
    user_id = tool_context.state.get(USER_ID_STATE_KEY)
    if not user_id:
        raise ValueError("Missing user_id in agent session state")
    return str(user_id)

