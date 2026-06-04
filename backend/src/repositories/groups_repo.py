from datetime import datetime, timezone
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class GroupRepository:
    """Chat-session groups (user-created folders). Stored under
    users/{user_id}/groups/{group_id}."""

    @staticmethod
    def _collection(user_id: str):
        db = get_db()
        settings = get_settings()
        return (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_GROUPS)
        )

    @staticmethod
    async def create_group(user_id: str, name: str) -> dict:
        """Create a group. ID is uuid7. Returns the created group."""
        group_id = str(uuid7())
        now = datetime.now(timezone.utc)
        group = {"id": group_id, "name": name, "created_at": now}
        await GroupRepository._collection(user_id).document(group_id).set(group)
        return group

    @staticmethod
    async def list_groups(user_id: str) -> list[dict]:
        """List a user's groups, newest first."""
        query = GroupRepository._collection(user_id).order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]

    @staticmethod
    async def get_group(user_id: str, group_id: str) -> dict | None:
        """Get a single group by ID, or None if missing."""
        doc = await GroupRepository._collection(user_id).document(group_id).get()
        return doc.to_dict() if doc.exists else None

    @staticmethod
    async def delete_group(user_id: str, group_id: str) -> None:
        """Delete the group document itself (does not touch member sessions)."""
        await GroupRepository._collection(user_id).document(group_id).delete()
