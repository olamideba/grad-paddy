from src.api.hitl_events import HITLRequiredEvent
from src.repositories.hitl_repo import HITLRepository


class HITLService:

    @staticmethod
    async def create_hitl(
        user_id: str,
        session_id: str,
        run_id: str,
        kind: str,
        title: str,
        description: str,
        payload: dict,
        tool_call_id: str,
        options: list[dict[str, str]] | None = None,
        input_schema: dict | None = None,
        expires_in_seconds: int | None = None,
    ) -> dict:
        """Create a pending HITL record."""
        expires_at = HITLRepository.default_expiry(expires_in_seconds)
        return await HITLRepository.create_hitl(
            user_id=user_id,
            session_id=session_id,
            run_id=run_id,
            kind=kind,
            title=title,
            description=description,
            payload=payload,
            tool_call_id=tool_call_id,
            options=options,
            input_schema=input_schema,
            expires_at=expires_at,
        )

    @staticmethod
    async def get_hitl(user_id: str, hitl_id: str) -> dict | None:
        return await HITLRepository.get_hitl(user_id, hitl_id)

    @staticmethod
    async def get_pending_hitl(user_id: str, session_id: str) -> dict | None:
        """Get the active pending HITL record for a session, if any."""
        return await HITLRepository.get_pending_hitl_for_session(user_id, session_id)

    @staticmethod
    async def resolve_hitl(
        user_id: str,
        hitl_id: str,
        decision: str,
        response: dict | None = None,
    ) -> tuple[dict, bool]:
        """Resolve a HITL record. Returns (record, newly_resolved)."""
        if decision not in {"approved", "rejected"}:
            raise ValueError("decision must be 'approved' or 'rejected'")
        try:
            return await HITLRepository.resolve_hitl(user_id, hitl_id, decision, response)
        except KeyError as e:
            raise ValueError("HITL record not found") from e

    @staticmethod
    async def mark_continued(user_id: str, hitl_id: str, run_id: str) -> dict:
        try:
            return await HITLRepository.mark_continued(user_id, hitl_id, run_id)
        except KeyError as e:
            raise ValueError("HITL record not found") from e

    @staticmethod
    def to_required_event(hitl: dict, session_id: str, run_id: str) -> HITLRequiredEvent:
        expires_at = hitl.get("expires_at")
        expires_iso = expires_at.isoformat() if expires_at else None
        return HITLRequiredEvent(
            hitl_id=hitl["id"],
            session_id=session_id,
            run_id=run_id,
            kind=hitl.get("kind", "approval"),
            title=hitl.get("title", "Approval required"),
            description=hitl.get("description", ""),
            payload=hitl.get("payload") or {},
            options=hitl.get("options"),
            input_schema=hitl.get("schema"),
            expires_at=expires_iso,
        )
