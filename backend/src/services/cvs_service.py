from google.api_core.exceptions import NotFound

from src.repositories.cvs_repo import CVsRepository


class CVsService:

    @staticmethod
    async def create_cv(
        user_id: str,
        *,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        title: str | None = None,
    ) -> dict:
        return await CVsRepository.create_cv(
            user_id,
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
            title=title,
        )

    @staticmethod
    async def get_cv(user_id: str, cv_id: str) -> dict:
        cv = await CVsRepository.get_cv(user_id, cv_id)
        if cv is None:
            raise ValueError("CV record not found")
        return cv

    @staticmethod
    async def list_cvs(user_id: str) -> list[dict]:
        return await CVsRepository.list_cvs(user_id)

    @staticmethod
    async def download_cv(user_id: str, cv_id: str) -> tuple[bytes, str, str]:
        try:
            return await CVsRepository.download_cv(user_id, cv_id)
        except NotFound as e:
            raise ValueError("CV record not found") from e

    @staticmethod
    async def update_cv(user_id: str, cv_id: str, data: dict) -> dict:
        try:
            return await CVsRepository.update_cv(user_id, cv_id, data)
        except NotFound as e:
            raise ValueError("CV record not found") from e

    @staticmethod
    async def delete_cv(user_id: str, cv_id: str) -> None:
        try:
            await CVsRepository.delete_cv(user_id, cv_id)
        except NotFound as e:
            raise ValueError("CV record not found") from e
