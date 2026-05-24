from datetime import datetime, timezone
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class ShortlistRepository:

    @staticmethod
    async def create_faculty(user_id: str, data: dict) -> dict:
        """Add a faculty member to the shortlist. ID is uuid7."""
        db = get_db()
        settings = get_settings()
        faculty_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        faculty = {
            "id": faculty_id,
            "name": data.get("name", ""),
            "university": data.get("university", ""),
            "department": data.get("department", ""),
            "research_areas": data.get("research_areas") or [],
            "fit_score": data.get("fit_score", 0),
            "position_status": data.get("position_status", "unknown"),
            "recent_paper_title": data.get("recent_paper_title"),
            "recent_paper_year": data.get("recent_paper_year"),
            "outreach_status": data.get("outreach_status", "none"),
            "source_url": data.get("source_url"),
            "added_at": data.get("added_at") or now,
            "created_at": data.get("created_at") or now,
            "updated_at": data.get("updated_at") or now,
        }
        
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .document(faculty_id)
            .set(faculty)
        )
        return faculty
    
    @staticmethod
    async def get_faculty(user_id: str, faculty_id: str) -> dict | None:
        """Get a single faculty entry by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .document(faculty_id)
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def list_shortlist(user_id: str) -> list[dict]:
        """List all shortlist entries ordered by fit_score descending."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .order_by("fit_score", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_position_status(user_id: str, position_status: str) -> list[dict]:
        """Filter shortlist by position_status. Used by 'Open Positions' tab."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .where("position_status", "==", position_status)
            .order_by("fit_score", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def list_by_outreach_status(user_id: str, outreach_status: str) -> list[dict]:
        """Filter shortlist by outreach_status. Used by 'Outreach' tab."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .where("outreach_status", "==", outreach_status)
            .order_by("fit_score", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def update_faculty(user_id: str, faculty_id: str, data: dict) -> dict:
        """Partial update on a faculty entry."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .document(faculty_id)
        )
        await doc_ref.update(data)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    @staticmethod
    async def update_outreach_status(user_id: str, faculty_id: str, status: str) -> None:
        """Update outreach_status. Called when agent logs an outreach prep or email sent."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .document(faculty_id)
        )
        await doc_ref.update({"outreach_status": status})
    
    @staticmethod
    async def delete_faculty(user_id: str, faculty_id: str) -> None:
        """Remove a faculty entry from the shortlist."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .document(faculty_id)
        )
        await doc_ref.delete()
    
    @staticmethod
    async def count_by_position_status(user_id: str, position_status: str) -> int:
        """Count entries by position_status. Used for stats bar: '3 open positions'."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .where("position_status", "==", position_status)
        )
        count_query = query.count()
        results = await count_query.get()
        if results and len(results) > 0 and len(results[0]) > 0:
            return int(results[0][0].value)
        return 0
    
    @staticmethod
    async def count_by_outreach_status(user_id: str, outreach_status: str) -> int:
        """Count contacted entries. Used for stats bar: '2 contacted'."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SHORTLIST)
            .where("outreach_status", "==", outreach_status)
        )
        count_query = query.count()
        results = await count_query.get()
        if results and len(results) > 0 and len(results[0]) > 0:
            return int(results[0][0].value)
        return 0
