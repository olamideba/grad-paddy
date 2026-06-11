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
    async def list_hitl(user_id: str, session_id: str) -> list[dict]:
        """All HITL records for a session (pending + resolved), oldest first.

        Used to rebuild approval gates and their result cards when a session is
        reloaded, so a gated turn isn't lost on refresh."""
        return await HITLRepository.list_hitl_for_session(user_id, session_id)

    @staticmethod
    async def cancel_pending(user_id: str, session_id: str) -> int:
        """Abandon any unanswered gate in a session (returns count expired)."""
        return await HITLRepository.cancel_pending_for_session(user_id, session_id)

    @staticmethod
    async def resolve_hitl(
        user_id: str,
        hitl_id: str,
        decision: str,
        response: dict | None = None,
    ) -> tuple[dict, bool]:
        """Resolve a HITL record. Returns (record, newly_resolved).

        On approval the change is applied BEFORE the record is marked resolved, so
        "resolved" always means "actually persisted". If the write fails the gate
        stays pending and the exception propagates to the caller — the UI must not
        show "Saved" for a write that did not happen.
        """
        if decision not in {"approved", "rejected"}:
            raise ValueError("decision must be 'approved' or 'rejected'")

        record = await HITLRepository.get_hitl(user_id, hitl_id)
        if not record:
            raise ValueError("HITL record not found")
        if record.get("status") in {"approved", "rejected", "resolved", "expired"}:
            return record, False  # idempotent — already resolved/abandoned

        # Single persistence path. Deterministic and server-side, from the payload
        # (plus the human's edits). Raises on failure → propagates, gate stays
        # pending, nothing is marked resolved.
        if decision == "approved":
            await HITLService._apply_change(user_id, record, response)

        try:
            resolved, newly_resolved = await HITLRepository.resolve_hitl(
                user_id, hitl_id, decision, response
            )
        except KeyError as e:
            raise ValueError("HITL record not found") from e
        return resolved, newly_resolved

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
    async def _apply_change(user_id: str, record: dict, response: dict | None) -> None:
        """Apply one approved change (create / update / delete) for one entity.

        Single persistence path for the single approval gate. Deterministic and
        server-side: it reads the proposed values from the HITL payload, lets the
        human's review-card edits (`response`) win over them, and calls the owning
        service. There are deliberately NO silent field guards — if a service
        rejects the data it raises, and resolve_hitl logs it loudly (a write that
        looked approved but did nothing was the bug this replaces).

        Emails are intentionally not handled here: the email gate only reviews a
        draft, and send happens from the UI canvas.
        """
        if record.get("artifact_id"):
            return  # create already persisted — don't duplicate

        payload = record.get("payload") or {}
        entity = str(payload.get("entity") or "").lower()
        action = str(payload.get("action") or "create").lower()
        hitl_id = record.get("id")

        # Target ids: singular ref_id, plus the agent sometimes batches several
        # records into one gate as a ref_ids array (e.g. "delete both entries").
        ref_id = str(payload.get("ref_id") or "").strip()
        raw_ref_ids = payload.get("ref_ids")
        ref_ids = [
            str(r).strip()
            for r in (raw_ref_ids if isinstance(raw_ref_ids, list) else [])
            if str(r or "").strip()
        ]
        if ref_id and ref_id not in ref_ids:
            ref_ids.insert(0, ref_id)
        if not ref_id and ref_ids:
            ref_id = ref_ids[0]

        # Proposed fields, with the human's review-card edits layered on top.
        fields = HITLService._payload_fields(payload)
        if isinstance(response, dict) and isinstance(response.get("fields"), dict):
            fields = {**fields, **response["fields"]}

        # Long-form draft text: prefer the human's edit, fall back to payload.
        content = ""
        if isinstance(response, dict):
            content = str(response.get("content") or "").strip()
        if not content:
            content = str(payload.get("content") or "").strip()

        def _require_ref() -> bool:
            if not ref_ids:
                logger.error("HITL %s %s on '%s' missing ref_id(s) — skipped", hitl_id, action, entity)
                return False
            return True

        artifact_id: str | None = None

        # ── Email: reviewed here, sent from the UI canvas — nothing to persist ──
        if entity == "email":
            return

        # ── Profile / preferences: update-only, keyed by user (no ref_id) ──
        if entity == "profile":
            from src.services.users_service import UserService

            await UserService.update_profile(user_id, fields)
            return
        if entity in {"preferences", "prefs"}:
            from src.services.users_service import UserService

            await UserService.update_preferences(user_id, fields)
            return

        # ── Drafts ──
        if entity in _DRAFT_ENTITIES or entity == "draft":
            from src.services.drafts_service import DraftsService

            if action == "delete":
                if _require_ref():
                    for rid in ref_ids:
                        await DraftsService.delete_draft(user_id, rid)
                return
            if action == "update":
                if not _require_ref():
                    return
                if content:
                    await DraftsService.update_content(user_id, ref_id, content)
                status = str(fields.get("status") or "").strip()
                if status:
                    await DraftsService.update_status(user_id, ref_id, status)
                return
            # create
            if not content:
                logger.error("HITL %s draft create has no content — skipped", hitl_id)
                return
            draft_type, default_title = _DRAFT_ENTITIES.get(entity, ("outreach-prep", "Draft"))
            draft = await DraftsService.create_draft(
                user_id,
                {
                    "type": draft_type,
                    "title": str(payload.get("title") or default_title),
                    "content": content,
                    "ai_generated": True,
                    # Approved through the chat gate → already approved; no need to
                    # re-approve in the Drafts section, and immediately attachable.
                    "status": "approved",
                    "linked_application_id": payload.get("linked_application_id"),
                    "linked_faculty_id": payload.get("linked_faculty_id"),
                },
            )
            artifact_id = draft.get("id")

        # ── Shortlist faculty ──
        elif entity in {"shortlist", "faculty"}:
            from src.services.shortlist_service import ShortlistService

            if action == "delete":
                if _require_ref():
                    for rid in ref_ids:
                        await ShortlistService.delete_faculty(user_id, rid)
                return
            if action == "update":
                if not _require_ref():
                    return
                status = str(fields.get("outreach_status") or "").strip()
                other = {k: v for k, v in fields.items() if k != "outreach_status"}
                if other:
                    await ShortlistService.update_faculty(user_id, ref_id, other)
                if status:
                    await ShortlistService.update_outreach_status(user_id, ref_id, status)
                return
            # create
            faculty = await ShortlistService.add_faculty(user_id, fields)
            artifact_id = faculty.get("id")

        # ── Tracker application ──
        elif entity in {"tracker", "application", "app"}:
            from src.services.tracker_service import TrackerService

            if action == "delete":
                if _require_ref():
                    for rid in ref_ids:
                        await TrackerService.delete_application(user_id, rid)
                return
            if action == "update":
                if _require_ref():
                    await TrackerService.update_application(user_id, ref_id, fields)
                return
            # create
            app = await TrackerService.create_application(user_id, fields)
            artifact_id = app.get("id")

        # ── Recommender: lives on an application; ref_id IS the application id ──
        elif entity == "recommender":
            if not _require_ref():
                return
            from src.services.tracker_service import TrackerService

            if action in {"update", "status"}:
                name = str(fields.get("name") or "").strip()
                status = str(fields.get("status") or "").strip()
                if name and status:
                    await TrackerService.update_recommender_status(user_id, ref_id, name, status)
                else:
                    logger.error("HITL %s recommender update missing name/status — skipped", hitl_id)
            else:
                await TrackerService.add_recommender(user_id, ref_id, fields)
            return

        else:
            logger.error(
                "HITL %s: unhandled entity '%s' action '%s' — not persisted", hitl_id, entity, action
            )
            return

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
