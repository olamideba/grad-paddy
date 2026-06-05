"""AG-UI event payloads for the HITL contract."""

from typing import Any, Literal, Optional

from ag_ui.core.types import ConfiguredBaseModel
from pydantic import Field


class HITLRequiredEvent(ConfiguredBaseModel):
    """Emitted immediately before suspending a run for human input."""

    type: Literal["HITL_REQUIRED"] = "HITL_REQUIRED"
    hitl_id: str
    session_id: str
    run_id: str
    kind: Literal["approval", "choice", "input"]
    title: str
    description: str
    payload: dict[str, Any]
    options: Optional[list[dict[str, str]]] = None
    input_schema: Optional[Any] = Field(default=None, alias="schema")
    expires_at: Optional[str] = None


class RunFinishedWithStatusEvent(ConfiguredBaseModel):
    """RUN_FINISHED with explicit terminal status for HITL pauses."""

    type: Literal["RUN_FINISHED"] = "RUN_FINISHED"
    thread_id: str
    run_id: str
    status: Literal["completed", "interrupted", "error"] = "completed"
    result: Optional[Any] = None
