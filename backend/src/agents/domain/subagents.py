from google.adk.agents import LlmAgent, SequentialAgent

from src.agents.domain.chains import (
    build_outreach_prep_chain,
    build_research_narrative_framing_chain,
    build_sop_translation_chain,
)
from src.agents.elastic_mcp import build_elastic_mcp_tools
from src.services.ingestion_service import IngestionService


def build_faculty_discovery_agent() -> LlmAgent:
    """Discover, rank, and format faculty candidates from external evidence."""
    elastic_tools = build_elastic_mcp_tools()
    return LlmAgent(
        name="faculty_discovery_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Finds and ranks faculty using Elastic hybrid search and evidence retrieval."
        ),
        instruction=(
            "You are the faculty discovery specialist.\n"
            "- Use Elastic MCP tools when available to search indexed faculty, program, paper, lab, and funding evidence.\n"
            "- Prefer Elastic search and ES|QL evidence over unsupported recall.\n"
            "- For now, focus on the reasoning contract: rank candidates, explain the evidence, and surface missing data clearly.\n"
            "- Never fabricate publications, availability, or contact details.\n"
            "- Return results in a structured ranked list with a short rationale per candidate.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=elastic_tools,
    )


def build_faculty_profile_deep_dive_agent() -> LlmAgent:
    """Analyze faculty profiles, papers, and fit in depth."""
    elastic_tools = build_elastic_mcp_tools()
    return LlmAgent(
        name="faculty_profile_deep_dive_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Performs paper retrieval, fit scoring, and conversation-angle generation for a faculty profile."
        ),
        instruction=(
            "You are the faculty profile deep-dive specialist.\n"
            "- Use Elastic MCP tools when available to retrieve faculty profiles, publications, program pages, and prior user decisions.\n"
            "- Translate papers into fit signals, research themes, and conversation angles.\n"
            "- Distinguish evidence from inference.\n"
            "- If the evidence is weak or conflicting, say so explicitly.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
        tools=elastic_tools,
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
        model="gemini-3.1-pro-preview",
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
        model="gemini-3.1-pro-preview",
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
        model="gemini-3.1-pro-preview",
        description=(
            "Handles the full data ingestion pipeline for grad program and faculty URLs. "
            "Scrapes the URL, chunks and embeds the content, and indexes it into "
            "Elasticsearch so it can be searched by other agents."
        ),
        sub_agents=[],
        instruction=(
            "You are the data ingestion specialist for the grad-paddy system. "
            "Your job is to take a URL from the user and get it into the database.\n\n"

            "Always follow this exact sequence:\n"
            "1. Call check_url_indexed(url) first\n"
            "   - If already indexed: Do NOT re-ingest.\n"
            "   - If not indexed: proceed to step 2\n\n"

            "2. Determine url_type:\n"
            "   - 'faculty' if the URL contains /people/, /faculty/, /role/faculty, "
            "     or /directory/faculty\n"
            "   - 'program' if the URL contains programs/, /graduate-programs/, "
            "     or /graduate-admissions/"


            "3. Call ingest_url(url, url_type, user_id)\n"
            "   - Wait for completion\n"
            "   - Report back: how many chunks were indexed, "
            "     what programs or faculty were found\n\n"

            "4. If ingest_url returns status='failed':\n"
            "   - Tell the user what went wrong\n"
            "   - Suggest checking the URL is publicly accessible\n\n"

            "Be concise. The user just wants to know it worked.\n"
        ),
        tools=[
            IngestionService.check_url_indexed,
            IngestionService.ingest_url,
        ],
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
        sub_agents=[
            build_faculty_discovery_agent(),
            build_faculty_profile_deep_dive_agent(),
            build_sop_translation_agent(),
            build_outreach_prep_agent(),
            build_application_tracker_agent(),
            build_funding_requirement_flag_detection_agent(),
            build_research_narrative_framing_agent(),
            build_ingestion_pipeline_agent()
        ],
        instruction=(
            "You are the domain orchestrator for Grad Paddy.\n"
            "- Route user intent to the correct specialist agent.\n"
            "- If the request is ambiguous, ask one clarifying question before selecting a branch.\n"
            "- Use faculty discovery for Elastic-backed finding and ranking candidates.\n"
            "- Use faculty profile deep-dive for paper-based fit analysis and conversation angles.\n"
            "- Use SOP translation for multi-step SOP drafting and rewriting.\n"
            "- Use outreach prep for summaries, talking points, and draft CRM notes.\n"
            "- Use application tracker for Elastic-backed deadline, readiness, and status analysis.\n"
            "- Use funding and requirement flag detection for blocking conditions and readiness checks.\n"
            "- Use research narrative framing when the user needs the story that connects their evidence to the program or faculty.\n"
            "- Use ingestion pipeline when the user needs deep research about university programs and faculty.\n"
            "- Treat outward-facing actions, CRM writes, and any irreversible change as requiring explicit user confirmation.\n"
            "- Do not perform writes without an approval gate. Prepare the payload, explain the consequence, and wait for confirmation.\n"
            "- Keep responses structured and tell the user which specialist owns the current step.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )
