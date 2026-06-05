from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class HITLOption(BaseModel):
    id: str
    label: str


class RequestHITLRequest(BaseModel):
    kind: Literal["approval", "choice", "input"]
    title: str
    description: str
    payload: dict[str, Any] = Field(default_factory=dict)
    options: Optional[list[HITLOption]] = None
    input_schema: Optional[dict[str, Any]] = Field(default=None, alias="schema")
    expires_in_seconds: Optional[int] = None


class ShortlistListRequest(BaseModel):
    position_status: str | None = None
    outreach_status: str | None = None


class DraftListRequest(BaseModel):
    type: str | None = None
    status: str | None = None


class GroupDeleteRequest(BaseModel):
    delete_sessions: bool = False

