from datetime import datetime, timezone
from uuid6 import uuid7
from google.cloud import firestore
from src.core.config import get_settings
from src.repositories.base import get_db


class SessionRepository:

    # ── Sessions ──────────────────────────────────────────────────

    @staticmethod
    async def create_session(user_id: str, title: str) -> dict:
        """Create a new session. ID is uuid7. Returns the created session."""
        db = get_db()
        settings = get_settings()
        session_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        session = {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .set(session)
        )
        return session
    
    @staticmethod
    async def get_session(user_id: str, session_id: str) -> dict | None:
        """Get a single session by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def list_sessions(user_id: str) -> list[dict]:
        """List all sessions for a user, ordered by updated_at descending.
        Used to render chat history in the sidebar."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def update_session_title(user_id: str, session_id: str, title: str) -> None:
        """Update the auto-generated title of a session."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
        )
        await doc_ref.update({"title": title, "updated_at": datetime.now(timezone.utc)})
    
    @staticmethod
    async def update_session(user_id: str, session_id: str, fields: dict) -> dict:
        """Partial-update a session with the given fields and return the updated doc.

        Deliberately does NOT touch updated_at — metadata edits (rename / star /
        group) must not reorder the chat history. Raises NotFound if missing.
        """
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
        )
        await doc_ref.update(fields)
        updated = await doc_ref.get()
        return updated.to_dict()

    @staticmethod
    async def touch_session(user_id: str, session_id: str) -> None:
        """Update updated_at to now. Called on every new message."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
        )
        await doc_ref.update({"updated_at": datetime.now(timezone.utc)})
    
    @staticmethod
    async def delete_session(user_id: str, session_id: str) -> None:
        """Delete a session and all its messages."""
        db = get_db()
        settings = get_settings()
        
        session_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
        )
        
        # Delete all messages in the session subcollection first
        messages_ref = session_ref.collection(settings.COLLECTION_MESSAGES)
        messages = await messages_ref.get()
        batch = db.batch()
        for msg in messages:
            batch.delete(msg.reference)
        batch.delete(session_ref)
        await batch.commit()

    # ── Messages ──────────────────────────────────────────────────

    @staticmethod
    async def create_message(user_id: str, session_id: str, data: dict) -> dict:
        """Append a message to a session. ID is uuid7."""
        db = get_db()
        settings = get_settings()
        message_id = str(uuid7())
        now = datetime.now(timezone.utc)
        
        message = {
            "id": message_id,
            "role": data.get("role", "user"),
            "content": data.get("content", ""),
            "created_at": data.get("created_at") or now,
            "ag_ui_events": data.get("ag_ui_events") or [],
        }
        
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection(settings.COLLECTION_MESSAGES)
            .document(message_id)
            .set(message)
        )
        
        # Also touch the session to update updated_at
        await SessionRepository.touch_session(user_id, session_id)
        
        return message

    @staticmethod
    async def upsert_message(
        user_id: str, session_id: str, message_id: str, data: dict
    ) -> dict:
        """Create or update a message using a known message id.

        This is used for AG-UI assistant turns, where the streamed
        TEXT_MESSAGE_START/TEXT_MESSAGE_END pair already carries the final
        message id and the backend needs to persist the completed event buffer
        against that document.
        """
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection(settings.COLLECTION_MESSAGES)
            .document(message_id)
        )

        existing_doc = await doc_ref.get()
        existing = existing_doc.to_dict() if existing_doc.exists else {}
        now = datetime.now(timezone.utc)

        message = {
            "id": message_id,
            "role": data.get("role", existing.get("role", "assistant")),
            "content": data.get("content", existing.get("content", "")),
            "ag_ui_events": data.get("ag_ui_events") or existing.get("ag_ui_events") or [],
            "created_at": existing.get("created_at") or data.get("created_at") or now,
        }

        await doc_ref.set(message, merge=True)
        await SessionRepository.touch_session(user_id, session_id)
        return message
    
    @staticmethod
    async def list_messages(user_id: str, session_id: str) -> list[dict]:
        """List all messages in a session ordered by created_at ascending."""
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection(settings.COLLECTION_MESSAGES)
            .order_by("created_at", direction=firestore.Query.ASCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]
    
    @staticmethod
    async def get_message(user_id: str, session_id: str, message_id: str) -> dict | None:
        """Get a single message by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection(settings.COLLECTION_MESSAGES)
            .document(message_id)
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
    
    @staticmethod
    async def append_ag_ui_events(
        user_id: str, session_id: str, message_id: str, events: list[dict]
    ) -> None:
        """Persist AG-UI event payloads on a message document."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection(settings.COLLECTION_MESSAGES)
            .document(message_id)
        )
        await doc_ref.set({"ag_ui_events": events}, merge=True)

    # ── ADK Internal State ────────────────────────────────────────

    @staticmethod
    async def get_adk_session_state(user_id: str, session_id: str) -> str | None:
        """Get the serialized ADK Session object."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection("adk")
            .document("state")
            .get()
        )
        if doc.exists:
            return doc.to_dict().get("session_json")
        return None

    @staticmethod
    async def upsert_adk_session_state(user_id: str, session_id: str, session_json: str) -> None:
        """Persist the serialized ADK Session object."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_SESSIONS)
            .document(session_id)
            .collection("adk")
            .document("state")
        )
        await doc_ref.set({"session_json": session_json})
