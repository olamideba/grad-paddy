from pydantic import BaseModel, Field
from typing import Generic, TypeVar, Optional, Any
from datetime import datetime

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: str = ""


# Success/Status responses
class SuccessStatusResponse(BaseModel):
    status: str = "success"


# Users & Preferences responses
class ProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    onboarded: bool = False
    created_at: datetime
    updated_at: datetime


class PreferencesResponse(BaseModel):
    research_interests: list[str] = Field(default_factory=list)
    target_countries: list[str] = Field(default_factory=list)
    target_universities: list[str] = Field(default_factory=list)
    degree_type: str = "Either"
    funding_required: bool = False


# Chat/Sessions responses
class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    ai_ui_events: list[dict] = Field(default_factory=list)
    created_at: datetime


# HITL responses
class HITLResponse(BaseModel):
    id: str
    session_id: str
    type: str
    payload: dict
    status: str = "pending"
    response: Optional[dict] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


# Shortlist responses
class FacultyResponse(BaseModel):
    id: str
    name: str
    university: str
    department: str
    email: Optional[str] = None
    webpage: Optional[str] = None
    research_summary: Optional[str] = None
    fit_score: float = 0.0
    position_status: str = "unknown"
    outreach_status: str = "not_contacted"
    created_at: datetime
    updated_at: datetime


class ShortlistStatsResponse(BaseModel):
    total: int
    open_positions: int
    contacted: int


# Tracker responses
class ApplicationResponse(BaseModel):
    id: str
    university: str
    program: str
    department: str
    deadline: datetime
    status: str = "tracking"
    sop_status: str = "not_started"
    cv_status: str = "not_started"
    recommenders: list[dict] = Field(default_factory=list)
    funded: str = "unknown"
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TrackerStatsResponse(BaseModel):
    sop_ready: int
    recs_confirmed: int
    funded_programs: int
    total: int


# Drafts responses
class DraftResponse(BaseModel):
    id: str
    type: str
    title: str
    content: str
    word_count: int
    status: str = "draft"
    ai_generated: bool = False
    source_tags: list[str] = Field(default_factory=list)
    linked_faculty_id: Optional[str] = None
    linked_application_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DraftStatsResponse(BaseModel):
    total: int
    approved: int
    need_review: int
