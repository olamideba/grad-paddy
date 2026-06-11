from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import agent_tool

from src.agents.domain.chains import (
    build_outreach_prep_chain,
    build_research_narrative_framing_chain,
    build_sop_translation_chain,
)
from src.agents.elastic_mcp import build_elastic_mcp_tools
from src.agents.tools import SCRAPER_TOOLS, HYBRID_SEARCH_TOOLS, FACULTY_DEEP_DIVE_TOOLS
from src.agents.memory_tools import MEMORY_TOOLS
from src.agents.subagents import build_web_search_agent
from src.services.ingestion_service import IngestionService

NO_LEAK_RULE = (
    "Never mention sensitive data like the user's id and job id."
)

def build_faculty_discovery_agent() -> LlmAgent:
    """Discover, rank, and format faculty candidates from external evidence."""
    hybrid_search_tool = HYBRID_SEARCH_TOOLS[0]
    elastic_tools = build_elastic_mcp_tools()
    all_tools = [hybrid_search_tool] + elastic_tools
    return LlmAgent(
        name="faculty_discovery_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Finds and ranks faculty using Elastic hybrid search and evidence retrieval."
        ),
        static_instruction=(
            "You are the faculty discovery specialist.\n"
            "- ALWAYS prefer using the 'hybrid_faculty_search' tool when a user describes an academic research domain or asks for specific types of professors.\n"
            "- Prefer Elastic search and ES|QL evidence over unsupported recall.\n"
            "- For now, focus on the reasoning contract: rank candidates, explain the evidence, and surface missing data clearly.\n"
            "- Never fabricate publications, availability, or contact details.\n"
            "- Return results in a structured ranked list with a short rationale per candidate.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=all_tools,
    )

