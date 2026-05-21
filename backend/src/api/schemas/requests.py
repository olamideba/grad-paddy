from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProfileCreateRequest(BaseModel):
    email: str
    name: str
    avatar_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    onboarded: Optional[bool] = None


class PreferencesUpdateRequest(BaseModel):
    research_interests: list[str] = Field(default_factory=list)
    target_countries: list[str] = Field(default_factory=list)
    target_universities: list[str] = Field(default_factory=list)
    degree_type: str = "Either"
    funding_required: bool = False


class ValueRequest(BaseModel):
    value: str


# Sessions Requests
class SessionCreateRequest(BaseModel):
    first_message: str


class MessageCreateRequest(BaseModel):
    role: str
    content: str


# HITL Requests
class HITLResolveRequest(BaseModel):
    approved: bool


# Shortlist Requests
class FacultyCreateRequest(BaseModel):
    name: str
    university: str
    department: str
    email: Optional[str] = None
    webpage: Optional[str] = None
    research_summary: Optional[str] = None
    fit_score: float = 0.0
    position_status: str = "unknown"
    outreach_status: str = "not_contacted"


class FacultyUpdateRequest(BaseModel):
    name: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    webpage: Optional[str] = None
    research_summary: Optional[str] = None
    fit_score: Optional[float] = None
    position_status: Optional[str] = None
    outreach_status: Optional[str] = None


class OutreachStatusUpdateRequest(BaseModel):
    status: str


# Tracker Requests
class RecommenderAddRequest(BaseModel):
    name: str
    status: str = "not_asked"


class ApplicationCreateRequest(BaseModel):
    university: str
    program: str
    department: str
    deadline: Optional[datetime] = None
    status: str = "tracking"
    sop_status: str = "not_started"
    cv_status: str = "not_started"
    recommenders: list[dict] = Field(default_factory=list)
    funded: str = "unknown"
    notes: Optional[str] = None


class ApplicationUpdateRequest(BaseModel):
    university: Optional[str] = None
    program: Optional[str] = None
    department: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    sop_status: Optional[str] = None
    cv_status: Optional[str] = None
    recommenders: Optional[list[dict]] = None
    funded: Optional[str] = None
    notes: Optional[str] = None


class SOPStatusUpdateRequest(BaseModel):
    sop_status: Optional[str] = None
    status: Optional[str] = None


class CVStatusUpdateRequest(BaseModel):
    cv_status: Optional[str] = None
    status: Optional[str] = None


class FundedUpdateRequest(BaseModel):
    funded: Optional[str] = None
    status: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    status: str


# Drafts Requests
class DraftCreateRequest(BaseModel):
    type: str
    title: str
    content: str = ""
    ai_generated: bool = False
    source_tags: list[str] = Field(default_factory=list)
    linked_faculty_id: Optional[str] = None
    linked_application_id: Optional[str] = None


class ContentUpdateRequest(BaseModel):
    content: str
