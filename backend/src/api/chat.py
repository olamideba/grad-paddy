import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid6 import uuid7

from ag_ui.core import EventType, RunAgentInput, ToolMessage
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from ag_ui.core import BaseEvent
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agents.root import root_agent
from src.api.hitl_events import RunFinishedWithStatusEvent
from src.core.config import get_settings
from src.core.firebase import verify_firebase_auth
from src.repositories.sessions_repo import SessionRepository
from src.services.hitl_service import HITLService
from src.services.users_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=[Depends(verify_firebase_auth)])

REQUEST_HITL_TOOL_NAME = "request_hitl"


class PersistentChatAgent(ADKAgent):
    """ADK agent wrapper that persists AG-UI message streams and HITL interrupts."""

    async def _prepare_input(self, input: RunAgentInput, user_id: str) -> tuple[RunAgentInput, bool]:
        """Apply forwardedProps.resume by injecting a tool result for the suspended call."""
        state = dict(input.state) if isinstance(input.state, dict) else {}
        state["current_run_id"] = input.run_id
        # Surface the user's auto-approve preference so agents know whether to
        # gate writes behind HITL. Default false = always ask.
        try:
            prefs = await UserService.get_preferences(user_id)
            state["auto_approve"] = bool((prefs or {}).get("auto_approve", False))
        except Exception:
            state["auto_approve"] = False
        input = input.model_copy(update={"state": state})

        forwarded = input.forwarded_props if isinstance(input.forwarded_props, dict) else {}
        resume = forwarded.get("resume") if isinstance(forwarded.get("resume"), dict) else None
        if not resume:
            return input, False

        hitl_id = resume.get("hitlId") or resume.get("hitl_id")
        if not hitl_id:
            return input, False

        hitl = await HITLService.get_hitl(user_id, str(hitl_id))
        if not hitl:
            raise ValueError(f"HITL record not found: {hitl_id}")

        if hitl.get("continued_run_id"):
            logger.info("Skipping duplicate resume for HITL %s", hitl_id)
            return input, True

        if hitl.get("status") == "pending":
            raise ValueError(f"HITL {hitl_id} must be resolved before resume")

        tool_call_id = hitl.get("tool_call_id")
        if not tool_call_id:
            raise ValueError(f"HITL {hitl_id} is missing tool_call_id")

        await HITLService.mark_continued(user_id, str(hitl_id), input.run_id)

        tool_content = json.dumps({
            "decision": resume.get("decision"),
            "response": resume.get("response"),
            "hitl_id": hitl_id,
            "status": hitl.get("status"),
        })
        tool_message = ToolMessage(
            id=str(uuid7()),
            role="tool",
            tool_call_id=str(tool_call_id),
            content=tool_content,
        )
        return input.model_copy(update={"messages": [*input.messages, tool_message]}), False

    async def run(self, input: Any) -> AsyncGenerator[Any, None]:
        user_id = self._get_user_id(input)
        session_id = input.thread_id

        try:
            prepared, resume_noop = await self._prepare_input(input, user_id)
        except ValueError as exc:
            logger.error("HITL resume preparation failed: %s", exc)
            from ag_ui.core import RunErrorEvent

            yield RunErrorEvent(
                type=EventType.RUN_ERROR,
                message=str(exc),
                code="HITL_RESUME_ERROR",
            )
            return

        if resume_noop:
            from ag_ui.core import RunStartedEvent

            yield RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=input.thread_id,
                run_id=input.run_id,
            )
            yield RunFinishedWithStatusEvent(
                thread_id=input.thread_id,
                run_id=input.run_id,
                status="completed",
            )
            return

        pending_events: list[dict[str, Any]] = []
        current_message_id: str | None = None
        current_text_parts: list[str] = []
        current_message_events: list[dict[str, Any]] = []
        current_message_complete = False
        async for event in super().run(prepared):
            try:
                event_payload = event.model_dump(by_alias=True, exclude_none=True)
            except Exception:
                event_payload = {"type": str(getattr(event, "type", ""))}

            event_type = getattr(event, "type", None)

            if event_type == EventType.RUN_FINISHED:
                pending = await HITLService.get_pending_hitl(user_id, session_id)
                status = "interrupted" if pending else "completed"

                if pending:
                    run_id = str(getattr(event, "run_id", None) or input.run_id)
                    required = HITLService.to_required_event(pending, session_id, run_id)
                    yield required

                if status == "completed" and current_message_id and current_message_complete:
                    content = "".join(current_text_parts).strip()
                    try:
                        await SessionRepository.upsert_message(
                            user_id=user_id,
                            session_id=session_id,
                            message_id=current_message_id,
                            data={
                                "role": "assistant",
                                "content": content,
                                "ag_ui_events": current_message_events,
                            },
                        )
                    except Exception as exc:
                        logger.error(
                            "Failed to persist AG-UI events for session %s, message %s: %s",
                            session_id,
                            current_message_id,
                            exc,
                            exc_info=True,
                        )

                yield RunFinishedWithStatusEvent(
                    thread_id=str(getattr(event, "thread_id", None) or session_id),
                    run_id=str(getattr(event, "run_id", None) or input.run_id),
                    status=status,
                    result=getattr(event, "result", None),
                )

                current_message_id = None
                current_text_parts = []
                current_message_events = []
                current_message_complete = False
                pending_events = []
                continue

            if event_type == EventType.RUN_ERROR:
                yield event
                current_message_id = None
                current_text_parts = []
                current_message_events = []
                current_message_complete = False
                pending_events = []
                continue

            pending_events.append(event_payload)

            if event_type == EventType.TEXT_MESSAGE_START:
                current_message_id = getattr(event, "message_id", None)
                current_text_parts = []
                current_message_events = list(pending_events)
                current_message_complete = False
            elif current_message_id is not None:
                current_message_events.append(event_payload)

            if (
                event_type == EventType.TEXT_MESSAGE_CONTENT
                and current_message_id
                and getattr(event, "message_id", None) == current_message_id
            ):
                delta = getattr(event, "delta", "")
                if delta:
                    current_text_parts.append(delta)

            if (
                event_type == EventType.TEXT_MESSAGE_END
                and current_message_id
                and getattr(event, "message_id", None) == current_message_id
            ):
                current_message_complete = True

            yield event


