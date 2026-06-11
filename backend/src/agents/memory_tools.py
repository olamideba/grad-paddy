from google.adk.tools import ToolContext

from src.agents.context import require_user_id
from src.services.memory_service import MemoryService


async def save_memory(
    fact: str,
    tags: list[str],
    tool_context: ToolContext,
) -> dict[str, object]:
    """Persist a meaningful fact about the user for future sessions.

    Call this when the user reveals something worth remembering across sessions:
    - Research interests, focus areas, or target subfields
    - Academic background (degree, GPA, institution, graduation year)
    - Target programs or universities they're applying to
    - Specific faculty members they're interested in
    - Application strategy decisions (reach/target/safety split, funding needs)
    - SOP framing choices or narrative decisions they've committed to
    - Outreach approach, timeline constraints, or stated preferences
    - Explicit "remember this" instructions from the user

    Do NOT call this for transient conversation details, tool outputs, or
    information the user hasn't confirmed as their actual preference or goal.

    Args:
        fact: A concise, self-contained statement about the user.
              Write in third person: "User is targeting NLP programs."
              Keep it short (1-2 sentences) and factual.
        tags: One or more of: research_interests, academic_background,
              application_goals, target_programs, target_faculty,
              preferences, sop_strategy, outreach_strategy, constraints

    Returns:
        dict with 'status' ("created" or "updated") and 'id'.
    """
    user_id = require_user_id(tool_context)
    session_id = tool_context.state.get("session_id", "")
    result = await MemoryService.save_memory(
        user_id=user_id,
        fact=fact,
        tags=tags,
        session_id=str(session_id),
        source="conversation",
    )
    return {"success": True, "data": result}


async def search_memory(
    query: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Search the user's memory bank for relevant past context.

    Use this when:
    - The user references a past session ("like we discussed before")
    - You need background context about their goals not present in this session
    - The user asks what you remember about them
    - You're about to make a recommendation and want to check past decisions

    The search uses hybrid semantic + keyword retrieval, so natural language
    queries work best (e.g. "research interests NLP", "target faculty MIT").

    Args:
        query: A natural language description of what context you're looking for.

    Returns:
        dict with 'memories' list, each containing 'fact', 'tags', 'updated_at'.
    """
    user_id = require_user_id(tool_context)
    memories = await MemoryService.search_memory(user_id=user_id, query=query)
    return {"success": True, "memories": memories, "count": len(memories)}


async def delete_memory(
    memory_id: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Remove a specific memory by its ID.

    Call this when the user explicitly asks to forget something
    (e.g. "forget that I said X", "remove that preference").
    First use search_memory to find the relevant memory ID, then call this.

    Args:
        memory_id: The 'id' field returned by save_memory or search_memory.

    Returns:
        dict with 'status' ("deleted" or "error").
    """
    user_id = require_user_id(tool_context)
    result = await MemoryService.delete_memory(user_id=user_id, memory_id=memory_id)
    return {"success": result["status"] == "deleted", "data": result}


MEMORY_TOOLS = [save_memory, search_memory, delete_memory]

# save_memory excluded: persistence happens in the root after_agent_callback to avoid
# competing with CRUD/HITL tools for model attention.
MEMORY_READ_TOOLS = [search_memory, delete_memory]
