from google.adk.agents import LlmAgent, SequentialAgent

from src.agents.tools import create_draft, GOVERNANCE_TOOLS

MODEL = "gemini-3.1-pro-preview"


def _stage(name: str, output_key: str, instruction: str) -> LlmAgent:
    return LlmAgent(
        name=name,
        model=MODEL,
        description=name.replace("_", " "),
        instruction=instruction,
        output_key=output_key,
    )


def _review_and_save_stage(
    name: str, draft_type: str, state_key: str, title_hint: str
) -> LlmAgent:
    """Final stage: gate the draft for human review, then save on approval.

    The drafted text lives in session state under `state_key`. We pass it to
    request_hitl as payload.content so the UI renders an editable review card.
    On approval the (possibly edited) content is persisted via create_draft.

    NOTE: the intermediate stage prose never reaches the user — chat.py buffers
    and suppresses assistant text for any run that opens a request_hitl gate."""
    return LlmAgent(
        name=name,
        model=MODEL,
        description=name.replace("_", " "),
        instruction=(
            "Call request_hitl exactly once with kind='approval', "
            'options_json=\'[{"id":"approve","label":"Approve"},{"id":"reject","label":"Reject"}]\', '
            f"title='Review {draft_type} draft', a one-line description, and payload_json set to a JSON "
            f'object: {{"entity":"{draft_type}","content":<the FULL draft text below as a JSON string>}}.\n'
            "Then WAIT for the human decision. If approved (their response may include an edited "
            '"content"), call create_draft with '
            f"type='{draft_type}', a concise title ({title_hint}), and content set to the approved content "
            "(use the response content if provided, otherwise the draft below). If rejected, do not save.\n\n"
            f"DRAFT TEXT:\n{{{state_key}}}"
        ),
        tools=[create_draft, *GOVERNANCE_TOOLS],
    )


def build_sop_translation_chain() -> SequentialAgent:
    """SOP translation: intake → strategy → draft → review & save."""
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
                    "Using {sop_strategy}, write the SOP draft. Preserve user voice, avoid "
                    "fabrication, and use clearly marked [placeholders] for missing facts. "
                    "Output only the draft text."
                ),
            ),
            _review_and_save_stage(
                name="sop_translation_persist",
                draft_type="sop",
                state_key="sop_draft",
                title_hint="e.g. 'SOP for <program> at <university>'",
            ),
        ],
    )


def build_outreach_prep_chain() -> SequentialAgent:
    """Outreach preparation: summary → talking points → draft → review & save."""
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
                    "Using {outreach_talking_points}, write the outreach draft (subject line, talking points, "
                    "and a first-contact message). Output only the draft text; use [placeholders] for unknowns."
                ),
            ),
            _review_and_save_stage(
                name="outreach_persist",
                draft_type="outreach-prep",
                state_key="outreach_crm_draft",
                title_hint="e.g. 'Outreach to <professor>'",
            ),
        ],
    )


def build_research_narrative_framing_chain() -> SequentialAgent:
    """Research narrative framing: synthesis → angles → recommendation → review & save."""
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
                    "Using {narrative_angles}, write the recommended research narrative framing and a brief reason "
                    "it is strongest. Output only the framing text."
                ),
            ),
            _review_and_save_stage(
                name="research_narrative_persist",
                draft_type="research-narrative",
                state_key="research_frame",
                title_hint="e.g. 'Research narrative — <theme>'",
            ),
        ],
    )
