from datetime import datetime, timezone
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class UserRepository:
    
    # ── Profile ──────────────────────────────────────────────────
    
    @staticmethod
    async def create_profile(user_id: str, data: dict) -> dict:
        """Create the profile named document for a new user."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PROFILE)
            .document(settings.DOC_PROFILE)
        )

        now = datetime.now(timezone.utc)
        
        profile = {
            "id": user_id,
            "email": data.get("email", ""),
            "name": data.get("name", ""),
            "avatar_url": data.get("avatar_url"),
            "onboarded": data.get("onboarded", False),            
            "created_at": data.get("created_at") or now,
            "updated_at": data.get("updated_at") or now,
        }
        await doc_ref.set(profile)
        return profile
    
    @staticmethod
    async def get_profile(user_id: str) -> dict | None:
        """Get the profile document for a user. Returns None if not found."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PROFILE)
            .document(settings.DOC_PROFILE)
        )
        doc = await doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def update_profile(user_id: str, data: dict) -> dict:
        """Partial update on the profile document."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PROFILE)
            .document(settings.DOC_PROFILE)
        )
        await doc_ref.update(data)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    @staticmethod
    async def set_onboarded(user_id: str) -> None:
        """Set onboarded: true on the profile document."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PROFILE)
            .document(settings.DOC_PROFILE)
        )
        await doc_ref.update({"onboarded": True})

    # ── Preferences ───────────────────────────────────────────────

    @staticmethod
    async def create_preferences(user_id: str, data: dict) -> dict:
        """Create the preferences named document for a user."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        
        preferences = {
            "research_interests": data.get("research_interests") or [],
            "target_countries": data.get("target_countries") or [],
            "target_universities": data.get("target_universities") or [],
            "degree_type": data.get("degree_type", "Either"),
            "funding_required": data.get("funding_required", False),
            "auto_approve": data.get("auto_approve", False),
            "reminder_offsets_days": data.get("reminder_offsets_days") or [7, 1],
        }
        await doc_ref.set(preferences)
        return preferences
    
    @staticmethod
    async def get_preferences(user_id: str) -> dict | None:
        """Get the preferences document. Returns None if not set yet."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        doc = await doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def update_preferences(user_id: str, data: dict) -> dict:
        """Partial update on preferences — e.g. add a country, change degree_type."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update(data)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    @staticmethod
    async def append_research_interest(user_id: str, interest: str) -> None:
        """Append a single item to research_interests list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"research_interests": firestore.ArrayUnion([interest])})
    
    @staticmethod
    async def remove_research_interest(user_id: str, interest: str) -> None:
        """Remove a single item from research_interests list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"research_interests": firestore.ArrayRemove([interest])})
    
    @staticmethod
    async def append_target_country(user_id: str, country: str) -> None:
        """Append a single item to target_countries list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"target_countries": firestore.ArrayUnion([country])})
    
    @staticmethod
    async def remove_target_country(user_id: str, country: str) -> None:
        """Remove a single item from target_countries list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"target_countries": firestore.ArrayRemove([country])})
    
    @staticmethod
    async def append_target_university(user_id: str, university: str) -> None:
        """Append a single item to target_universities list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"target_universities": firestore.ArrayUnion([university])})
    
    @staticmethod
    async def remove_target_university(user_id: str, university: str) -> None:
        """Remove a single item from target_universities list."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.DOC_PREFERENCES)
            .document(settings.DOC_PREFERENCES)
        )
        await doc_ref.update({"target_universities": firestore.ArrayRemove([university])})
