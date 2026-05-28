from google.api_core.exceptions import NotFound
from src.repositories.drafts_repo import DraftsRepository


class DraftsService:
    
    @staticmethod
    async def create_draft(user_id: str, data: dict) -> dict:
        """Create a new draft document."""
        return await DraftsRepository.create_draft(user_id, data)

    @staticmethod
    async def get_draft(user_id: str, draft_id: str) -> dict:
        """Get a single draft by ID."""
        draft = await DraftsRepository.get_draft(user_id, draft_id)
        if draft is None:
            raise ValueError("Draft document not found")
        return draft

    @staticmethod
    async def list_drafts(
        user_id: str, type: str | None = None, status: str | None = None
    ) -> list[dict]:
        """List drafts with optional client-side filters to avoid compound indexes."""
        drafts = await DraftsRepository.list_drafts(user_id)
        if type:
            drafts = [d for d in drafts if d.get("type") == type]
        if status:
            drafts = [d for d in drafts if d.get("status") == status]
        return drafts

    @staticmethod
    async def update_content(user_id: str, draft_id: str, content: str) -> dict:
        """Update draft content and recalculate word count."""
        try:
            return await DraftsRepository.update_draft_content(user_id, draft_id, content)
        except NotFound as e:
            raise ValueError("Draft record not found") from e

    @staticmethod
    async def update_status(user_id: str, draft_id: str, status: str) -> None:
        """Update draft approval/review status."""
        try:
            await DraftsRepository.update_status(user_id, draft_id, status)
        except NotFound as e:
            raise ValueError("Draft record not found") from e

    @staticmethod
    async def delete_draft(user_id: str, draft_id: str) -> None:
        """Delete a draft."""
        try:
            await DraftsRepository.delete_draft(user_id, draft_id)
        except NotFound as e:
            raise ValueError("Draft record not found") from e

    @staticmethod
    async def get_stats(user_id: str) -> dict:
        """Get stats for drafts: total, approved, need_review."""
        drafts = await DraftsRepository.list_drafts(user_id)
        total = len(drafts)
        approved = await DraftsRepository.count_by_status(user_id, "approved")
        need_review = await DraftsRepository.count_by_status(user_id, "in_review")
        return {
            "total": total,
            "approved": approved,
            "need_review": need_review,
        }
