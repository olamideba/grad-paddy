from datetime import datetime, timezone

from google.api_core.exceptions import NotFound
from google.cloud import firestore
from uuid6 import uuid7

from src.core.config import get_settings
from src.repositories.base import get_db


class EmailsRepository:
    """Agent-drafted emails (faculty outreach / recommender requests)."""

    @staticmethod
    def _col(user_id: str):
        db = get_db()
        settings = get_settings()
        return (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_EMAILS)
        )

    @staticmethod
    async def create_email(user_id: str, data: dict) -> dict:
        email_id = str(uuid7())
        now = datetime.now(timezone.utc)
        email = {
            "id": email_id,
            "to": data.get("to", ""),
            "subject": data.get("subject", ""),
            "body_markdown": data.get("body_markdown", ""),
            "kind": data.get("kind", "faculty"),       # 'faculty' | 'recommender'
            "ref_id": data.get("ref_id"),              # faculty id or recommender name
            "linked_application_id": data.get("linked_application_id"),
            "status": "draft",                          # 'draft' | 'sent'
            "sent_at": None,
            "created_at": now,
            "updated_at": now,
        }
        await EmailsRepository._col(user_id).document(email_id).set(email)
        return email

    @staticmethod
    async def get_email(user_id: str, email_id: str) -> dict | None:
        doc = await EmailsRepository._col(user_id).document(email_id).get()
        return doc.to_dict() if doc.exists else None

    @staticmethod
    async def list_emails(user_id: str) -> list[dict]:
        query = EmailsRepository._col(user_id).order_by(
            "updated_at", direction=firestore.Query.DESCENDING
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]

    @staticmethod
    async def update_email(user_id: str, email_id: str, data: dict) -> dict:
        ref = EmailsRepository._col(user_id).document(email_id)
        snapshot = await ref.get()
        if not snapshot.exists:
            raise NotFound("Email record not found")
        allowed = {
            k: v for k, v in data.items()
            if k in ("to", "subject", "body_markdown") and v is not None
        }
        allowed["updated_at"] = datetime.now(timezone.utc)
        await ref.update(allowed)
        doc = await ref.get()
        return doc.to_dict() if doc.exists else {}

    @staticmethod
    async def mark_sent(user_id: str, email_id: str) -> dict:
        ref = EmailsRepository._col(user_id).document(email_id)
        now = datetime.now(timezone.utc)
        await ref.update({"status": "sent", "sent_at": now, "updated_at": now})
        doc = await ref.get()
        return doc.to_dict() if doc.exists else {}

    @staticmethod
    async def delete_email(user_id: str, email_id: str) -> None:
        ref = EmailsRepository._col(user_id).document(email_id)
        doc = await ref.get()
        if not doc.exists:
            raise NotFound("Email record not found")
        await ref.delete()
