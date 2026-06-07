import logging
import uuid
from typing import Any, Optional

from google.adk.sessions.base_session_service import BaseSessionService, GetSessionConfig, ListSessionsResponse
from google.adk.sessions.session import Session
from google.adk.events.event import Event

from src.repositories.sessions_repo import SessionRepository
from src.core.config import get_settings
from src.repositories.base import get_db

logger = logging.getLogger(__name__)


class FirestoreSessionService(BaseSessionService):
    """ADK SessionService that persists session state to Firestore."""

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        if not session_id:
            session_id = str(uuid.uuid4())
            
        session = Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=state or {},
            events=[],
        )
        
        try:
            await SessionRepository.upsert_adk_session_state(
                user_id, session_id, session.model_dump_json()
            )
        except Exception as e:
            logger.error("Failed to persist new ADK session to Firestore: %s", e)
            
        return session

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        try:
            session_json = await SessionRepository.get_adk_session_state(user_id, session_id)
            if session_json:
                session = Session.model_validate_json(session_json)
                return session
        except Exception as e:
            logger.error("Failed to load ADK session %s from Firestore: %s", session_id, e)
            
        return None

    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        sessions_list = []
        if user_id:
            try:
                db_sessions = await SessionRepository.list_sessions(user_id)
                for db_s in db_sessions:
                    s_id = db_s.get("id")
                    if s_id:
                        s_json = await SessionRepository.get_adk_session_state(user_id, s_id)
                        if s_json:
                            sessions_list.append(Session.model_validate_json(s_json))
            except Exception as e:
                logger.error("Failed to list ADK sessions from Firestore: %s", e)
                
        return ListSessionsResponse(sessions=sessions_list)

    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        try:
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
            await doc_ref.delete()
        except Exception as e:
            logger.error("Failed to delete ADK session %s from Firestore: %s", session_id, e)

    async def append_event(self, session: Session, event: Event) -> Event:
        event = await super().append_event(session, event)
        
        try:
            await SessionRepository.upsert_adk_session_state(
                session.user_id, session.id, session.model_dump_json()
            )
        except Exception as e:
            logger.error("Failed to persist updated ADK session %s to Firestore: %s", session.id, e)
            
        return event
