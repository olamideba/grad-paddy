import logging

from google.api_core.exceptions import NotFound
from google.genai import Client

from src.repositories.sessions_repo import SessionRepository
from src.repositories.groups_repo import GroupRepository

logger = logging.getLogger(__name__)

# The cheapest/fastest model — title generation is a tiny task.
_TITLE_MODEL = "gemini-2.5-flash-lite"
_genai_client = Client()

MAX_TITLE_LEN = 200


class SessionService:
    
    @staticmethod
    async def _generate_title(first_message: str) -> str:
        """Use a cheap LLM call to generate a concise session title. Falls back to truncation."""
        try:
            prompt = (
                "Generate a concise chat session title (maximum 6 words, no quotes, no punctuation) "
                "that captures the main intent of this message. Reply with the title only.\n\n"
                f"Message: {first_message[:300]}"
            )
            response = await _genai_client.aio.models.generate_content(
                model=_TITLE_MODEL,
                contents=prompt,
            )
            title = (response.text or "").strip().strip('"\'')
            if title:
                return title[:MAX_TITLE_LEN]
        except Exception as exc:
            logger.warning("Title generation failed, falling back to truncation: %s", exc)

        # Fallback: simple truncation
        title = first_message[:60].strip()
        if len(first_message) > 60:
            title += "..."
        return title

    @staticmethod
    async def create_session(user_id: str, first_message: str) -> dict:
        """Generates an LLM title from first_message, creates session and appends the first message."""
        title = await SessionService._generate_title(first_message)

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
    async def rename_session(user_id: str, session_id: str, title: str) -> dict:
        """Set a custom title on a session."""
        clean = title.strip()[:MAX_TITLE_LEN]
        if not clean:
            raise ValueError("Title cannot be empty")
        try:
            return await SessionRepository.update_session(user_id, session_id, {"title": clean})
        except NotFound as e:
            raise ValueError("Session not found") from e

    @staticmethod
    async def toggle_star(user_id: str, session_id: str) -> dict:
        """Flip the starred flag on a session."""
        session = await SessionRepository.get_session(user_id, session_id)
        if session is None:
            raise ValueError("Session not found")
        new_value = not session.get("starred", False)
        return await SessionRepository.update_session(
            user_id, session_id, {"starred": new_value}
        )

    @staticmethod
    async def set_group(user_id: str, session_id: str, group_id: str | None) -> dict:
        """Assign a session to a group, or clear it when group_id is falsy."""
        normalized = group_id or None
        if normalized is not None:
            group = await GroupRepository.get_group(user_id, normalized)
            if group is None:
                raise ValueError("Group not found")
        try:
            return await SessionRepository.update_session(
                user_id, session_id, {"group_id": normalized}
            )
        except NotFound as e:
            raise ValueError("Session not found") from e

    @staticmethod
    async def create_message(user_id: str, session_id: str, role: str, content: str) -> dict:
        """Append a message to a session and touch the session."""
        try:
            return await SessionRepository.create_message(user_id, session_id, {
                "role": role,
                "content": content,
            })
        except NotFound as e:
            raise ValueError("Session not found") from e

    @staticmethod
    async def list_messages(user_id: str, session_id: str) -> list[dict]:
        """List all messages in a session ordered by created_at ascending."""
        return await SessionRepository.list_messages(user_id, session_id)
