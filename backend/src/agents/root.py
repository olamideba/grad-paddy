import logging
from datetime import datetime, timezone
from time import perf_counter

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.adk.planners import BuiltInPlanner
from google.genai import types

from src.agents.domain import build_domain_orchestrator_agent
from src.agents.internal import build_internal_app_agent
from src.services.memory_service import MemoryService

logger = logging.getLogger(__name__)

USER_CONTEXT_STATE_KEY = "user_context_block"
USER_CONTEXT_LOADED_KEY = "_user_context_loaded"


async def _load_user_context(callback_context: CallbackContext) -> None:
    """Fires before the root agent runs.

    Sets the date every turn, and loads the user's cross-session MEMORIES once
    per session (cached in state via USER_CONTEXT_LOADED_KEY) — within-session
    context is already carried by the chat history, so re-fetching each turn adds
    only latency. The injection itself happens in _inject_user_context (no I/O).

    Profile/preferences are deliberately NOT preloaded here. The agents already
    fetch them via tools when relevant (reliably, as observed), and the Firestore
    read is the expensive part we want OFF the time-to-first-token path. Memory is
    injected instead because it has no reliable tool trigger, and its empty-query
    recall is cheap over the pooled, startup-warmed Elastic connection.
    """
    callback_context.state["current_date"] = datetime.now(timezone.utc).strftime(
        "%A, %d %B %Y"
    )

    # Per-session cache: only the first turn pays the memory fetch.
    if callback_context.state.get(USER_CONTEXT_LOADED_KEY):
        return

    user_id = callback_context.state.get("user_id")
    if not user_id:
        return

    started = perf_counter()
    try:
        memories = await MemoryService.search_memory(user_id=str(user_id))
    except Exception as exc:
        logger.warning("Memory context load failed: %s", exc)
        memories = []

    if memories:
        facts = "\n".join(f"- {m['fact']}" for m in memories)
        callback_context.state[USER_CONTEXT_STATE_KEY] = (
            "\n\n<USER_MEMORIES>\n"
            "Things learned about this user in past sessions:\n"
            f"{facts}\n"
            "</USER_MEMORIES>"
        )
    callback_context.state[USER_CONTEXT_LOADED_KEY] = True
    logger.info(
        "Memory context loaded in %.0f ms (%d memories)",
        (perf_counter() - started) * 1000,
        len(memories),
    )


def _inject_user_context(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> LlmResponse | None:
    """Append the pre-loaded user-context block to an agent's system prompt.

    No I/O — reads the block that _load_user_context placed in state, so it is
    cheap to run before every model call across the whole agent tree.
    """
    block = callback_context.state.get(USER_CONTEXT_STATE_KEY)
    if not block:
        return None
    if llm_request.config is None:
        llm_request.config = types.GenerateContentConfig(  # type: ignore[assignment]
            system_instruction=block
        )
    else:
        existing = llm_request.config.system_instruction or ""
        llm_request.config.system_instruction = existing + block
    return None


def _enable_context_injection(agent: object, _seen: set[int] | None = None) -> None:
    """Attach _inject_user_context as the before_model callback on every LlmAgent
    in the tree, so sub-agents (faculty discovery, SOP, etc.) are grounded too —
    reusing the state loaded once at the root, with no extra I/O."""
    _seen = _seen if _seen is not None else set()
    if id(agent) in _seen:
        return
    _seen.add(id(agent))
    if isinstance(agent, LlmAgent):
        agent.before_model_callback = _inject_user_context
    for sub in getattr(agent, "sub_agents", None) or []:
        _enable_context_injection(sub, _seen)


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
            thinking_config=types.ThinkingConfig(
                include_thoughts=True,
                thinking_budget=-1,
            )
        )
    for sub in getattr(agent, "sub_agents", None) or []:
        _enable_thinking(sub, _seen)


root_agent = LlmAgent(
    name="grad_paddy",
    model="gemini-3.1-flash-lite-preview",
    description=(
        "Graduate school orchestrator that separates internal app-state work from domain reasoning."
    ),
    before_agent_callback=_load_user_context,
    before_model_callback=_inject_user_context,
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
_enable_context_injection(root_agent)
