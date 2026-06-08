from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool, url_context
from google.adk.tools.google_search_tool import GoogleSearchTool

from src.agents.tools import (
    ACCOUNT_TOOLS,
    APPLICATION_TOOLS,
    GOVERNANCE_TOOLS,
    OPERATIONS_TOOLS,
)

NO_LEAK_RULE = (
    "Never mention internal agent names, tool names, transfer steps, or implementation details to the user. "
    "Speak as one assistant and present only the outcome and any necessary natural next step."
)

APPROVAL_RULE = (
    "APPROVAL POLICY: Before any create, update, or delete action (shortlist, tracker, drafts, "
    "profile, preferences, sessions, groups), you MUST first call request_hitl with kind='approval', "
    "options_json='[{\"id\":\"yes\",\"label\":\"Approve\"},{\"id\":\"no\",\"label\":\"Reject\"}]', and a title/"
    "description stating exactly what you will change. In payload_json always include: an \"entity\" key "
    "(\"tracker\", \"shortlist\", or \"draft\"), an \"action\" key (\"create\", \"update\", or \"delete\"), and "
    "the proposed values as a \"fields\" object (for a draft, put the long text in \"content\" instead). For "
    "update/delete also include \"ref_id\" (the target id). Then WAIT for the human's decision.\n"
    "CREATING a shortlist faculty, a tracker application, or a draft: do NOT call the create tool yourself. "
    "When the human approves, the system saves the record from the payload fields (and the user's edits). "
    "Just open the gate with complete \"fields\"/\"content\". For UPDATE or DELETE, and for any OTHER create "
    "(profile, preferences, groups), perform the write yourself after approval using the (possibly edited) "
    "response values; if rejected, do not write.\n"
    "EMAILS: to email a professor or a recommender, first call create_email (status stays 'draft'), then "
    "request_hitl with kind='approval', entity=\"email\", and payload \"content\" set to the email body so the "
    "human reviews and edits it in the canvas; only after approval call send_email with the returned email id, "
    "using the edited body. Never call send_email without approval. "
    "EXCEPTION: when auto_approve is true (current value: {auto_approve}), skip the gate and perform the "
    "action directly yourself (including creates). Read-only actions never require approval."
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
            "When a request is ready to execute, hand it to the domain specialist. "
            f"{NO_LEAK_RULE}"
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
            "Use the helper agents to verify facts, compare options, and gather supporting evidence. "
            f"{NO_LEAK_RULE}"
        ),
        tools=[
            agent_tool.AgentTool(agent=build_web_search_agent("researcher_google_search_agent")),
            agent_tool.AgentTool(agent=build_url_context_agent("researcher_url_context_agent")),
        ],
    )


def build_account_agent() -> LlmAgent:
    """Agent for user account and preferences management."""
    return LlmAgent(
        name="account_agent",
        model="gemini-3.1-pro-preview",
        description="Manages user profiles and preferences.",
        sub_agents=[],
        instruction=(
            "You handle identity and preferences. "
            "Use the tools to read and update the current user's profile and preferences. "
            "When updating preferences list fields (research interests, countries, universities), "
            "always call get_preferences first to retrieve the current list, then supply the "
            "complete desired list to update_preferences — do not pass only the delta. "
            "Preserve existing values unless the user explicitly asks to change them. "
            f"{APPROVAL_RULE} "
            f"{NO_LEAK_RULE}"
        ),
        tools=ACCOUNT_TOOLS + GOVERNANCE_TOOLS,
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
            "Use the tools to keep these records in sync with the user's current application workflow. "
            f"{APPROVAL_RULE} "
            f"{NO_LEAK_RULE}"
        ),
        tools=APPLICATION_TOOLS + GOVERNANCE_TOOLS,
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
            "Use request_hitl to pause for approval, choice, or structured input before irreversible actions. "
            "Use get_pending_hitl to inspect the open gate. Humans resolve via the UI — do not resolve HITL yourself. "
            f"{NO_LEAK_RULE}"
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
            "Use the tools for user profile, preferences, shortlist, tracker, drafts, and HITL. "
            "If a task spans multiple domains, execute the smallest safe step first and hand off to the appropriate specialist when needed. "
            f"{APPROVAL_RULE} "
            f"{NO_LEAK_RULE}"
        ),
        tools=OPERATIONS_TOOLS,
    )


