import json
import logging
import asyncio
from collections.abc import AsyncGenerator
from typing import Any
from uuid6 import uuid7

from ag_ui.core import EventType, RunAgentInput, ToolMessage
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
try:  # pragma: no cover - depends on installed ag_ui_adk version
    from ag_ui_adk.session_manager import INVOCATION_ID_STATE_KEY
except Exception:  # noqa: BLE001
    INVOCATION_ID_STATE_KEY = None  # type: ignore[assignment]
try:  # pragma: no cover - depends on installed ag_ui version
    from ag_ui.core import StepStartedEvent, StepFinishedEvent
except Exception:  # noqa: BLE001
    StepStartedEvent = None  # type: ignore[assignment]
    StepFinishedEvent = None  # type: ignore[assignment]
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from google.adk.runners import Runner
from src.services.firestore_adk_session import FirestoreSessionService
from google.genai import types

from src.agents.app import grad_paddy_app
from src.agents import run_registry
from src.api.hitl_events import RunFinishedWithStatusEvent
from src.api.schemas.responses import StopChatResponse, StandardResponse
from src.core.config import get_settings
from src.core.firebase import verify_firebase_auth
from src.repositories.sessions_repo import SessionRepository
from src.services.hitl_service import HITLService
from src.services.users_service import UserService

logger = logging.getLogger(__name__)


def _payload_signature(payload: dict) -> str | None:
    """Stable identity of a gated action: (entity, action, ref_id, fields, content).

    Two gates with the same signature represent the SAME decision. Returns None
    when entity/action are absent (can't safely dedupe an unidentifiable gate)."""
    if not isinstance(payload, dict):
        return None
    entity = str(payload.get("entity") or "").lower().strip()
    action = str(payload.get("action") or "").lower().strip()
    if not entity or not action:
        return None
    ref_id = str(payload.get("ref_id") or "").strip()
    raw_ref_ids = payload.get("ref_ids")
    ref_ids = sorted(
        str(r).strip()
        for r in (raw_ref_ids if isinstance(raw_ref_ids, list) else [])
        if str(r or "").strip()
    )
    fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    content = str(payload.get("content") or "").strip()
    try:
        fields_sig = json.dumps(fields, sort_keys=True, default=str)
    except Exception:  # noqa: BLE001
        fields_sig = str(fields)
    return "|".join([entity, action, ref_id, ",".join(ref_ids), fields_sig, content])


async def _is_duplicate_of_resolved(user_id: str, session_id: str, payload: dict) -> bool:
    """True if an already-RESOLVED gate in this session has the same signature.

    Backstop for the duplicate-approval bug: after a gate is approved (and the
    change applied by HITLService._apply_change), the agent sometimes re-opens an
    identical gate on resume. The human already decided this action — suppress the
    redundant card deterministically rather than relying on the model not to re-ask."""
    sig = _payload_signature(payload)
    if sig is None:
        return False
    try:
        records = await HITLService.list_hitl(user_id, session_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("HITL dedupe lookup failed (session=%s): %s", session_id, exc)
        return False
    for rec in records:
        if rec.get("status") in {"approved", "rejected"} and (
            _payload_signature(rec.get("payload") or {}) == sig
        ):
            return True
    return False


# Monkey-patch EventTranslator to propagate the author name of the ADK Event
# to the TextMessageStartEvent. This allows chat.py to identify which sub-agent
# produced intermediate reasoning so it can render descriptive activity step cards
# (e.g. "Intake", "Strategy", "Draft") instead of generic "Step 1", "Step 2".
try:
    import ag_ui_adk.event_translator
    original_translate_text_content = ag_ui_adk.event_translator.EventTranslator._translate_text_content

    async def patched_translate_text_content(
        self: Any, adk_event: Any, thread_id: str, run_id: str
    ) -> AsyncGenerator[Any, None]:
        async for event in original_translate_text_content(self, adk_event, thread_id, run_id):
            if getattr(event, "type", None) == EventType.TEXT_MESSAGE_START:
                author = getattr(adk_event, "author", None)
                if author:
                    event.name = author
            yield event

    ag_ui_adk.event_translator.EventTranslator._translate_text_content = patched_translate_text_content  # type: ignore[method-assign]
except Exception as exc:
    logger.error("Failed to monkey patch EventTranslator: %s", exc)


router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=[Depends(verify_firebase_auth)])

