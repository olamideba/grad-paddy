from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool, url_context
from google.adk.tools.google_search_tool import GoogleSearchTool

from src.agents.tools import (
    ACCOUNT_TOOLS,
    APPLICATION_TOOLS,
    GOVERNANCE_TOOLS,
    GROUP_TOOLS,
    OPERATIONS_TOOLS,
    SESSION_TOOLS,
)


def build_web_search_agent(name: str) -> LlmAgent:
    """Agent specialized in web search."""
    return LlmAgent(
        name=name,
        model="gemini-2.5-flash",
        description="Agent specialized in performing Google searches.",
        sub_agents=[],
        instruction="Use the GoogleSearchTool to find information on the web.",
        tools=[GoogleSearchTool()],
    )


def build_url_context_agent(name: str) -> LlmAgent:
    """Agent specialized in fetching content from URLs."""
    return LlmAgent(
        name=name,
        model="gemini-2.5-flash",
        description="Agent specialized in fetching content from URLs.",
        sub_agents=[],
        instruction="Use the UrlContextTool to retrieve content from provided URLs.",
        tools=[url_context],
    )


def build_planner_agent() -> LlmAgent:
    """Agent that decomposes user requests into actionable plans."""
    return LlmAgent(
        name="planner",
        model="gemini-2.5-flash",
        description="Plans the trajectory needed to accomplish a user task.",
        sub_agents=[],
        instruction=(
            "You are the planning specialist for the grad-paddy system. "
            "Break vague requests into a small, ordered plan. "
            "When information needs verification, call the search and URL helper agents. "
            "When a request is ready to execute, hand it to the domain specialist."
        ),
        tools=[
            agent_tool.AgentTool(agent=build_web_search_agent("planner_google_search_agent")),
            agent_tool.AgentTool(agent=build_url_context_agent("planner_url_context_agent")),
        ],
    )


def build_researcher_agent() -> LlmAgent:
    """Agent that gathers evidence and options."""
    return LlmAgent(
        name="researcher",
        model="gemini-2.5-flash",
        description="Researches and verifies information for the application workflow.",
        sub_agents=[],
        instruction=(
            "You are the research specialist for the grad-paddy system. "
            "Use the helper agents to verify facts, compare options, and gather supporting evidence."
        ),
        tools=[
            agent_tool.AgentTool(agent=build_web_search_agent("researcher_google_search_agent")),
            agent_tool.AgentTool(agent=build_url_context_agent("researcher_url_context_agent")),
        ],
    )


def build_account_agent() -> LlmAgent:
    """Agent for user account, sessions, and group management."""
    return LlmAgent(
        name="account_agent",
        model="gemini-3.1-pro-preview",
        description="Manages user profiles, preferences, sessions, and groups.",
        sub_agents=[],
        instruction=(
            "You handle identity, preferences, session lifecycle, and groups. "
            "Use the tools to read and update the current user's data. "
            "Prefer concise, structured updates and preserve existing values unless the user asks to change them."
        ),
        tools=ACCOUNT_TOOLS + SESSION_TOOLS + GROUP_TOOLS,
    )


def build_application_agent() -> LlmAgent:
    """Agent for shortlist, tracker, and drafts."""
    return LlmAgent(
        name="application_agent",
        model="gemini-3.1-pro-preview",
        description="Manages shortlist, tracker, and draft workflows.",
        sub_agents=[],
        instruction=(
            "You handle application planning artifacts: shortlist entries, tracker records, and drafts. "
            "Use the tools to keep these records in sync with the user's current application workflow."
        ),
        tools=APPLICATION_TOOLS,
    )


def build_governance_agent() -> LlmAgent:
    """Agent for human approval and HITL flows."""
    return LlmAgent(
        name="governance_agent",
        model="gemini-3.1-pro-preview",
        description="Handles human-in-the-loop approval requests and their resolution.",
        sub_agents=[],
        instruction=(
            "You manage human approval tasks. "
            "Use the HITL tools when an operation needs explicit user approval or needs to be resumed later."
        ),
        tools=GOVERNANCE_TOOLS,
    )


def build_operations_agent() -> LlmAgent:
    """Agent that exposes the complete application capability surface."""
    return LlmAgent(
        name="operations_agent",
        model="gemini-3.1-pro-preview",
        description="Universal operations agent for all application data manipulation.",
        sub_agents=[],
        instruction=(
            "You are the operational specialist for the Grad Paddy app. "
            "Use the tools for user data, sessions, groups, shortlist, tracker, drafts, and HITL. "
            "If a task spans multiple domains, execute the smallest safe step first and hand off to the appropriate specialist when needed."
        ),
        tools=OPERATIONS_TOOLS,
    )
