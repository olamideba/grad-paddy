from datetime import datetime, timezone
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class HITLRepository:

    @staticmethod
    async def create_hitl(user_id: str, session_id: str, type: str, payload: dict) -> dict:
        """Create a pending HITL record. ID is uuid7. Status defaults to 'pending'."""
        db = get_db()
        settings = get_settings()
        hitl_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        hitl = {
            "id": hitl_id,
            "session_id": session_id,
            "type": type,
            "status": "pending",
            "payload": payload,
            "created_at": now,
            "resolved_at": None,
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
            return doc.to_dict()
        return None
    
    @staticmethod
    async def get_pending_hitl_for_session(user_id: str, session_id: str) -> dict | None:
        """Get the active pending HITL record for a session, if any.
        There should only ever be one pending record per session at a time."""
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
        if docs:
            return docs[0].to_dict()
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
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def resolve_hitl(user_id: str, hitl_id: str, approved: bool) -> dict:
        """Set status to 'approved' or 'rejected' and set resolved_at to now."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_HITL)
            .document(hitl_id)
        )
        
        status_val = "approved" if approved else "rejected"
        resolved_at = datetime.now(timezone.utc)
        
        await doc_ref.update({
            "status": status_val,
            "resolved_at": resolved_at
        })
        
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
