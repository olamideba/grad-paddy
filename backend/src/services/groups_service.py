from src.repositories.groups_repo import GroupRepository
from src.repositories.sessions_repo import SessionRepository

MAX_GROUP_NAME_LEN = 100


class GroupService:

    @staticmethod
    async def create_group(user_id: str, name: str) -> dict:
        """Create a named group for organising chat sessions."""
        clean = name.strip()[:MAX_GROUP_NAME_LEN]
        if not clean:
            raise ValueError("Group name cannot be empty")
        return await GroupRepository.create_group(user_id, clean)

    @staticmethod
    async def list_groups(user_id: str) -> list[dict]:
        """List a user's groups, newest first."""
        return await GroupRepository.list_groups(user_id)

    @staticmethod
    async def delete_group(user_id: str, group_id: str, delete_sessions: bool = False) -> None:
        """Delete a group. When delete_sessions is True, every session in the
        group (and its messages) is deleted too; otherwise those sessions are
        simply ungrouped (group_id cleared)."""
        group = await GroupRepository.get_group(user_id, group_id)
        if group is None:
            raise ValueError("Group not found")

        sessions = await SessionRepository.list_sessions(user_id)
        members = [s for s in sessions if s.get("group_id") == group_id]
        for s in members:
            if delete_sessions:
                await SessionRepository.delete_session(user_id, s["id"])
            else:
                await SessionRepository.update_session(user_id, s["id"], {"group_id": None})

        await GroupRepository.delete_group(user_id, group_id)
