from google.adk.agents import LlmAgent, SequentialAgent

from src.agents.domain.chains import (
    build_outreach_prep_chain,
    build_research_narrative_framing_chain,
    build_sop_translation_chain,
)


def build_faculty_discovery_agent() -> LlmAgent:
    """Discover, rank, and format faculty candidates from external evidence."""
    return LlmAgent(
        name="faculty_discovery_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Finds and ranks faculty by scraping, indexing, and hybrid search once tools are attached."
        ),
        instruction=(
            "You are the faculty discovery specialist.\n"
            "- Your future tools will scrape sources, index results, and run ES hybrid search.\n"
            "- For now, focus on the reasoning contract: rank candidates, explain the evidence, and surface missing data clearly.\n"
            "- Never fabricate publications, availability, or contact details.\n"
            "- Return results in a structured ranked list with a short rationale per candidate.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )


def build_faculty_profile_deep_dive_agent() -> LlmAgent:
    """Analyze faculty profiles, papers, and fit in depth."""
    return LlmAgent(
        name="faculty_profile_deep_dive_agent",
        model="gemini-3.1-pro-preview",
        description=(
            "Performs paper retrieval, fit scoring, and conversation-angle generation for a faculty profile."
        ),
        instruction=(
            "You are the faculty profile deep-dive specialist.\n"
            "- Your future tools will retrieve papers and supporting evidence.\n"
            "- Translate papers into fit signals, research themes, and conversation angles.\n"
            "- Distinguish evidence from inference.\n"
            "- If the evidence is weak or conflicting, say so explicitly.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )


def build_sop_translation_agent() -> SequentialAgent:
    """Prompt-chain agent for SOP translation."""
    return build_sop_translation_chain()


def build_outreach_prep_agent() -> SequentialAgent:
    """Prompt-chain agent for outreach preparation."""
    return build_outreach_prep_chain()


def build_application_tracker_agent() -> LlmAgent:
    """Track applications, deadlines, and weekly summaries over ES CRM data."""
    return LlmAgent(
        name="application_tracker_agent",
        model="gemini-3.1-pro-preview",
        description="Tracks deadlines, status, and weekly summaries once ES CRM tools are attached.",
        instruction=(
            "You are the application tracker specialist.\n"
            "- Your future tools will read and write the ES CRM index.\n"
            "- Surface deadlines, stale items, missing steps, and next actions.\n"
            "- Keep weekly summaries concise and operational.\n"
            "- Do not invent statuses; if data is incomplete, surface gaps.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )


def build_funding_requirement_flag_detection_agent() -> LlmAgent:
    """Detect funding and requirement flags from ES-backed records."""
    return LlmAgent(
        name="funding_requirement_flag_detection_agent",
        model="gemini-3.1-pro-preview",
        description="Flags funding and requirement issues from ES-backed application data.",
        instruction=(
            "You are the funding and requirement flag detection specialist.\n"
            "- Your future tools will query ES-backed records.\n"
            "- Detect funding constraints, missing prerequisites, deadline conflicts, and other blocking requirements.\n"
            "- Return a clear list of flags with severity and rationale.\n"
            "- Separate explicit evidence from inferred risk.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
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
        ],
        instruction=(
            "You are the domain orchestrator for Grad Paddy.\n"
            "- Route user intent to the correct specialist agent.\n"
            "- If the request is ambiguous, ask one clarifying question before selecting a branch.\n"
            "- Use faculty discovery for finding and ranking candidates.\n"
            "- Use faculty profile deep-dive for paper-based fit analysis and conversation angles.\n"
            "- Use SOP translation for multi-step SOP drafting and rewriting.\n"
            "- Use outreach prep for summaries, talking points, and draft CRM notes.\n"
            "- Use application tracker for deadline and status operations once the ES CRM tools exist.\n"
            "- Use funding and requirement flag detection for blocking conditions and readiness checks.\n"
            "- Use research narrative framing when the user needs the story that connects their evidence to the program or faculty.\n"
            "- Treat outward-facing actions, CRM writes, and any irreversible change as requiring explicit user confirmation.\n"
            "- Do not perform writes without an approval gate. Prepare the payload, explain the consequence, and wait for confirmation.\n"
            "- Keep responses structured and tell the user which specialist owns the current step.\n"
            "- Never mention internal agent names, tool names, routing steps, or implementation details to the user. Speak as one assistant."
        ),
    )