REQUEST_HITL_TOOL_NAME = "request_hitl"

STAGE_LABELS: dict[str, str] = {
    # SOP translation chain
    "sop_translation_intake": "Reviewing your notes",
    "sop_translation_strategy": "Planning your statement",
    "sop_translation_draft": "Drafting your statement of purpose",
    "sop_translation_persist": "Preparing draft for review",
    # Outreach prep chain
    "outreach_paper_summary": "Reading faculty research",
    "outreach_talking_points": "Building talking points",
    "outreach_crm_draft": "Drafting your outreach message",
    "outreach_persist": "Preparing draft for review",
    # Research narrative framing chain
    "research_evidence_synthesis": "Synthesizing research evidence",
    "research_narrative_angles": "Exploring narrative angles",
    "research_framing_recommendation": "Framing your research story",
    "research_narrative_persist": "Preparing draft for review",
    # Application intake + general subagents
    "planner": "Planning the approach",
    "researcher": "Researching",
    "application_agent": "Preparing your application",
    "account_agent": "Updating your account",
    "governance_agent": "Checking requirements",
    "operations_agent": "Coordinating tasks",
    # Domain subagents
    "faculty_discovery_agent": "Finding faculty",
    "faculty_profile_deep_dive_agent": "Reviewing faculty profiles",
    "application_tracker_agent": "Updating application tracker",
    "funding_requirement_flag_detection_agent": "Checking funding requirements",
    "domain_orchestrator_agent": "Organizing the work",
}


