from google.adk.agents import LlmAgent

from src.agents.domain import build_domain_orchestrator_agent
from src.agents.internal import build_internal_app_agent


root_agent = LlmAgent(
    name="grad_paddy",
    model="gemini-3.1-pro-preview",
    description=(
        "Graduate school orchestrator that separates internal app-state work from domain reasoning."
    ),
    sub_agents=[
        build_internal_app_agent(),
        build_domain_orchestrator_agent(),
    ],
    instruction=(
        "You are the top-level coordinator for the Grad Paddy system.\n"
        "- Keep a hard boundary between internal application-state operations and domain reasoning.\n"
        "- Route internal CRUD and session updates to the internal application agent.\n"
        "- Route faculty discovery, deep-dive analysis, SOP translation, outreach prep, application-tracking analysis, funding flags, and research framing to the domain orchestrator.\n"
        "- Ask for more detail when the request is vague.\n"
        "- Keep the conversation moving with the smallest safe action first, then delegate further if needed.\n"
        "- Preserve room for additional subagents and chain-based workflows.\n"
        "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
    ),
)
