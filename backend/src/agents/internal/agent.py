from google.adk.agents import LlmAgent

from src.agents.subagents import build_account_agent, build_application_agent, build_governance_agent


def build_internal_app_agent() -> LlmAgent:
    """Internal application layer agent that owns app-state operations."""
    return LlmAgent(
        name="internal_app_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Internal application layer agent for Grad Paddy. "
            "Handles user state, app state, session management, and internal CRUD workflows."
        ),
        sub_agents=[
            build_account_agent(),
            build_application_agent(),
            build_governance_agent(),
        ],
        instruction=(
            "You manage the internal application layer only.\n"
            "- Use this branch for profile, preferences, sessions, groups, shortlist, tracker, drafts, and HITL state.\n"
            "- Keep business updates structured and conservative.\n"
            "- Do not take over domain-specific faculty discovery, deep-dive analysis, SOP writing, or outreach strategy unless explicitly delegated.\n"
            "- If a request spans internal state and domain reasoning, finish the internal update first, then hand the user back to the domain orchestrator.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )
