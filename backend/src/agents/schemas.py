from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ToolRequestBase(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HITLOption(ToolRequestBase):
    id: str = Field(..., description="Unique identifier for the HITL option.")
    label: str = Field(..., description="Human‑readable label displayed for this option.")


class RequestHITLRequest(ToolRequestBase):
    kind: Literal["approval", "choice", "input"] = Field(..., description="Type of human‑in‑the‑loop request.")
    title: str = Field(..., description="Short title summarising the request.")
    description: str = Field(..., description="Full description of what is required from the human.")
    payload: dict[str, Any] = Field(default_factory=dict, description="Arbitrary data passed to the human for context.")
    options: Optional[list[HITLOption]] = Field(None, description="List of selectable options when kind is 'choice'.")
    input_schema: Optional[dict[str, Any]] = Field(None, description="JSON schema describing expected input when kind is 'input'.")
    expires_in_seconds: Optional[int] = Field(None, description="Optional timeout after which the request expires.")


class ShortlistListToolRequest(ToolRequestBase):
    position_status: Optional[str] = Field(None, description="Filter by the position outreach status (e.g., 'contacted', 'not_contacted').")
    outreach_status: Optional[str] = Field(None, description="Filter by outreach status (e.g., 'interested', 'declined').")


class DraftListToolRequest(ToolRequestBase):
    type: Optional[str] = Field(None, description="Draft type identifier (e.g., 'sop', 'personal_statement').")
    status: Optional[str] = Field(None, description="Current draft status (e.g., 'draft', 'reviewed', 'final').")


class RecommenderAddToolRequest(ToolRequestBase):
    name: str = Field(..., description="Name of the recommender (e.g., professor's name).")
    status: str = Field("not_asked", description="Current request status for this recommender (e.g., 'not_asked', 'requested', 'received').")
    email: str = Field("", description="Recommender's email address, used to send the recommendation request.")


class RecommenderStatusToolRequest(ToolRequestBase):
    status: str = Field(..., description="Overall status of recommenders for an application.")


class PreferencesUpdateToolRequest(ToolRequestBase):
    """Partial update for user preferences.

    Pass only the fields you want to change; omit fields to leave them unchanged.
    List fields (research_interests, countries, universities) are fully replaced
    when provided — supply the complete desired list, not just the delta.
    """

    research_interests: Optional[list[str]] = Field(
        None,
        description=(
            "Complete replacement list of research topics the user is interested in. "
            "If provided, the existing list is overwritten entirely."
        ),
    )
    countries: Optional[list[str]] = Field(
        None,
        description=(
            "Complete replacement list of preferred countries for study. "
            "If provided, the existing list is overwritten entirely."
        ),
    )
    universities: Optional[list[str]] = Field(
        None,
        description=(
            "Complete replacement list of preferred universities. "
            "If provided, the existing list is overwritten entirely."
        ),
    )
    degree_type: Optional[str] = Field(None, description="Desired degree type (e.g., 'MSc', 'PhD', 'Either').")
    funding_required: Optional[bool] = Field(None, description="Whether the user requires funding assistance.")


class ProfileUpdateToolRequest(ToolRequestBase):
    name: Optional[str] = Field(None, description="Updated display name.")
    avatar_url: Optional[str] = Field(None, description="Updated avatar URL.")


class FacultyCreateToolRequest(ToolRequestBase):
    name: str = Field(..., description="Full name of the faculty member.")
    university: str = Field(..., description="University affiliation.")
    department: str = Field(..., description="Academic department.")
    email: Optional[str] = Field(None, description="Contact email address.")
    webpage: Optional[str] = Field(None, description="URL to the faculty member's personal page.")
    research_summary: Optional[str] = Field(None, description="Brief summary of research interests.")
    fit_score: float = Field(0.0, description="Numeric fit score used for ranking.")
    position_status: str = Field("unknown", description="Current knowledge of the position status.")
    outreach_status: str = Field("not_contacted", description="Outreach status with this faculty.")


class FacultyUpdateToolRequest(ToolRequestBase):
    name: Optional[str] = Field(None, description="Updated name.")
    university: Optional[str] = Field(None, description="Updated university.")
    department: Optional[str] = Field(None, description="Updated department.")
    email: Optional[str] = Field(None, description="Updated email.")
    webpage: Optional[str] = Field(None, description="Updated webpage URL.")
    research_summary: Optional[str] = Field(None, description="Updated research summary.")
    fit_score: Optional[float] = Field(None, description="Updated fit score.")
    position_status: Optional[str] = Field(None, description="Updated position status.")
    outreach_status: Optional[str] = Field(None, description="Updated outreach status.")


class OutreachStatusToolRequest(ToolRequestBase):
    status: str = Field(..., description="Current outreach status for a faculty (e.g., 'contacted', 'interested').")


class ApplicationCreateToolRequest(ToolRequestBase):
    university: str = Field(..., description="The full name of the target university.")
    program: str = Field(..., description="The name of the graduate program (e.g., 'MSc Computer Science').")
    department: str = Field(..., description="The academic department offering the program.")
    deadline: Optional[datetime] = Field(default=None, description="Application deadline (if known).")
    status: str = Field(default="tracking", description="Overall application tracking status (e.g., 'tracking', 'draft', 'submitted').")
    sop_status: str = Field(default="not_started", description="Statement of Purpose writing status.")
    cv_status: str = Field(default="not_started", description="Curriculum Vitae preparation status.")
    recommenders: list[RecommenderAddToolRequest] = Field(default_factory=list, description="List of recommenders to request.")
    funded: str = Field(default="unknown", description="Funding status (e.g., 'unknown', 'applied', 'granted').")
    notes: Optional[str] = Field(default=None, description="Additional notes about the application.")


class ApplicationUpdateToolRequest(ToolRequestBase):
    """Partial update for an application tracker entry.

    Pass only the fields you want to change. This replaces the separate
    update_status, update_sop_status, update_cv_status, and update_funded tools.
    """

    university: Optional[str] = Field(None, description="Updated university name.")
    program: Optional[str] = Field(None, description="Updated program name.")
    department: Optional[str] = Field(None, description="Updated department.")
    deadline: Optional[datetime] = Field(None, description="Updated application deadline.")
    status: Optional[str] = Field(
        None,
        description="Updated overall application status (e.g., 'tracking', 'draft', 'submitted', 'accepted', 'rejected').",
    )
    sop_status: Optional[str] = Field(
        None,
        description="Updated SOP status (e.g., 'not_started', 'in_progress', 'ready').",
    )
    cv_status: Optional[str] = Field(
        None,
        description="Updated CV status (e.g., 'not_started', 'in_progress', 'ready').",
    )
    funded: Optional[str] = Field(
        None,
        description="Updated funding status (e.g., 'unknown', 'applied', 'granted', 'no').",
    )
    notes: Optional[str] = Field(None, description="Updated notes.")


class DraftCreateToolRequest(ToolRequestBase):
    type: str = Field(..., description="Type of the draft (e.g., 'sop', 'personal_statement').")
    title: str = Field(..., description="Title of the draft.")
    content: str = Field("", description="Initial content of the draft.")
    ai_generated: bool = Field(False, description="Whether the draft was generated by AI.")
    source_tags: list[str] = Field(default_factory=list, description="Tags indicating source materials referenced.")
    linked_faculty_id: Optional[str] = Field(None, description="ID of a faculty this draft is linked to, if any.")
    linked_application_id: Optional[str] = Field(None, description="ID of the application this draft belongs to.")


class ContentUpdateToolRequest(ToolRequestBase):
    content: str = Field(..., description="New content to replace the existing draft body.")


class DraftStatusToolRequest(ToolRequestBase):
    status: str = Field(..., description="Current status of the draft (e.g., 'draft', 'reviewed', 'final').")


class EmailCreateToolRequest(ToolRequestBase):
    to: str = Field("", description="Recipient email address.")
    subject: str = Field("", description="Email subject line.")
    body_markdown: str = Field("", description="Email body in markdown. The user reviews and edits this before sending.")
    kind: str = Field("faculty", description="'faculty' for cold outreach to a professor, or 'recommender' for a letter-of-recommendation request.")
    ref_id: Optional[str] = Field(None, description="Faculty id (kind=faculty) or recommender name (kind=recommender) this email targets.")
    linked_application_id: Optional[str] = Field(None, description="Application id this email relates to, if any (required to update recommender status on send).")
