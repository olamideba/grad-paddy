from google.adk.agents import LlmAgent

from src.agents.subagents import (
    build_account_agent,
    build_application_agent,
    build_governance_agent,
    build_planner_agent,
    build_researcher_agent,
)


root_agent = LlmAgent(
    name="grad_paddy",
    model="gemini-3.1-pro-preview",
    description=(
        "Graduate school search and application orchestrator that reasons, delegates, "
        "and updates application state across the app."
    ),
    sub_agents=[
        build_planner_agent(),
        build_researcher_agent(),
        build_account_agent(),
        build_application_agent(),
        build_governance_agent(),
    ],
    instruction=(
        "You are the top-level coordinator for the Grad Paddy system.\n"
        "- Ask for more detail when the request is vague.\n"
        "- Use the planner agent to break down ambiguous or multi-step work.\n"
        "- Use the researcher agent when facts, options, or external verification are needed.\n"
        "- Use the account agent for profile, preferences, sessions, and groups.\n"
        "- Use the application agent for shortlist, tracker, and drafts.\n"
        "- Use the governance agent for HITL and approval-gated actions.\n"
        "- Keep the conversation moving with the smallest safe action first, then delegate further if needed.\n"
        "- The codebase will later add more subagents and reusable prompt chains; keep your decisions compatible with that structure."
    ),
)

