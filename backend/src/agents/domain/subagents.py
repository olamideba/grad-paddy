from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import agent_tool

from src.agents.domain.chains import (
    build_outreach_prep_chain,
    build_research_narrative_framing_chain,
    build_sop_translation_chain,
)
from src.agents.elastic_mcp import build_elastic_mcp_tools
from src.agents.tools import SCRAPER_TOOLS, HYBRID_SEARCH_TOOLS, FACULTY_DEEP_DIVE_TOOLS
from src.agents.memory_tools import MEMORY_READ_TOOLS
from src.agents.subagents import build_web_search_agent
from src.services.ingestion_service import IngestionService

NO_LEAK_RULE = (
    "Never mention sensitive data like the user's id and job id."
)

# Read-only specialists must ESCALATE write intent via a real transfer, never
# refuse in prose. A sentence about "the application layer" does nothing — only
# calling transfer_to_agent moves control. The leaf hands up to its parent
# (domain_orchestrator), which then transfers to its peer internal_app_agent
# (the only branch that owns writes + the HITL gate). Both hops are
# default-allowed in ADK (no disallow_transfer_* flags are set).
ESCALATE_WRITE_RULE = (
    "WRITE REQUESTS: You are READ-ONLY and have no tools to create, update, or delete saved "
    "records. If the user asks to create, update, delete, add, remove, save, or change any saved "
    "record (shortlist faculty, tracker application, draft, recommender, profile, or preferences) — "
    "including as a follow-up to analysis you just gave — do NOT answer in prose, do NOT claim it "
    "was or wasn't saved, and do NOT tell the user to make the change themselves in the interface. "
    "Immediately call transfer_to_agent with agent_name='domain_orchestrator_agent' so the request "
    "can be routed to the application layer that owns writes."
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
            "Tool selection rules — follow these in order:\n"
            "- User specifies research area only → use find_faculty_by_research\n"
            "- User specifies research area AND university → use find_faculty_by_research_and_schools\n"
            "- User specifies university only → use find_faculty_by_university\n"
            "- User gives a vague or natural language description (e.g. 'someone working on fairness in NLP') → use hybrid_faculty_search\n"
            "- Never guess which tool to use — if the user input is ambiguous, ask one clarifying question before selecting.\n"
            "Result formatting:\n"
            "- Return a ranked list. For each candidate include: name, university, research areas, and a 1-2 sentence rationale for the match.\n"
            "- If a field is missing from the evidence, say 'not available' — never fabricate it.\n"
            "- If no results are found, tell the user clearly and suggest refining the search.\n"
            "General rules:\n"
            "- Prefer Elastic search evidence over unsupported recall.\n"
            "- Never fabricate publications, availability, or contact details.\n"
            f"{ESCALATE_WRITE_RULE}\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details. Speak as one assistant.\n"
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
        model="gemini-3.1-pro-preview",
        description=(
            "Queries and synthesizes university graduate program deadlines, fees, and requirements."
        ),
        instruction=(
            "You are the graduate program admissions specialist.\n"
            "You analyze a single known faculty member in depth.\n"
            "Tool selection rules — follow these in order:\n"
            "- User asks about deadlines or application fees for a specific program → use check_program_deadlines_and_application_fees\n"
            "- User asks which universities offer a specific program → use find_universities_by_program\n"
            "- User gives a vague or natural language description (e.g. 'a funded ML program in Canada') → use hybrid_program_search\n"
            "- Never guess which tool to use — if the user input is ambiguous, ask one clarifying question before selecting.\n"

            "Result formatting:\n"
            "- Always extract and display these fields explicitly when available: program name, university, deadline, application fee, requirements.\n"
            "- Highlight deadlines and flag any within 60 days.\n"
            "- If comparing multiple universities, present results in a structured side-by-side format.\n"
            "- If a field is missing from the evidence, say 'not available' — never fabricate it.\n"
            "- If no results are found or a tool fails, tell the user: 'I wasn't able to find that information. "
            "Try providing the full program URL so I can look it up directly.' — never expose error messages or index names.\n"

            "General rules:\n"
            "- Never fabricate requirements, deadlines, or pricing details.\n"
            f"{ESCALATE_WRITE_RULE}\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details. Speak as one assistant.\n"
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
            "You are the faculty profile deep-dive specialist. "
            "You analyze a single known faculty member in depth.\n"

            "Tool selection rules:\n"
            "- User asks about a faculty member's publications or research history → use get_faculty_papers\n"
            "- User asks how well a faculty member fits their profile → use score_faculty_fit\n"
            "- User asks for outreach conversation starters or talking points → use get_conversation_angles\n"
            "- User asks for the faculty member's profile, bio, or university page data → use find_faculty_by_research or find_faculty_by_university\n"
            "- Never use find_universities_by_program or check_program_deadlines_and_application_fees — those are for program search, not faculty.\n"

            "Sequence rules — when doing a full deep dive, always follow this order:\n"
            "1. Fetch the faculty profile from Elastic\n"
            "2. Call get_faculty_papers to retrieve real publications\n"
            "3. Call score_faculty_fit using the papers and profile as context\n"
            "4. Call get_conversation_angles using the papers and fit score as context\n"
            "- Do not skip steps. Do not call score_faculty_fit or get_conversation_angles without first fetching papers.\n"

            "Output rules:\n"
            "- Clearly separate: research themes, fit signals, and conversation angles in your response.\n"
            "- Label what is evidence-based vs inferred.\n"
            "- If papers are unavailable, say so and proceed with available data only.\n"
            "- Never fabricate publications, scores, or contact details.\n"
            f"{ESCALATE_WRITE_RULE}\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details. Speak as one assistant.\n"
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
        description="Read-only analysis of already-saved tracker data: deadlines, status, and weekly summaries via Elastic ES|QL.",
        instruction=(
            "You are the application tracker ANALYSIS specialist. You are READ-ONLY.\n"
            "- Use Elastic MCP tools to search ALREADY-SAVED tracker evidence and run ES|QL deadline/readiness summaries.\n"
            "- Surface deadlines, stale items, missing steps, and next actions.\n"
            "- Keep weekly summaries concise and operational.\n"
            "- Do not invent statuses; if data is incomplete, surface gaps.\n"
            f"{ESCALATE_WRITE_RULE}\n"
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
            f"{ESCALATE_WRITE_RULE}\n"
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
            *MEMORY_READ_TOOLS,
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
            "- MEMORY: Saved facts about the user are already injected into your context at session start, so you "
            "rarely need to fetch them. Call search_memory only when the user references a past decision you don't "
            "see, or asks what you remember. Call delete_memory only when the user explicitly asks to forget "
            "something. You have NO tool to save memories — that happens automatically; never tell the user you "
            "saved or will save a memory.\n"
            "- WRITES: You are READ-ONLY for app state. You do NOT have, and must NOT attempt, tools that create, "
            "update, or delete the user's shortlist, tracker, drafts, recommenders, emails, profile, or preferences. "
            "When a request requires such a write (e.g. 'add this professor to my shortlist', 'log this program "
            "in my tracker', 'remove Waterloo from my tracker', 'delete this draft'), or when one of your specialists "
            "transfers a write request back to you, do any needed domain reasoning first, then immediately call "
            "transfer_to_agent with agent_name='internal_app_agent' — that is the branch that owns all writes and the "
            "human-approval gate. Do NOT answer write requests in prose, NEVER persist app data to Elastic or anywhere "
            "else yourself, and NEVER claim a record was saved — you cannot save records.\n"
            "- Keep responses structured and tell the user which specialist owns the current step.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )
