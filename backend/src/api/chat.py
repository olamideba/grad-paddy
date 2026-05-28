import logging
from collections.abc import AsyncGenerator
from typing import Any

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from ag_ui.core import BaseEvent, EventType
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agents.root import root_agent
from src.core.config import get_settings
from src.core.firebase import verify_firebase_auth
from src.repositories.sessions_repo import SessionRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=[Depends(verify_firebase_auth)])


class PersistentChatAgent(ADKAgent):
    """ADK agent wrapper that persists completed AG-UI message streams."""

    async def run(self, input: Any) -> AsyncGenerator[BaseEvent, None]:
        user_id = self._get_user_id(input)
        session_id = input.thread_id

        pending_events: list[dict[str, Any]] = []
        current_message_id: str | None = None
        current_text_parts: list[str] = []
        current_message_events: list[dict[str, Any]] = []
        current_message_complete = False

        async for event in super().run(input):
            try:
                event_payload = event.model_dump(by_alias=True, exclude_none=True)
            except Exception:
                event_payload = {"type": str(getattr(event, "type", ""))}

            pending_events.append(event_payload)

            event_type = getattr(event, "type", None)
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

            if event_type in {EventType.RUN_FINISHED, EventType.RUN_ERROR}:
                if current_message_id and current_message_complete:
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
                current_message_id = None
                current_text_parts = []
                current_message_events = []
                current_message_complete = False
                pending_events = []

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
