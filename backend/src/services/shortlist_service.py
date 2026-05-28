from google.api_core.exceptions import NotFound
from src.repositories.shortlist_repo import ShortlistRepository


class ShortlistService:
    
    @staticmethod
    async def add_faculty(user_id: str, data: dict) -> dict:
        """Add a faculty member to the shortlist."""
        return await ShortlistRepository.create_faculty(user_id, data)

    @staticmethod
    async def get_faculty(user_id: str, faculty_id: str) -> dict:
        """Get a single faculty entry by ID."""
        faculty = await ShortlistRepository.get_faculty(user_id, faculty_id)
        if faculty is None:
            raise ValueError("Faculty member not found")
        return faculty

    @staticmethod
    async def list_shortlist(
        user_id: str, position_status: str | None = None, outreach_status: str | None = None
    ) -> list[dict]:
        """List shortlist entries with optional filters."""
        if position_status:
            return await ShortlistRepository.list_by_position_status(user_id, position_status)
        if outreach_status:
            return await ShortlistRepository.list_by_outreach_status(user_id, outreach_status)
        return await ShortlistRepository.list_shortlist(user_id)

    @staticmethod
    async def update_faculty(user_id: str, faculty_id: str, data: dict) -> dict:
        """Partial update on a faculty entry."""
        try:
            return await ShortlistRepository.update_faculty(user_id, faculty_id, data)
        except NotFound as e:
            raise ValueError("Shortlist record not found") from e

    @staticmethod
    async def update_outreach_status(user_id: str, faculty_id: str, status: str) -> None:
        """Update outreach_status."""
        try:
            await ShortlistRepository.update_outreach_status(user_id, faculty_id, status)
        except NotFound as e:
            raise ValueError("Shortlist record not found") from e

    @staticmethod
    async def delete_faculty(user_id: str, faculty_id: str) -> None:
        """Remove a faculty entry from the shortlist."""
        try:
            await ShortlistRepository.delete_faculty(user_id, faculty_id)
        except NotFound as e:
            raise ValueError("Shortlist record not found") from e

    @staticmethod
    async def get_stats(user_id: str) -> dict:
        """Get stats for shortlist: total, open_positions, contacted."""
        total_list = await ShortlistRepository.list_shortlist(user_id)
        total = len(total_list)
        open_positions = await ShortlistRepository.count_by_position_status(user_id, "open")
        contacted = await ShortlistRepository.count_by_outreach_status(user_id, "email_sent")
        return {
            "total": total,
            "open_positions": open_positions,
            "contacted": contacted,
        }
