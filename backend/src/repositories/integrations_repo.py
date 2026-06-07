from datetime import datetime, timezone

from src.core.config import get_settings
from src.repositories.base import get_db


class IntegrationsRepository:
    """Per-user Google integration (refresh token) + short-lived OAuth state nonces."""

    @staticmethod
    def _google_ref(user_id: str):
        db = get_db()
        settings = get_settings()
        return (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INTEGRATIONS)
            .document(settings.DOC_GOOGLE_INTEGRATION)
        )

    @staticmethod
    async def save_google(user_id: str, *, refresh_token: str, scopes: str, email: str) -> dict:
        now = datetime.now(timezone.utc)
        data = {
            "refresh_token": refresh_token,
            "scopes": scopes,
            "email": email,
            "connected_at": now,
            "updated_at": now,
        }
        await IntegrationsRepository._google_ref(user_id).set(data)
        return data

    @staticmethod
    async def get_google(user_id: str) -> dict | None:
        doc = await IntegrationsRepository._google_ref(user_id).get()
        return doc.to_dict() if doc.exists else None

    @staticmethod
    async def delete_google(user_id: str) -> None:
        await IntegrationsRepository._google_ref(user_id).delete()

    # ── OAuth state (CSRF nonce → uid), top-level so the unauth callback can read it ──

    @staticmethod
    async def create_oauth_state(nonce: str, user_id: str) -> None:
        db = get_db()
        settings = get_settings()
        await (
            db.collection(settings.COLLECTION_OAUTH_STATES)
            .document(nonce)
            .set({"user_id": user_id, "created_at": datetime.now(timezone.utc)})
        )

    @staticmethod
    async def consume_oauth_state(nonce: str) -> str | None:
        """Return the uid for a state nonce and delete it (single-use)."""
        db = get_db()
        settings = get_settings()
        ref = db.collection(settings.COLLECTION_OAUTH_STATES).document(nonce)
        doc = await ref.get()
        if not doc.exists:
            return None
        await ref.delete()
        return (doc.to_dict() or {}).get("user_id")
