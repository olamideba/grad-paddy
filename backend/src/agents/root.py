from datetime import datetime, timezone

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.planners import BuiltInPlanner
from google.genai import types

from src.agents.domain import build_domain_orchestrator_agent
from src.agents.internal import build_internal_app_agent


async def _inject_date(callback_context: CallbackContext) -> None:
    callback_context.state["current_date"] = datetime.now(timezone.utc).strftime(
        "%A, %d %B %Y"
    )


def _enable_thinking(agent: object, _seen: set[int] | None = None) -> None:
    """Turn on Gemini thought summaries for an agent and all of its sub-agents.

    With include_thoughts=True the model emits thought parts; ag_ui_adk
    translates those into REASONING_* events, which the chat surfaces live in
    the thought-process feed so the agent's work is no longer a black box. The
    visible answer is unaffected — thoughts stream on a separate channel."""
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
    model="gemini-3.1-pro-preview",
    description=(
        "Graduate school orchestrator that separates internal app-state work from domain reasoning."
    ),
    before_agent_callback=_inject_date,
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

# Surface model reasoning live on sub-agents only; the root agent does
# intent classification/routing and doesn't need deep thinking.
for _sub in root_agent.sub_agents:
    _enable_thinking(_sub)