async def _extract_chat_state(request: Request, input_data: Any) -> dict[str, Any]:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return {}
    return {"user_id": user_id}


def build_chat_agent() -> ADKAgent:
    settings = get_settings()
    return PersistentChatAgent(
        adk_agent=root_agent,
        app_name=settings.AG_UI_APP_NAME,
        user_id_extractor=lambda input_data: (
            input_data.state.get("user_id")
            if isinstance(input_data.state, dict)
            else None
        )
        or settings.AG_UI_USER_ID,
        session_timeout_seconds=settings.AG_UI_SESSION_TIMEOUT_SECONDS,
        use_in_memory_services=True,
        use_thread_id_as_session_id=True,
    )


add_adk_fastapi_endpoint(
    router,
    build_chat_agent(),
    path="",
    extract_state_from_request=_extract_chat_state,
)


class DebugChatRequest(BaseModel):
    prompt: str = Field(..., description="Plain user message to send to the grad_paddy agent.")
    thread_id: str = Field(default="swagger-thread", description="Session/thread identifier.")
    user_id: str = Field(default="swagger-user", description="User identifier for the ADK session.")
    state: dict[str, object] = Field(
        default_factory=dict,
        description="Optional structured state. This must be a JSON object, not a string.",
    )


class DebugChatResponse(BaseModel):
    thread_id: str
    user_id: str
    response: str
    events_seen: int


def _extract_text(content: types.Content | None) -> str:
    if not content or not content.parts:
        return ""

    fragments: list[str] = []
    for part in content.parts:
        if getattr(part, "text", None):
            fragments.append(part.text)
    return "\n".join(fragment for fragment in fragments if fragment).strip()


@router.post(
    "/debug",
    response_model=DebugChatResponse,
    summary="Swagger-friendly chat endpoint",
    description=(
        "Simple JSON endpoint for manual testing in Swagger. "
        "Use `/chat` for AG-UI frontend integration, and use this route when you only want "
        "to send a prompt and inspect the final agent text response."
    ),
)
async def debug_chat(payload: DebugChatRequest) -> DebugChatResponse:
    settings = get_settings()
    session_service = InMemorySessionService()
    runner = Runner(
        app_name=settings.AG_UI_APP_NAME,
        agent=root_agent,
        session_service=session_service,
    )

    session = await session_service.create_session(
        app_name=settings.AG_UI_APP_NAME,
        user_id=payload.user_id,
        session_id=payload.thread_id,
        state=payload.state,
    )

    final_response = ""
    events_seen = 0

    async for event in runner.run_async(
        user_id=payload.user_id,
        session_id=session.id,
        new_message=types.UserContent(parts=[types.Part(text=payload.prompt)]),
    ):
        events_seen += 1
        text = _extract_text(event.content)
        if text:
            final_response = text

    return DebugChatResponse(
        thread_id=session.id,
        user_id=payload.user_id,
        response=final_response,
        events_seen=events_seen,
    )
