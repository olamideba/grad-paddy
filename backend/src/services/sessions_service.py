from src.repositories.sessions_repo import SessionRepository


class SessionService:
    
    @staticmethod
    async def create_session(user_id: str, first_message: str) -> dict:
        """Generates title from first_message (first 60 chars), creates session and appends the first message."""
        title = first_message[:60].strip()
        if len(first_message) > 60:
            title += "..."
        
        session = await SessionRepository.create_session(user_id, title)
        
        # Add the first message
        await SessionRepository.create_message(user_id, session["id"], {
            "role": "user",
            "content": first_message,
        })
        
        return session

    @staticmethod
    async def get_session(user_id: str, session_id: str) -> dict:
        """Get a single session by ID."""
        session = await SessionRepository.get_session(user_id, session_id)
        if session is None:
            raise ValueError("Session not found")
        return session

    @staticmethod
    async def list_sessions(user_id: str) -> list[dict]:
        """List all sessions for a user, ordered by updated_at descending."""
        return await SessionRepository.list_sessions(user_id)

    @staticmethod
    async def delete_session(user_id: str, session_id: str) -> None:
        """Deletes session + all child messages."""
        await SessionRepository.delete_session(user_id, session_id)

    @staticmethod
    async def create_message(user_id: str, session_id: str, role: str, content: str) -> dict:
        """Append a message to a session and touch the session."""
        return await SessionRepository.create_message(user_id, session_id, {
            "role": role,
            "content": content,
        })

    @staticmethod
    async def list_messages(user_id: str, session_id: str) -> list[dict]:
        """List all messages in a session ordered by created_at ascending."""
        return await SessionRepository.list_messages(user_id, session_id)
