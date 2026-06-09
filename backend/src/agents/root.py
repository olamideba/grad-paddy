import logging
from datetime import datetime, timezone

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.adk.planners import BuiltInPlanner
from google.genai import types

from src.agents.domain import build_domain_orchestrator_agent
from src.agents.internal import build_internal_app_agent
from src.services.memory_service import MemoryService

logger = logging.getLogger(__name__)


async def _inject_date(callback_context: CallbackContext) -> None:
    callback_context.state["current_date"] = datetime.now(timezone.utc).strftime(
        "%A, %d %B %Y"
    )


async def _inject_memories(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> LlmResponse | None:
    """Append the user's persistent memories to the system prompt.

    Fires before every root-agent LLM call.  Retrieves the top-K most recently
    updated memories from Elasticsearch and injects them as a <USER_MEMORIES>
    block so the agent has cross-session context without the agent needing to
    call a tool first.
    """
    user_id = callback_context.state.get("user_id")
    if not user_id:
        return None
    try:
        memories = await MemoryService.search_memory(user_id=str(user_id))
        if not memories:
            return None
        facts = "\n".join(f"- {m['fact']}" for m in memories)
        memory_block = (
            "\n\n<USER_MEMORIES>\n"
            "You know the following about this user from past sessions:\n"
            f"{facts}\n"
            "</USER_MEMORIES>"
        )
        if llm_request.config is None:
            llm_request.config = types.GenerateContentConfig(
                system_instruction=memory_block
            )
        else:
            existing = llm_request.config.system_instruction or ""
            llm_request.config.system_instruction = existing + memory_block
    except Exception as exc:
        logger.warning("Memory injection failed: %s", exc)
    return None


def _enable_thinking(agent: object, _seen: set[int] | None = None) -> None:
    """Enable Gemini thought summaries on every LlmAgent in the tree.

    ag_ui_adk translates thought parts into REASONING_* events, surfacing live
    reasoning in the chat feed for all agents."""
    _seen = _seen if _seen is not None else set()
    if id(agent) in _seen:
        return
    _seen.add(id(agent))
    if isinstance(agent, LlmAgent):
        agent.planner = BuiltInPlanner(
            thinking_config=types.ThinkingConfig(include_thoughts=True)
        )
    for sub in getattr(agent, "sub_agents", None) or []:
        _enable_thinking(sub, _seen)


root_agent = LlmAgent(
    name="grad_paddy",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Graduate school orchestrator that separates internal app-state work from domain reasoning."
    ),
    before_agent_callback=_inject_date,
    before_model_callback=_inject_memories,
    sub_agents=[
        build_internal_app_agent(),
        build_domain_orchestrator_agent(),
    ],
    instruction=(
        "Today's date is {current_date}.\n"
        "\n"
        "You are the top-level coordinator for the Grad Paddy system.\n"
        "\n"
        "## Intent Classification (do this first, before any routing)\n"
        "Before routing to any sub-agent, classify the user's message:\n"
        "- CASUAL: Greetings, small talk, expressions of gratitude, affirmations, open-ended questions "
        "  not related to graduate admissions (e.g. 'Hi', 'How are you?', 'Thanks!', 'What can you do?', "
        "  'What next?'). Respond DIRECTLY and BRIEFLY yourself. DO NOT route to any sub-agent.\n"
        "- AMBIGUOUS: The intent is unclear. Ask ONE short clarifying question. DO NOT route to any sub-agent.\n"
        "- ACTIONABLE: A clear request related to graduate school applications, research, profile, tracker, "
        "  SOP, outreach, or any app-specific task. Route to the appropriate sub-agent below.\n"
        "\n"
        "## Routing Rules (ACTIONABLE messages only)\n"
        "- Route internal CRUD and session updates (profile, preferences, tracker, shortlist, etc.) to the internal application agent.\n"
        "- Route faculty discovery, deep-dive analysis, SOP translation, outreach prep, application-tracking analysis, funding flags, research framing, and deep research to the domain orchestrator.\n"
        "- Keep the conversation moving with the smallest safe action first, then delegate further if needed.\n"
        "- Preserve room for additional subagents and chain-based workflows.\n"
        "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
    ),
)

_enable_thinking(root_agent)