class PersistentChatAgent(ADKAgent):
    """ADK agent wrapper that persists AG-UI message streams and HITL interrupts."""

    async def _prepare_input(self, input: RunAgentInput, user_id: str) -> tuple[RunAgentInput, bool]:
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
            # An ordinary message must never re-enter a paused HITL invocation.
            await self._clear_stale_resume_state(input, user_id, input.thread_id)
            # Abandon any unanswered gate: leaving it pending would block every
            # future gate via the one-pending-per-session guard.
            try:
                expired = await HITLService.cancel_pending(user_id, input.thread_id)
                if expired:
                    logger.info(
                        "Expired %d abandoned pending gate(s) on new message (session=%s)",
                        expired,
                        input.thread_id,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to cancel pending gates (session=%s): %s", input.thread_id, exc)
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

    async def _clear_stale_resume_state(
        self, input: RunAgentInput, user_id: str, session_id: str
    ) -> None:
        """Drop a leftover ADK-resumable invocation id when no gate is open.

        Native resumability (App(resumability_config=...)) stores
        ``_ag_ui_invocation_id`` when ``request_hitl`` pauses a turn and normally
        clears it once the resumed run completes. Our ``run`` wrapper cancels the
        underlying execution on completion, which can cut off that cleanup and
        leave the id behind. The *next* ordinary message then reads the stale id
        and ADK tries to resume the dead invocation, raising "No agent to
        transfer to for resuming agent ...". When there is no pending HITL the id
        is stale, so we clear it before a non-resume turn runs.
        """
        if INVOCATION_ID_STATE_KEY is None:
            return
        try:
            if await HITLService.get_pending_hitl(user_id, session_id):
                return  # a gate is genuinely open — keep the resume id
            app_name = self._get_app_name(input)
            state = await self._session_manager.get_session_state(session_id, app_name, user_id)
            if state and state.get(INVOCATION_ID_STATE_KEY):
                await self._session_manager.update_session_state(
                    session_id, app_name, user_id, {INVOCATION_ID_STATE_KEY: None}
                )
                logger.info("Cleared stale resume invocation_id for session %s", session_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to clear stale resume state for session %s: %s", session_id, exc)

    @staticmethod
    async def _create_hitl_from_args(
        user_id: str,
        session_id: str,
        run_id: str,
        tool_call_id: str,
        raw_args: str,
        dedupe_resolved: bool = False,
    ) -> None:
        """Persist a HITL record from the request_hitl tool-call args.

        dedupe_resolved: pass True only for RESUME runs (the continuation after a
        human resolves a gate). In that window the agent sometimes re-emits the
        gate it just had approved — suppress it. On fresh user turns it must stay
        False: an identical request later in the session (e.g. "add Waterloo
        again") is new intent and deserves a new gate."""
        if not raw_args or not raw_args.strip():
            return
        args = json.loads(raw_args)

        def _maybe_json(value: Any) -> Any:
            if isinstance(value, (dict, list)):
                return value
            if isinstance(value, str) and value.strip():
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return None
            return None

        kind = args.get("kind") or "approval"
        options = _maybe_json(args.get("options_json")) or args.get("options")
        input_schema = _maybe_json(args.get("input_schema_json")) or args.get("input_schema")
        payload = _maybe_json(args.get("payload_json")) or args.get("payload") or {}

        # Backstop (resume runs only): if the agent re-opens a gate for the action
        # the human just resolved, do not create a second card — the change was
        # already applied on approval (HITLService._apply_change).
        if (
            dedupe_resolved
            and isinstance(payload, dict)
            and await _is_duplicate_of_resolved(user_id, session_id, payload)
        ):
            logger.info(
                "Suppressed duplicate HITL gate for already-resolved action (session=%s, entity=%s, action=%s)",
                session_id,
                payload.get("entity"),
                payload.get("action"),
            )
            return
        try:
            await HITLService.create_hitl(
                user_id=user_id,
                session_id=session_id,
                run_id=run_id,
                kind=kind,
                title=args.get("title") or "Approval required",
                description=args.get("description") or "",
                payload=payload if isinstance(payload, dict) else {},
                tool_call_id=tool_call_id,
                options=options if isinstance(options, list) else None,
                input_schema=input_schema if isinstance(input_schema, dict) else None,
                expires_in_seconds=args.get("expires_in_seconds") or None,
            )
        except ValueError as exc:
            # One-pending guard (a gate is already pending for this session) or the
            # long-running body already created the record. Not fatal, but log it —
            # silently swallowing this is how a blocked gate became an invisible
            # "already pending" with no card for the user.
            logger.warning(
                "request_hitl gate not created (session=%s): %s", session_id, exc
            )

    async def run(self, input: Any) -> AsyncGenerator[Any, None]:
        user_id = self._get_user_id(input)
        session_id = input.thread_id
        # Resume continuation (post-approval)? Only then do we dedupe re-emitted
        # gates against already-resolved ones — see _create_hitl_from_args.
        _fwd = input.forwarded_props if isinstance(input.forwarded_props, dict) else {}
        is_resume_run = isinstance(_fwd.get("resume"), dict)

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

        _SENTINEL = object()
        queue: asyncio.Queue = asyncio.Queue()
        _stop = asyncio.Event()
        exec_key = (session_id, user_id)

        async def _drain():
            try:
                async for event in super(PersistentChatAgent, self).run(prepared):
                    if _stop.is_set():
                        break
                    # Yield to the event loop so CancelledError can be delivered;
                    # unbounded queue.put() never suspends on its own.
                    await asyncio.sleep(0)
                    await queue.put(event)
            except asyncio.CancelledError:
                pass
            finally:
                await queue.put(_SENTINEL)

        task = asyncio.get_running_loop().create_task(_drain())

        def _do_cancel() -> None:
            _stop.set()
            task.cancel()
            exec_state = self._active_executions.get(exec_key)
            if exec_state is not None and not exec_state.task.done():
                exec_state.task.cancel()

        run_registry.register(session_id, _do_cancel)

        pending_events: list[dict[str, Any]] = []
        current_message_id: str | None = None
        current_text_parts: list[str] = []
        current_message_events: list[dict[str, Any]] = []
        current_message_complete = False
        # request_hitl is a LongRunningFunctionTool: ag_ui_adk forwards the call to the
        # client without executing the Python body, so we reconstruct the HITL record
        # from the tool-call stream here.
        hitl_arg_buffers: dict[str, list[str]] = {}
        # Text is buffered and released only at RUN_FINISHED so intermediate chain-stage
        # prose doesn't leak; suppressed entirely when the run opened a HITL gate
        # (draft lives in the review card, not the chat).
        run_has_hitl = False
        buffered_msg_events: list[Any] = []   # in-progress message's event objects
        final_msg_events: list[Any] = []      # last completed message (release if no gate)
        current_message_name: str | None = None  # sub-agent author of in-progress message
        final_msg_name: str | None = None         # author of last completed message
        stage_idx = 0

        _DROP_WORDS = {
            "sop", "outreach", "research", "translation", "narrative", "framing",
            "agent", "chain", "prep", "persist",
        }

        def _stage_label(name: str | None) -> str | None:
            if not name:
                return None
            mapped = STAGE_LABELS.get(name)
            if mapped:
                return mapped
            words = [w for w in name.replace("-", "_").split("_") if w]
            kept = [w for w in words if w.lower() not in _DROP_WORDS] or words
            return " ".join(w.capitalize() for w in kept[-2:])

        def _step_events(label: str) -> list[Any]:
            if StepStartedEvent is None or StepFinishedEvent is None:
                return []
            return [StepStartedEvent(step_name=label), StepFinishedEvent(step_name=label)]

        try:
            while True:
                event = await queue.get()
                if event is _SENTINEL:
                    break

                try:
                    event_payload = event.model_dump(by_alias=True, exclude_none=True)
                except Exception:
                    event_payload = {"type": str(getattr(event, "type", ""))}

                event_type = getattr(event, "type", None)

                if event_type == EventType.RUN_FINISHED:
                    pending = await HITLService.get_pending_hitl(user_id, session_id)
                    status = "interrupted" if pending else "completed"

                    # Do NOT emit a custom event — AG-UI client rejects unknown types and
                    # aborts the stream. Frontend polls GET /api/hitl/.../pending instead.

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
                    elif status == "interrupted":
                        # Persist non-text events only so the reasoning activity card
                        # survives a reload; draft text is never stored.
                        activity = [
                            e
                            for e in pending_events
                            if e.get("type")
                            not in (
                                "TEXT_MESSAGE_START",
                                "TEXT_MESSAGE_CONTENT",
                                "TEXT_MESSAGE_END",
                            )
                        ]
                        if activity:
                            try:
                                await SessionRepository.upsert_message(
                                    user_id=user_id,
                                    session_id=session_id,
                                    message_id=str(uuid7()),
                                    data={
                                        "role": "assistant",
                                        "content": "",
                                        "ag_ui_events": activity,
                                    },
                                )
                            except Exception as exc:
                                logger.error(
                                    "Failed to persist interrupted-run activity for session %s: %s",
                                    session_id,
                                    exc,
                                    exc_info=True,
                                )

                    # Release buffered final message; suppress if HITL gate was opened.
                    if not run_has_hitl:
                        for buffered in final_msg_events:
                            yield buffered

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
                    run_has_hitl = False
                    buffered_msg_events = []
                    final_msg_events = []
                    current_message_name = None
                    final_msg_name = None
                    stage_idx = 0
                    continue

                if event_type == EventType.RUN_ERROR:
                    yield event
                    current_message_id = None
                    current_text_parts = []
                    current_message_events = []
                    current_message_complete = False
                    pending_events = []
                    run_has_hitl = False
                    buffered_msg_events = []
                    final_msg_events = []
                    current_message_name = None
                    final_msg_name = None
                    stage_idx = 0
                    continue

                # Reconstruct the HITL record from the request_hitl tool-call stream.
                if event_type == EventType.TOOL_CALL_START and (
                    getattr(event, "tool_call_name", None) == REQUEST_HITL_TOOL_NAME
                ):
                    # This run opened an approval/review gate → suppress all of its
                    # assistant prose (the draft lives in the review card).
                    run_has_hitl = True
                    # The last completed message before the gate was a reasoning stage
                    # (e.g. the draft) → surface it as a step, not prose.
                    if final_msg_events:
                        stage_idx += 1
                        label = _stage_label(final_msg_name) or f"Step {stage_idx}"
                        for step_ev in _step_events(label):
                            yield step_ev
                        final_msg_events = []
                        final_msg_name = None
                    hitl_arg_buffers[str(getattr(event, "tool_call_id", ""))] = []
                elif event_type == EventType.TOOL_CALL_ARGS and (
                    str(getattr(event, "tool_call_id", "")) in hitl_arg_buffers
                ):
                    hitl_arg_buffers[str(getattr(event, "tool_call_id", ""))].append(
                        getattr(event, "delta", "") or ""
                    )
                elif event_type == EventType.TOOL_CALL_END and (
                    str(getattr(event, "tool_call_id", "")) in hitl_arg_buffers
                ):
                    tcid = str(getattr(event, "tool_call_id", ""))
                    raw = "".join(hitl_arg_buffers.pop(tcid, []))
                    try:
                        await self._create_hitl_from_args(
                            user_id, session_id, input.run_id, tcid, raw,
                            dedupe_resolved=is_resume_run,
                        )
                    except Exception as exc:
                        logger.error("Failed to create HITL from tool args: %s", exc, exc_info=True)

                pending_events.append(event_payload)

                if event_type == EventType.TEXT_MESSAGE_START:
                    # A new message means the previous completed one was an intermediate
                    # reasoning stage: surface it as an activity step (no prose).
                    if final_msg_events:
                        stage_idx += 1
                        label = _stage_label(final_msg_name) or f"Step {stage_idx}"
                        for step_ev in _step_events(label):
                            yield step_ev
                        final_msg_events = []
                        final_msg_name = None
                    current_message_id = getattr(event, "message_id", None)
                    current_message_name = getattr(event, "name", None)
                    current_text_parts = []
                    current_message_events = list(pending_events)
                    current_message_complete = False
                    buffered_msg_events = [event]
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
                    buffered_msg_events.append(event)

                if (
                    event_type == EventType.TEXT_MESSAGE_END
                    and current_message_id
                    and getattr(event, "message_id", None) == current_message_id
                ):
                    current_message_complete = True
                    buffered_msg_events.append(event)
                    # Keep only the latest complete message; earlier ones in the run
                    # were intermediate reasoning and are turned into step cards.
                    final_msg_events = buffered_msg_events
                    final_msg_name = current_message_name
                    buffered_msg_events = []

                # Text is held and released at RUN_FINISHED; tools and steps stream live.
                if event_type in (
                    EventType.TEXT_MESSAGE_START,
                    EventType.TEXT_MESSAGE_CONTENT,
                    EventType.TEXT_MESSAGE_END,
                ):
                    continue

                yield event

        finally:
            _do_cancel()
            run_registry.deregister(session_id)


async def _extract_chat_state(request: Request, _input_data: Any) -> dict[str, Any]:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return {}
    return {"user_id": user_id}


def build_chat_agent() -> ADKAgent:
    settings = get_settings()
    return PersistentChatAgent.from_app(
        grad_paddy_app,
        user_id_extractor=lambda input_data: (
            input_data.state.get("user_id")
            if isinstance(input_data.state, dict)
            else None
        )
        or settings.AG_UI_USER_ID,
        session_timeout_seconds=settings.AG_UI_SESSION_TIMEOUT_SECONDS,
        session_service=FirestoreSessionService(),
        use_thread_id_as_session_id=True,
        delete_session_on_cleanup=False,
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
    session_service = FirestoreSessionService()
    runner = Runner(
        app=grad_paddy_app,
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


@router.post(
    "/stop",
    summary="Stop a running agent turn",
    response_model=StandardResponse[StopChatResponse],
)
async def stop_run(request: Request) -> dict:
    body = await request.json()
    thread_id = body.get("thread_id", "")
    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id required")
    cancelled = run_registry.cancel(thread_id)
    return {
        "success": True,
        "data": {"cancelled": cancelled},
        "message": "Agent run cancelled." if cancelled else "No active run found.",
    }
