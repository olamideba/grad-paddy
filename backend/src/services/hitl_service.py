import logging

from src.api.hitl_events import HITLRequiredEvent
from src.repositories.hitl_repo import HITLRepository

logger = logging.getLogger(__name__)

# entity tag on a HITL payload -> draft type to persist on approval.
_DRAFT_ENTITIES = {
    "sop": ("sop", "Statement of Purpose"),
    "outreach": ("outreach-prep", "Outreach draft"),
    "outreach-prep": ("outreach-prep", "Outreach draft"),
    "outreach_prep": ("outreach-prep", "Outreach draft"),
    "narrative": ("research-narrative", "Research narrative"),
    "research-narrative": ("research-narrative", "Research narrative"),
    "research_narrative": ("research-narrative", "Research narrative"),
}


class HITLService:

    @staticmethod
    async def create_hitl(
        user_id: str,
        session_id: str,
        run_id: str,
        kind: str,
        title: str,
        description: str,
        payload: dict,
        tool_call_id: str,
        options: list[dict[str, str]] | None = None,
        input_schema: dict | None = None,
        expires_in_seconds: int | None = None,
    ) -> dict:
        """Create a pending HITL record."""
        expires_at = HITLRepository.default_expiry(expires_in_seconds)
        return await HITLRepository.create_hitl(
            user_id=user_id,
            session_id=session_id,
            run_id=run_id,
            kind=kind,
            title=title,
            description=description,
            payload=payload,
            tool_call_id=tool_call_id,
            options=options,
            input_schema=input_schema,
            expires_at=expires_at,
        )

    @staticmethod
    async def get_hitl(user_id: str, hitl_id: str) -> dict | None:
        return await HITLRepository.get_hitl(user_id, hitl_id)

    @staticmethod
    async def get_pending_hitl(user_id: str, session_id: str) -> dict | None:
        """Get the active pending HITL record for a session, if any."""
        return await HITLRepository.get_pending_hitl_for_session(user_id, session_id)

    @staticmethod
    async def resolve_hitl(
        user_id: str,
        hitl_id: str,
        decision: str,
        response: dict | None = None,
    ) -> tuple[dict, bool]:
        """Resolve a HITL record. Returns (record, newly_resolved)."""
        if decision not in {"approved", "rejected"}:
            raise ValueError("decision must be 'approved' or 'rejected'")
        try:
            record, newly_resolved = await HITLRepository.resolve_hitl(
                user_id, hitl_id, decision, response
            )
        except KeyError as e:
            raise ValueError("HITL record not found") from e

        # Persist the artifact deterministically on approval. The proposed values
        # are already in the HITL payload (and the user's edits in `response`), so
        # we save them here rather than relying on the agent to re-enter its final
        # sub-agent and call the write tool on resume (that resume is unreliable,
        # which left approved writes unsaved). Only CREATE is handled here; updates
        # and deletes stay with the agent (deterministic destructive ops are risky).
        if newly_resolved and decision == "approved":
            try:
                await HITLService._persist_artifact(user_id, record, response)
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to persist approved artifact for HITL %s: %s", hitl_id, exc)

        return record, newly_resolved

    @staticmethod
    def _payload_fields(payload: dict) -> dict:
        """Proposed field values from the payload: a `fields` object if present,
        otherwise the payload minus control keys."""
        fields = payload.get("fields")
        if isinstance(fields, dict):
            return fields
        control = {"entity", "action", "content", "title", "ref_id", "fields"}
        return {k: v for k, v in payload.items() if k not in control}

    @staticmethod
    async def _persist_artifact(user_id: str, record: dict, response: dict | None) -> None:
        """Persist the approved artifact (draft / shortlist faculty / tracker app)."""
        if record.get("artifact_id"):
            return  # already persisted — don't duplicate

        payload = record.get("payload") or {}
        entity = str(payload.get("entity") or "").lower()
        action = str(payload.get("action") or "create").lower()
        artifact_id: str | None = None

        # ── Drafts (entity + content) ──
        mapping = _DRAFT_ENTITIES.get(entity)
        if mapping:
            draft_type, default_title = mapping
            content = ""
            if isinstance(response, dict):
                content = str(response.get("content") or "").strip()
            if not content:
                content = str(payload.get("content") or "").strip()
            if not content:
                return
            from src.services.drafts_service import DraftsService

            draft = await DraftsService.create_draft(
                user_id,
                {
                    "type": draft_type,
                    "title": str(payload.get("title") or default_title),
                    "content": content,
                    "ai_generated": True,
                    "status": "draft",
                    "linked_application_id": payload.get("linked_application_id"),
                    "linked_faculty_id": payload.get("linked_faculty_id"),
                },
            )
            artifact_id = draft.get("id")

        # ── Shortlist faculty (create only) ──
        elif entity in {"shortlist", "faculty"} and action == "create" and not payload.get("ref_id"):
            fields = HITLService._payload_fields(payload)
            if str(fields.get("name") or "").strip():
                from src.services.shortlist_service import ShortlistService

                faculty = await ShortlistService.add_faculty(user_id, fields)
                artifact_id = faculty.get("id")

        # ── Tracker application (create only) ──
        elif entity in {"tracker", "application", "app"} and action == "create" and not payload.get("ref_id"):
            fields = HITLService._payload_fields(payload)
            if str(fields.get("university") or "").strip() and str(fields.get("program") or "").strip():
                from src.services.tracker_service import TrackerService

                app = await TrackerService.create_application(user_id, fields)
                artifact_id = app.get("id")

        if artifact_id:
            try:
                await HITLRepository.set_artifact_id(user_id, record["id"], artifact_id)
            except Exception:  # noqa: BLE001
                pass

    @staticmethod
    async def mark_continued(user_id: str, hitl_id: str, run_id: str) -> dict:
        try:
            return await HITLRepository.mark_continued(user_id, hitl_id, run_id)
        except KeyError as e:
            raise ValueError("HITL record not found") from e

    @staticmethod
    def to_required_event(hitl: dict, session_id: str, run_id: str) -> HITLRequiredEvent:
        expires_at = hitl.get("expires_at")
        expires_iso = expires_at.isoformat() if expires_at else None
        return HITLRequiredEvent(
            hitl_id=hitl["id"],
            session_id=session_id,
            run_id=run_id,
            kind=hitl.get("kind", "approval"),
            title=hitl.get("title", "Approval required"),
            description=hitl.get("description", ""),
            payload=hitl.get("payload") or {},
            options=hitl.get("options"),
            input_schema=hitl.get("schema"),
            expires_at=expires_iso,
        )
