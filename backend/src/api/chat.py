from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from fastapi import APIRouter
from pydantic import BaseModel, Field
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.agents.root import root_agent
from src.core.config import get_settings

router = APIRouter(tags=["chat"])


def build_chat_agent() -> ADKAgent:
    settings = get_settings()
    return ADKAgent(
        adk_agent=root_agent,
        app_name=settings.AG_UI_APP_NAME,
        user_id=settings.AG_UI_USER_ID,
        session_timeout_seconds=settings.AG_UI_SESSION_TIMEOUT_SECONDS,
        use_in_memory_services=True,
    )


add_adk_fastapi_endpoint(router, build_chat_agent(), path="/chat")


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
    "/chat/debug",
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
