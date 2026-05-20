from datetime import datetime, timezone, timedelta
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


def parse_datetime(val) -> datetime:
    if isinstance(val, str):
        if val.endswith("Z"):
            val = val[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return datetime.now(timezone.utc)
    elif isinstance(val, datetime):
        return val
    return datetime.now(timezone.utc)


class TrackerRepository:

    @staticmethod
    async def create_application(user_id: str, data: dict) -> dict:
        """Create a new tracker entry. ID is uuid7."""
        db = get_db()
        settings = get_settings()
        application_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        deadline = data.get("deadline")
        if deadline:
            deadline = parse_datetime(deadline)
        else:
            deadline = now
            
        app = {
            "id": application_id,
            "university": data.get("university", ""),
            "program": data.get("program", ""),
            "department": data.get("department", ""),
            "deadline": deadline,
            "status": data.get("status", "tracking"),
            "sop_status": data.get("sop_status", "not_started"),
            "cv_status": data.get("cv_status", "not_started"),
            "recommenders": data.get("recommenders") or [],
            "funded": data.get("funded", "unknown"),
            "notes": data.get("notes"),
            "created_at": now,
            "updated_at": now,
        }
        
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
            .set(app)
        )
        return app
    
    @staticmethod
    async def get_application(user_id: str, application_id: str) -> dict | None:
        """Get a single tracker entry by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def list_applications(user_id: str) -> list[dict]:
        """List all tracker entries ordered by deadline ascending."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .order_by("deadline", direction=firestore.Query.ASCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def update_application(user_id: str, application_id: str, data: dict) -> dict:
        """Partial update on a tracker entry."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        
        update_data = dict(data)
        update_data["updated_at"] = datetime.now(timezone.utc)
        if "deadline" in update_data:
            update_data["deadline"] = parse_datetime(update_data["deadline"])
            
        await doc_ref.update(update_data)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    @staticmethod
    async def update_status(user_id: str, application_id: str, status: str) -> None:
        """Update application status (tracking/drafting/submitted/etc)."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.update({
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def update_sop_status(user_id: str, application_id: str, sop_status: str) -> None:
        """Update sop_status field."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.update({
            "sop_status": sop_status,
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def update_cv_status(user_id: str, application_id: str, cv_status: str) -> None:
        """Update cv_status field."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.update({
            "cv_status": cv_status,
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def update_funded(user_id: str, application_id: str, funded: str) -> None:
        """Update funded field: 'yes' | 'no' | 'unknown'."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.update({
            "funded": funded,
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def add_recommender(user_id: str, application_id: str, recommender: dict) -> None:
        """Append a recommender object to the recommenders list.
        recommender shape: {name: str, status: 'not_asked'}"""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.update({
            "recommenders": firestore.ArrayUnion([recommender]),
            "updated_at": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def update_recommender_status(
        user_id: str, application_id: str, recommender_name: str, status: str
    ) -> None:
        """Update the status of a specific recommender within the list.
        Reads the list, mutates the matching entry, writes back."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        
        @firestore.async_transactional
        async def update_recommender_in_transaction(transaction, doc_ref):
            snapshot = await doc_ref.get(transaction=transaction)
            if not snapshot.exists:
                return
            data = snapshot.to_dict()
            recommenders = data.get("recommenders") or []
            updated = False
            for rec in recommenders:
                if rec.get("name") == recommender_name:
                    rec["status"] = status
                    updated = True
            if updated:
                transaction.update(doc_ref, {
                    "recommenders": recommenders,
                    "updated_at": datetime.now(timezone.utc)
                })
        
        transaction = db.transaction()
        await update_recommender_in_transaction(transaction, doc_ref)
    
    @staticmethod
    async def delete_application(user_id: str, application_id: str) -> None:
        """Delete a tracker entry."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .document(application_id)
        )
        await doc_ref.delete()
    
    @staticmethod
    async def count_by_sop_status(user_id: str, sop_status: str) -> int:
        """Count entries by sop_status. Used for 'SOP READY' stat."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .where("sop_status", "==", sop_status)
        )
        count_query = query.count()
        results = await count_query.get()
        if results and len(results) > 0 and len(results[0]) > 0:
            return int(results[0][0].value)
        return 0
    
    @staticmethod
    async def count_funded(user_id: str) -> int:
        """Count entries where funded == 'yes'. Used for 'FUNDED PROGRAMS' stat."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .where("funded", "==", "yes")
        )
        count_query = query.count()
        results = await count_query.get()
        if results and len(results) > 0 and len(results[0]) > 0:
            return int(results[0][0].value)
        return 0
    
    @staticmethod
    async def list_upcoming_deadlines(user_id: str, within_days: int) -> list[dict]:
        """Return entries with deadlines within the next N days, ordered by deadline."""
        db = get_db()
        settings = get_settings()
        now = datetime.now(timezone.utc)
        future_limit = now + timedelta(days=within_days)
        
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_TRACKER)
            .where("deadline", ">=", now)
            .where("deadline", "<=", future_limit)
            .order_by("deadline", direction=firestore.Query.ASCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
