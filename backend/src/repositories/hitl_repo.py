from datetime import datetime, timedelta, timezone
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db

_RESOLVED_STATUSES = frozenset({"approved", "rejected", "resolved", "expired"})


def _normalize_hitl(record: dict) -> dict:
    """Map legacy records (type-only) to the current contract shape."""
    if "kind" not in record and "type" in record:
        record = {**record, "kind": record["type"]}
    if "title" not in record:
        record = {**record, "title": str(record.get("kind", "approval")).replace("_", " ").title()}
    if "description" not in record:
        record = {**record, "description": "Review the proposed action below."}
    if "run_id" not in record:
        record = {**record, "run_id": ""}
    if "response" not in record:
        record = {**record, "response": None}
    if "expires_at" not in record:
        record = {**record, "expires_at": None}
    return record


class HITLRepository:

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
        expires_at: datetime | None = None,
    ) -> dict:
        """Create a pending HITL record. Enforces one pending gate per session."""
        db = get_db()
        settings = get_settings()

        existing = await HITLRepository.get_pending_hitl_for_session(user_id, session_id)
        if existing:
            raise ValueError("A pending HITL already exists for this session")

        hitl_id = str(uuid7())
        now = datetime.now(timezone.utc)

        hitl = {
            "id": hitl_id,
            "session_id": session_id,
            "run_id": run_id,
            "kind": kind,
            "title": title,
            "description": description,
            "payload": payload,
            "options": options,
            "schema": input_schema,
            "status": "pending",
            "response": None,
            "tool_call_id": tool_call_id,
            "continued_run_id": None,
            "created_at": now,
            "resolved_at": None,
            "expires_at": expires_at,
        }

        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
            .set(hitl)
        )
        return hitl

    @staticmethod
    async def get_hitl(user_id: str, hitl_id: str) -> dict | None:
        """Get a single HITL record by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
            .get()
        )
        if doc.exists:
            return _normalize_hitl(doc.to_dict())
        return None

    @staticmethod
    def _is_expired(hitl: dict) -> bool:
        expires_at = hitl.get("expires_at")
        return bool(
            hitl.get("status") == "pending"
            and expires_at
            and isinstance(expires_at, datetime)
            and expires_at <= datetime.now(timezone.utc)
        )

    @staticmethod
    async def get_pending_hitl_for_session(user_id: str, session_id: str) -> dict | None:
        """Return the active pending HITL for a session, if any."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .where("session_id", "==", session_id)
            .where("status", "==", "pending")
            .limit(1)
        )
        docs = await query.get()
        if not docs:
            return None
        hitl = _normalize_hitl(docs[0].to_dict())
        return await HITLRepository._maybe_expire_for_user(user_id, hitl)

    @staticmethod
    async def _maybe_expire_for_user(user_id: str, hitl: dict) -> dict | None:
        if not HITLRepository._is_expired(hitl):
            return hitl
        db = get_db()
        settings = get_settings()
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl["id"])
            .update({"status": "expired", "resolved_at": datetime.now(timezone.utc)})
        )
        return None

    @staticmethod
    async def list_hitl_for_session(user_id: str, session_id: str) -> list[dict]:
        """List all HITL records for a session ordered by created_at ascending."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .where("session_id", "==", session_id)
            .order_by("created_at", direction=firestore.Query.ASCENDING)
        )
        docs = await query.get()
        return [_normalize_hitl(doc.to_dict()) for doc in docs]

    @staticmethod
    def _resolved_status(decision: str, kind: str) -> str:
        if decision == "rejected":
            return "rejected"
        if kind == "approval":
            return "approved"
        return "resolved"

    @staticmethod
    async def resolve_hitl(
        user_id: str,
        hitl_id: str,
        decision: str,
        response: dict | None = None,
    ) -> tuple[dict, bool]:
        """Resolve a HITL record. Returns (record, created) where created is False if idempotent."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
        )
        doc = await doc_ref.get()
        if not doc.exists:
            raise KeyError("HITL record not found")

        hitl = _normalize_hitl(doc.to_dict())
        if hitl.get("status") in _RESOLVED_STATUSES:
            return hitl, False

        if hitl.get("status") != "pending":
            return hitl, False

        status_val = HITLRepository._resolved_status(decision, str(hitl.get("kind", "approval")))
        resolved_at = datetime.now(timezone.utc)
        await doc_ref.update({
            "status": status_val,
            "response": response,
            "resolved_at": resolved_at,
        })
        updated = await doc_ref.get()
        return _normalize_hitl(updated.to_dict()), True

    @staticmethod
    async def mark_continued(user_id: str, hitl_id: str, run_id: str) -> dict:
        """Record that a HITL resume run has started (idempotency guard)."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
        )
        doc = await doc_ref.get()
        if not doc.exists:
            raise KeyError("HITL record not found")
        hitl = _normalize_hitl(doc.to_dict())
        if hitl.get("continued_run_id"):
            return hitl
        await doc_ref.update({"continued_run_id": run_id})
        refreshed = await doc_ref.get()
        return _normalize_hitl(refreshed.to_dict())

    @staticmethod
    async def set_artifact_id(user_id: str, hitl_id: str, artifact_id: str) -> None:
        """Record the id of the artifact (e.g. draft) persisted from this HITL,
        so approval can't create duplicates."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
        )
        await doc_ref.update({"artifact_id": artifact_id})

    @staticmethod
    def default_expiry(seconds: int | None) -> datetime | None:
        if not seconds or seconds <= 0:
            return None
        return datetime.now(timezone.utc) + timedelta(seconds=seconds)
