from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ToolRequestBase(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HITLOption(ToolRequestBase):
    id: str
    label: str


class RequestHITLRequest(ToolRequestBase):
    kind: Literal["approval", "choice", "input"]
    title: str
    description: str
    payload: dict[str, Any] = Field(default_factory=dict)
    options: Optional[list[HITLOption]] = None
    input_schema: Optional[dict[str, Any]] = None
    expires_in_seconds: Optional[int] = None


class ShortlistListToolRequest(ToolRequestBase):
    position_status: str | None = None
    outreach_status: str | None = None


class DraftListToolRequest(ToolRequestBase):
    type: str | None = None
    status: str | None = None


class GroupDeleteRequest(ToolRequestBase):
    delete_sessions: bool = False


# ── Agent tool DTOs ──────────────────────────────────────────────────────────
class ApplicationStatusToolRequest(ToolRequestBase):
    status: str


class ApplicationSopStatusToolRequest(ToolRequestBase):
    sop_status: str


class ApplicationCvStatusToolRequest(ToolRequestBase):
    cv_status: str


class ApplicationFundedToolRequest(ToolRequestBase):
    funded: str


class RecommenderAddToolRequest(ToolRequestBase):
    name: str
    status: str = "not_asked"


class RecommenderStatusToolRequest(ToolRequestBase):
    status: str


class ProfileUpdateToolRequest(ToolRequestBase):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    onboarded: Optional[bool] = None


class ProfileCreateToolRequest(ToolRequestBase):
    email: str
    name: str
    avatar_url: Optional[str] = None


class PreferencesUpsertToolRequest(ToolRequestBase):
    research_interests: list[str] = Field(default_factory=list)
    target_countries: list[str] = Field(default_factory=list)
    target_universities: list[str] = Field(default_factory=list)
    degree_type: str = "Either"
    funding_required: bool = False


class SessionCreateToolRequest(ToolRequestBase):
    first_message: str


class SessionRenameToolRequest(ToolRequestBase):
    title: str


class SessionGroupToolRequest(ToolRequestBase):
    group_id: Optional[str] = None


class SessionMessageToolRequest(ToolRequestBase):
    role: str
    content: str


class GroupCreateToolRequest(ToolRequestBase):
    name: str


class GroupDeleteToolRequest(ToolRequestBase):
    delete_sessions: bool = False


class ShortlistListToolRequest(ToolRequestBase):
    position_status: Optional[str] = None
    outreach_status: Optional[str] = None


class FacultyCreateToolRequest(ToolRequestBase):
    name: str
    university: str
    department: str
    email: Optional[str] = None
    webpage: Optional[str] = None
    research_summary: Optional[str] = None
    fit_score: float = 0.0
    position_status: str = "unknown"
    outreach_status: str = "not_contacted"


class FacultyUpdateToolRequest(ToolRequestBase):
    name: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    webpage: Optional[str] = None
    research_summary: Optional[str] = None
    fit_score: Optional[float] = None
    position_status: Optional[str] = None
    outreach_status: Optional[str] = None


class OutreachStatusToolRequest(ToolRequestBase):
    status: str


class ApplicationCreateToolRequest(ToolRequestBase):
    university: str
    program: str
    department: str
    deadline: Optional[datetime] = None
    status: str = "tracking"
    sop_status: str = "not_started"
    cv_status: str = "not_started"
    recommenders: list[RecommenderAddToolRequest] = Field(default_factory=list)
    funded: str = "unknown"
    notes: Optional[str] = None


class ApplicationUpdateToolRequest(ToolRequestBase):
    university: Optional[str] = None
    program: Optional[str] = None
    department: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    sop_status: Optional[str] = None
    cv_status: Optional[str] = None
    recommenders: Optional[list[RecommenderAddToolRequest]] = None
    funded: Optional[str] = None
    notes: Optional[str] = None


class DraftCreateToolRequest(ToolRequestBase):
    type: str
    title: str
    content: str = ""
    ai_generated: bool = False
    source_tags: list[str] = Field(default_factory=list)
    linked_faculty_id: Optional[str] = None
    linked_application_id: Optional[str] = None


class ContentUpdateToolRequest(ToolRequestBase):
    content: str


class DraftStatusToolRequest(ToolRequestBase):
    status: str
