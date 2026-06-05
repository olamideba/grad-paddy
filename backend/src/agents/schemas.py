from pydantic import BaseModel


class ShortlistListRequest(BaseModel):
    position_status: str | None = None
    outreach_status: str | None = None


class DraftListRequest(BaseModel):
    type: str | None = None
    status: str | None = None


class GroupDeleteRequest(BaseModel):
    delete_sessions: bool = False

