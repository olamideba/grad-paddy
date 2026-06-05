from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
from src.services.faculty_service import (
    search_faculty_profiles,
    get_faculty_papers,
    score_faculty_fit,
    get_conversation_angles,
)

planner_google_search_agent = LlmAgent(
    name="planner_google_search_agent",
    model="gemini-2.5-flash",
    description=("Agent specialized in performing Google searches."),
    sub_agents=[],
    instruction="Use the GoogleSearchTool to find information on the web.",
    tools=[GoogleSearchTool()],
)
planner_url_context_agent = LlmAgent(
    name="planner_url_context_agent",
    model="gemini-2.5-flash",
    description=("Agent specialized in fetching content from URLs."),
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)
planner = LlmAgent(
    name="planner",
    model="gemini-2.5-flash",
    description=(
        "This agent plans out the entire trajectory to accomplish the user's task"
    ),
    sub_agents=[],
    instruction="The grad-paddy root agent assigns a task for you to plan, please plan it",
    tools=[
        agent_tool.AgentTool(agent=planner_google_search_agent),
        agent_tool.AgentTool(agent=planner_url_context_agent),
    ],
)
researcher_google_search_agent = LlmAgent(
    name="researcher_google_search_agent",
    model="gemini-2.5-flash",
    description=("Agent specialized in performing Google searches."),
    sub_agents=[],
    instruction="Use the GoogleSearchTool to find information on the web.",
    tools=[GoogleSearchTool()],
)
researcher_url_context_agent = LlmAgent(
    name="researcher_url_context_agent",
    model="gemini-2.5-flash",
    description=("Agent specialized in fetching content from URLs."),
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)
researcher = LlmAgent(
    name="researcher",
    model="gemini-2.5-flash",
    description=("This agent researches"),
    sub_agents=[],
    instruction="You research indepth",
    tools=[
        agent_tool.AgentTool(agent=researcher_google_search_agent),
        agent_tool.AgentTool(agent=researcher_url_context_agent),
    ],
)
grad_paddy_google_search_agent = LlmAgent(
    name="grad_paddy_google_search_agent",
    # model="gemini-3.1-pro-preview",
    model="gemini-2.5-flash",
    description=("Agent specialized in performing Google searches."),
    sub_agents=[],
    instruction="Use the GoogleSearchTool to find information on the web.",
    tools=[GoogleSearchTool()],
)
grad_paddy_url_context_agent = LlmAgent(
    name="grad_paddy_url_context_agent",
    # model="gemini-3.1-pro-preview",
    model="gemini-2.5-flash",
    description=("Agent specialized in fetching content from URLs."),
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)
faculty_researcher = LlmAgent(
    name="faculty_researcher",
    model="gemini-2.5-flash",
    description=(
        "Finds professors by research area, retrieves papers, "
        "scores fit against student profile, generates conversation angles."
    ),
    sub_agents=[],
    instruction="""You are a faculty research specialist.
    When given a research area or faculty name:
    Always follow this sequence:
    1. search_faculty_profiles — find relevant faculty from Elastic Search
    2. get_faculty_papers — get REAL papers for each faculty member
    3. score_faculty_fit — pass the real papers_summary from step 2
    4. get_conversation_angles — pass the real paper_titles from step 2

    NEVER pass made-up paper titles to score_faculty_fit or get_conversation_angles.
    Only use titles returned by get_faculty_papers.""",
    tools=[
        search_faculty_profiles,
        get_faculty_papers,
        score_faculty_fit,
        get_conversation_angles,
    ],
)
root_agent = LlmAgent(
    name="grad_paddy",
    # model="gemini-3.1-pro-preview",
    model="gemini-2.5-flash",
    description=(
        "This is an graduate school search and application orchestrator root agent that reasons and delegates tasks to various sub-agents."
    ),
    sub_agents=[planner, researcher, faculty_researcher],
    instruction="""
    - Ask the user for more details if they are vague in describing what they want.
    - When the user's intent is clear, call the planner agent
    - Call the research agent when you need to verify or provide options to the user

    Routing rules:
    - Program search, deadlines, funding → call researcher
    - Multi-step planning → call planner
    - ANY of these → call faculty_researcher:
    - "find professors working on X"
    - "who should I email about X research"  
    - "score my fit with Prof X"
    - "help me write a cold email to Prof X"
    - "conversation starters for Prof X"
    - "faculty at X university working on Y"
    """,
    tools=[
        agent_tool.AgentTool(agent=grad_paddy_google_search_agent),
        agent_tool.AgentTool(agent=grad_paddy_url_context_agent),
    ],
)
