from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
from src.services.faculty_service import FacultyService

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
    model="gemini-3.1-pro-preview",
    description=("Agent specialized in performing Google searches."),
    sub_agents=[],
    instruction="Use the GoogleSearchTool to find information on the web.",
    tools=[GoogleSearchTool()],
)
grad_paddy_url_context_agent = LlmAgent(
    name="grad_paddy_url_context_agent",
    model="gemini-3.1-pro-preview",
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
    1. Call search_faculty_profiles to find matching professors
    2. Call get_faculty_papers to get their recent publications  
    3. Call score_faculty_fit to assess alignment with the student
    4. Call get_conversation_angles for specific outreach talking points

    Always reference actual paper titles and research themes.
    Never generate generic talking points.""",
    tools=[
        FacultyService.search_faculty_profiles,
        FacultyService.get_faculty_papers,
        FacultyService.score_faculty_fit,
        FacultyService.get_conversation_angles,
    ],
)
root_agent = LlmAgent(
    name="grad_paddy",
    model="gemini-3.1-pro-preview",
    description=(
        "This is an graduate school search and application orchestrator root agent that reasons and delegates tasks to various sub-agents."
    ),
    sub_agents=[planner, researcher, faculty_researcher],
    instruction="- Ask the user for more details if they are vague in describing what they want.\n- When the user's intent is clear, call the planner agent\n- Call the research agent when you need to verify or provide options to the user",
    tools=[
        agent_tool.AgentTool(agent=grad_paddy_google_search_agent),
        agent_tool.AgentTool(agent=grad_paddy_url_context_agent),
    ],
)