def build_program_deep_dive_agent() -> LlmAgent:
    """Analyze, evaluate, and detail graduate university programs and requirements."""
    hybrid_search_tool = HYBRID_SEARCH_TOOLS[1]
    elastic_tools = build_elastic_mcp_tools()
    all_tools = [hybrid_search_tool] + elastic_tools
    
    return LlmAgent(
        name="program_deep_dive_agent",
        model="gemini-2.5-pro",
        description=(
            "Queries and synthesizes university graduate program deadlines, fees, and requirements."
        ),
        instruction=(
            "You are the graduate program admissions specialist.\n"
            "- ALWAYS prefer using the 'hybrid_program_search' tool when asked about application steps, fees, deadlines, or program requirements.\n"
            "- Extract structural fields like application_fee and deadline explicitly from the database response data.\n"
            "- Cross-reference multiple options if the user is comparing universities.\n"
            "- Highlight strict deadlines clearly in your final response layout.\n"
            "- Never fabricate requirements or make up pricing details.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=all_tools,
    )

def build_faculty_profile_deep_dive_agent() -> LlmAgent:
    """Analyze faculty profiles, papers, and fit in depth."""
    faculty_deep_dive_tools = FACULTY_DEEP_DIVE_TOOLS
    elastic_tools = build_elastic_mcp_tools()
    all_tools = elastic_tools + faculty_deep_dive_tools
    return LlmAgent(
        name="faculty_profile_deep_dive_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Performs paper retrieval, fit scoring, and conversation-angle generation for a faculty profile."
        ),
        static_instruction=(
            "You are the faculty profile deep-dive specialist.\n"
            "- Use Elastic MCP tools alongside the get_faculty_papers when available to retrieve faculty profiles, publications, program pages, and prior user decisions.\n"
            "- ALWAYS prefer using the get_faculty_papers, score_faculty_fit, get_conversation_angles tools when a user asks for matching scores, custom advisors, or personalized outreach talking points.\n"
            "- Translate papers into fit signals, research themes, and conversation angles.\n"
            "- Distinguish evidence from inference.\n"
            "- If the evidence is weak or conflicting, say so explicitly.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=all_tools,
    )


def build_sop_translation_agent() -> SequentialAgent:
    """Prompt-chain agent for SOP translation."""
    return build_sop_translation_chain()


def build_outreach_prep_agent() -> SequentialAgent:
    """Prompt-chain agent for outreach preparation."""
    return build_outreach_prep_chain()


def build_application_tracker_agent() -> LlmAgent:
    """Track applications, deadlines, and weekly summaries over ES CRM data."""
    elastic_tools = build_elastic_mcp_tools()
    return LlmAgent(
        name="application_tracker_agent",
        model="gemini-3.1-flash-lite-preview",
        description="Tracks deadlines, status, and weekly summaries using Elastic evidence and ES|QL.",
        instruction=(
            "You are the application tracker specialist.\n"
            "- Use Elastic MCP tools when available to search tracker evidence and run ES|QL deadline/readiness summaries.\n"
            "- Surface deadlines, stale items, missing steps, and next actions.\n"
            "- Keep weekly summaries concise and operational.\n"
            "- Do not invent statuses; if data is incomplete, surface gaps.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=elastic_tools,
    )


def build_funding_requirement_flag_detection_agent() -> LlmAgent:
    """Detect funding and requirement flags from ES-backed records."""
    elastic_tools = build_elastic_mcp_tools()
    return LlmAgent(
        name="funding_requirement_flag_detection_agent",
        model="gemini-3.1-flash-lite-preview",
        description="Flags funding and requirement issues from ES-backed application data.",
        instruction=(
            "You are the funding and requirement flag detection specialist.\n"
            "- Use Elastic MCP tools when available to search funding/requirements evidence and run ES|QL risk scans.\n"
            "- Detect funding constraints, missing prerequisites, deadline conflicts, and other blocking requirements.\n"
            "- Return a clear list of flags with severity and rationale.\n"
            "- Separate explicit evidence from inferred risk.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=elastic_tools,
    )


def build_ingestion_pipeline_agent() -> LlmAgent:
    """
    Agent that handles the full scrape → chunk → embed → index pipeline.
    Called when the user provides a URL that needs to be ingested into ES.

    Flow:
      1. check_url_indexed  — avoid re-scraping already indexed URLs
      2. ingest_url         — scrape → clean → chunk → embed → index
    """
    return LlmAgent(
        name="ingestion_pipeline_agent",
        model="gemini-3.1-flash-lite-preview",
        description=(
            "Handles the full data ingestion pipeline for grad program and faculty URLs. "
            "Scrapes the URL, chunks and embeds the content, and indexes it into "
            "Elasticsearch so it can be searched by other agents."
        ),
        sub_agents=[],
        instruction=(
            "You are the data ingestion specialist for the grad-paddy system. "
            "Your job is to take a URL from the user and get it into the database.\n\n"
            "Use the tools to execute the job"

            "Always follow this exact sequence:\n"
            "1. Call check_url_indexed(url) first\n"
            "   - If already indexed: Do NOT re-ingest.\n"
            "   - If already indexed: inform the user that the the data exists in the database"
            "   and ask what they would like to know about the data.\n"
            "   - If not indexed: proceed to step 2\n\n"
            "2. Determine url_type:\n"
            "   - 'faculty' if the URL contains /people/, /faculty/, /role/faculty, "
            "     or /directory/faculty\n"
            "   - 'program' if the URL contains programs/, /graduate-programs/, "
            "     or /graduate-admissions/"

            "3. Call ingest_url(url, url_type, user_id)\n"
            "   - It returns immediately with a job_id\n"
            "   - Tell the user: 'Ingestion is running in the background. "

            "4. If the user asks for a status update, call check_ingestion_status(job_id)\n"
            "   - running: tell them it's still in progress\n"
            "   - complete: tell them how many chunks were indexed\n"
            "   - failed: tell them what went wrong\n\n"
             
            "Be concise. The user just wants to know it worked.\n"
            f"{NO_LEAK_RULE}"
        ),
        tools=SCRAPER_TOOLS
    )


def build_research_narrative_framing_agent() -> SequentialAgent:
    """Prompt-chain agent for research narrative framing."""
    return build_research_narrative_framing_chain()


def build_domain_orchestrator_agent() -> LlmAgent:
    """Route domain intent to the correct specialist and manage approval gates."""
    return LlmAgent(
        name="domain_orchestrator_agent",
        model="gemini-3.1-pro-preview",
        description="Routes domain work to the correct Grad Paddy specialist agent.",
        tools=[
            *build_elastic_mcp_tools(),
            *MEMORY_TOOLS,
            agent_tool.AgentTool(
                agent=build_web_search_agent("domain_google_search_agent")
            ),
        ],
        sub_agents=[
            build_faculty_discovery_agent(),
            build_program_deep_dive_agent(),
            build_faculty_profile_deep_dive_agent(),
            build_sop_translation_agent(),
            build_outreach_prep_agent(),
            build_application_tracker_agent(),
            build_funding_requirement_flag_detection_agent(),
            build_research_narrative_framing_agent(),
            build_ingestion_pipeline_agent(),
        ],
        static_instruction=(
            "You are the domain orchestrator for Grad Paddy.\n"
            "- Route user intent to the correct specialist agent.\n"
            "- If the request is ambiguous, ask one clarifying question before selecting a branch.\n"
            "- Use faculty_discovery_agent for broad faculty searches: when the user describes a "
            "research domain, asks to find or rank professors, or wants a list of candidates backed "
            "by keyword/hybrid search. Do NOT use it for per-faculty fit scores, paper analysis, "
            "or conversation angles.\n"
            "- Use faculty_profile_deep_dive_agent when the user explicitly focuses on a single "
            "faculty member and wants fit scores, match reasoning, recent paper analysis, or "
            "personalised outreach conversation angles.\n"
            "- Use program_deep_dive_agent for anything about graduate program details: application "
            "steps, fees, deadlines, requirements, or cross-university comparisons.\n"
            "- Use SOP translation for multi-step SOP drafting and rewriting.\n"
            "- Use outreach prep for summaries, talking points, and draft CRM notes.\n"
            "- Use application tracker for Elastic-backed deadline, readiness, and status analysis.\n"
            "- Use funding and requirement flag detection for blocking conditions and readiness checks.\n"
            "- Use research narrative framing when the user needs the story that connects their evidence to the program or faculty.\n"
            "- Use ingestion pipeline only when the user provides a URL that needs to be scraped "
            "and indexed into the database. Do not route general research questions here.\n"
            "- For real-time or current information not in Elastic (e.g. upcoming intake dates, current application deadlines, "
            "recent faculty news), call domain_google_search_agent directly — do NOT ask the user for URLs.\n"
            "- MEMORY: After any interaction where the user reveals important information about themselves, "
            "call save_memory to persist it for future sessions. Save: research interests, academic background, "
            "target programs or faculty, application strategy decisions, SOP framing choices, funding constraints, "
            "timeline goals, or any explicitly stated preference. Write facts in third person: "
            "'User is targeting NLP programs with a focus on healthcare AI.' "
            "Use search_memory when the user references past decisions or you need background context not in this session. "
            "Use delete_memory when the user explicitly asks to forget something.\n"
            "- Treat outward-facing actions, CRM writes, and any irreversible change as requiring explicit user confirmation.\n"
            "- Do not perform writes without an approval gate. Prepare the payload, explain the consequence, and wait for confirmation.\n"
            "- Keep responses structured and tell the user which specialist owns the current step.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )
