from google.adk.agents import LlmAgent, SequentialAgent

from src.agents.tools import create_draft


def _stage(name: str, output_key: str, instruction: str) -> LlmAgent:
    return LlmAgent(
        name=name,
        model="gemini-3.1-pro-preview",
        description=name.replace("_", " "),
        instruction=instruction,
        output_key=output_key,
    )


def _persist_draft_stage(name: str, draft_type: str, state_key: str, title_hint: str) -> LlmAgent:
    """Final chain stage that saves the generated text as a Draft record.

    The drafted text lives in session state under `state_key`; it is interpolated
    into the instruction so the model passes the FULL text as create_draft.content
    (otherwise content was being saved empty)."""
    return LlmAgent(
        name=name,
        model="gemini-3.1-pro-preview",
        description=name.replace("_", " "),
        instruction=(
            f"Persist the draft now. Call create_draft exactly once with:\n"
            f"- type='{draft_type}'\n"
            f"- title: a concise descriptive title ({title_hint})\n"
            f"- content: the COMPLETE text of the draft below, verbatim.\n\n"
            f"DRAFT TEXT TO SAVE:\n{{{state_key}}}\n\n"
            "The content argument MUST contain the full draft text — never leave it empty. "
            "After the tool succeeds, tell the user the draft was saved and they can edit it in Drafts."
        ),
        tools=[create_draft],
    )


def build_sop_translation_chain() -> SequentialAgent:
    """Prompt chain for SOP translation and drafting."""
    return SequentialAgent(
        name="sop_translation_chain",
        sub_agents=[
            _stage(
                name="sop_translation_intake",
                output_key="sop_intake",
                instruction=(
                    "Extract the user's raw SOP notes, target program context, achievements, "
                    "constraints, and voice preferences. Summarize what must be preserved and "
                    "what is missing. Do not draft yet."
                ),
            ),
            _stage(
                name="sop_translation_strategy",
                output_key="sop_strategy",
                instruction=(
                    "Using {sop_intake}, produce a concise strategy that maps evidence to themes, "
                    "motivation, fit, and narrative arc. Make assumptions explicit."
                ),
            ),
            _stage(
                name="sop_translation_draft",
                output_key="sop_draft",
                instruction=(
                    "Using {sop_strategy}, write a draft SOP or a precise drafting scaffold. "
                    "Preserve user voice, avoid fabrication, and include placeholders for missing facts."
                ),
            ),
            _persist_draft_stage(
                name="sop_translation_persist",
                draft_type="sop",
                state_key="sop_draft",
                title_hint="e.g. 'SOP for <program> at <university>'",
            ),
        ],
    )


def build_outreach_prep_chain() -> SequentialAgent:
    """Prompt chain for outreach preparation."""
    return SequentialAgent(
        name="outreach_prep_chain",
        sub_agents=[
            _stage(
                name="outreach_paper_summary",
                output_key="paper_summary",
                instruction=(
                    "Summarize the relevant faculty papers or research topics into a short outreach brief. "
                    "Focus on why the work matters, the likely research direction, and what the student can credibly connect to."
                ),
            ),
            _stage(
                name="outreach_talking_points",
                output_key="outreach_talking_points",
                instruction=(
                    "Using {paper_summary}, produce concise talking points, a subject line idea, and a first-contact angle "
                    "that sounds human and specific."
                ),
            ),
            _stage(
                name="outreach_crm_draft",
                output_key="outreach_crm_draft",
                instruction=(
                    "Prepare a CRM log draft using {outreach_talking_points}. "
                    "Do not claim anything was written to the CRM. Mark the result as pending user confirmation."
                ),
            ),
            _persist_draft_stage(
                name="outreach_persist",
                draft_type="outreach-prep",
                state_key="outreach_crm_draft",
                title_hint="e.g. 'Outreach to <professor>'",
            ),
        ],
    )


def build_research_narrative_framing_chain() -> SequentialAgent:
    """Prompt chain for framing research narrative and fit."""
    return SequentialAgent(
        name="research_narrative_framing_chain",
        sub_agents=[
            _stage(
                name="research_evidence_synthesis",
                output_key="evidence_synthesis",
                instruction=(
                    "Synthesize the provided research evidence into a compact map of themes, methods, "
                    "constraints, and standout points. Keep citations or source references explicit if present."
                ),
            ),
            _stage(
                name="research_narrative_angles",
                output_key="narrative_angles",
                instruction=(
                    "Using {evidence_synthesis}, generate 2-4 narrative angles that connect the candidate's work "
                    "to faculty interests, labs, and program fit."
                ),
            ),
            _stage(
                name="research_framing_recommendation",
                output_key="research_frame",
                instruction=(
                    "Using {narrative_angles}, recommend the strongest framing for the user's outreach, SOP, or profile. "
                    "State the final recommended angle and why it is strongest."
                ),
            ),
            _persist_draft_stage(
                name="research_narrative_persist",
                draft_type="research-narrative",
                state_key="research_frame",
                title_hint="e.g. 'Research narrative — <theme>'",
            ),
        ],
    )

