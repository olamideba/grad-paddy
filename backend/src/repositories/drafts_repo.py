from datetime import datetime, timezone
from uuid6 import uuid7
from google.api_core.exceptions import NotFound
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class DraftsRepository:

    @staticmethod
    async def create_draft(user_id: str, data: dict) -> dict:
        """Create a new draft. ID is uuid7. word_count computed from content length."""
        db = get_db()
        settings = get_settings()
        draft_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        content = data.get("content", "")
        word_count = len(content.split())

        ai_generated = data.get("ai_generated", False)
        # Self-created (non-AI) drafts are the user's own work — no approval step.
        # AI-generated drafts default to "draft" until approved (the chat HITL
        # gate passes status="approved" explicitly).
        default_status = "draft" if ai_generated else "approved"

        draft = {
            "id": draft_id,
            "type": data.get("type", "sop"),
            "title": data.get("title", ""),
            "content": content,
            "word_count": word_count,
            "status": data.get("status", default_status),
            "ai_generated": ai_generated,
            "source_tags": data.get("source_tags") or [],
            "linked_faculty_id": data.get("linked_faculty_id"),
            "linked_application_id": data.get("linked_application_id"),
            "created_at": now,
            "updated_at": now,
        }
        
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .document(draft_id)
            .set(draft)
        )
        return draft
    
    @staticmethod
    async def get_draft(user_id: str, draft_id: str) -> dict | None:
        """Get a single draft by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .document(draft_id)
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def list_drafts(user_id: str) -> list[dict]:
        """List all drafts ordered by updated_at descending."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_type(user_id: str, type: str) -> list[dict]:
        """Filter drafts by type: 'sop' | 'outreach' | 'narrative'.
        Used by SOP / Outreach / Narrative filter tabs."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .where("type", "==", type)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_status(user_id: str, status: str) -> list[dict]:
        """Filter drafts by status: 'draft' | 'in_review' | 'approved'."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .where("status", "==", status)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_faculty(user_id: str, faculty_id: str) -> list[dict]:
        """Get all drafts linked to a specific shortlist faculty entry."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .where("linked_faculty_id", "==", faculty_id)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_application(user_id: str, application_id: str) -> list[dict]:
        """Get all drafts linked to a specific tracker entry."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .where("linked_application_id", "==", application_id)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def update_draft_content(user_id: str, draft_id: str, content: str) -> dict:
        """Update content and recompute word_count. Sets updated_at to now."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .document(draft_id)
        )
        
        word_count = len(content.split())
        now = datetime.now(timezone.utc)
        
        await doc_ref.update({
            "content": content,
            "word_count": word_count,
            "updated_at": now
        })
        
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    @staticmethod
    async def update_status(user_id: str, draft_id: str, status: str) -> None:
        """Update draft status. Called when user clicks Approve or sets In Review."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .document(draft_id)
        )
        await doc_ref.update({
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def delete_draft(user_id: str, draft_id: str) -> None:
        """Delete a draft."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .document(draft_id)
        )
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFound("Draft record not found")
        await doc_ref.delete()
    
    @staticmethod
    async def count_by_status(user_id: str, status: str) -> int:
        """Count drafts by status. Used for stats bar: '1 approved · 2 need review'."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_DRAFTS)
            .where("status", "==", status)
        )
        count_query = query.count()
        results = await count_query.get()
        if results and len(results) > 0 and len(results[0]) > 0:
            return int(results[0][0].value)
        return 0
