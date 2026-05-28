from google.api_core.exceptions import NotFound
from src.repositories.tracker_repo import TrackerRepository


class TrackerService:
    
    @staticmethod
    async def create_application(user_id: str, data: dict) -> dict:
        """Create a new tracker entry."""
        return await TrackerRepository.create_application(user_id, data)

    @staticmethod
    async def get_application(user_id: str, application_id: str) -> dict:
        """Get a single tracker entry by ID."""
        app = await TrackerRepository.get_application(user_id, application_id)
        if app is None:
            raise ValueError("Application program not found")
        return app

    @staticmethod
    async def list_applications(user_id: str) -> list[dict]:
        """List all tracker entries ordered by deadline ascending."""
        return await TrackerRepository.list_applications(user_id)

    @staticmethod
    async def update_application(user_id: str, application_id: str, data: dict) -> dict:
        """Partial update on a tracker entry."""
        try:
            return await TrackerRepository.update_application(user_id, application_id, data)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def update_status(user_id: str, application_id: str, status: str) -> None:
        """Update application status."""
        try:
            await TrackerRepository.update_status(user_id, application_id, status)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def update_sop_status(user_id: str, application_id: str, sop_status: str) -> None:
        """Update sop_status field."""
        try:
            await TrackerRepository.update_sop_status(user_id, application_id, sop_status)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def update_cv_status(user_id: str, application_id: str, cv_status: str) -> None:
        """Update cv_status field."""
        try:
            await TrackerRepository.update_cv_status(user_id, application_id, cv_status)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def update_funded(user_id: str, application_id: str, funded: str) -> None:
        """Update funded field: 'yes' | 'no' | 'unknown'."""
        try:
            await TrackerRepository.update_funded(user_id, application_id, funded)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def add_recommender(user_id: str, application_id: str, recommender: dict) -> None:
        """Append a recommender object to the recommenders list."""
        await TrackerRepository.add_recommender(user_id, application_id, recommender)

    @staticmethod
    async def update_recommender_status(
        user_id: str, application_id: str, recommender_name: str, status: str
    ) -> None:
        """Update the status of a specific recommender within the list."""
        try:
            await TrackerRepository.update_recommender_status(user_id, application_id, recommender_name, status)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def delete_application(user_id: str, application_id: str) -> None:
        """Delete a tracker entry."""
        try:
            await TrackerRepository.delete_application(user_id, application_id)
        except NotFound as e:
            raise ValueError("Application record not found") from e

    @staticmethod
    async def get_stats(user_id: str) -> dict:
        """Get stats for tracker: sop_ready, recs_confirmed, funded_programs, total."""
        apps = await TrackerRepository.list_applications(user_id)
        total = len(apps)
        sop_ready = await TrackerRepository.count_by_sop_status(user_id, "ready")
        funded_programs = await TrackerRepository.count_funded(user_id)
        
        recs_confirmed = 0
        for app in apps:
            recommenders = app.get("recommenders") or []
            for rec in recommenders:
                if rec.get("status") in ("confirmed", "submitted"):
                    recs_confirmed += 1
                    
        return {
            "sop_ready": sop_ready,
            "recs_confirmed": recs_confirmed,
            "funded_programs": funded_programs,
            "total": total,
        }
