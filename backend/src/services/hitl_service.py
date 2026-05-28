from google.api_core.exceptions import NotFound
from src.repositories.hitl_repo import HITLRepository


class HITLService:
    
    @staticmethod
    async def create_hitl(user_id: str, session_id: str, type: str, payload: dict) -> dict:
        """Create a pending HITL record."""
        return await HITLRepository.create_hitl(user_id, session_id, type, payload)

    @staticmethod
    async def get_pending_hitl(user_id: str, session_id: str) -> dict | None:
        """Get the active pending HITL record for a session, if any."""
        return await HITLRepository.get_pending_hitl_for_session(user_id, session_id)

    @staticmethod
    async def resolve_hitl(user_id: str, hitl_id: str, approved: bool) -> dict:
        """Resolve a HITL record by approving or rejecting it."""
        try:
            return await HITLRepository.resolve_hitl(user_id, hitl_id, approved)
        except NotFound as e:
            raise ValueError("HITL record not found") from e
