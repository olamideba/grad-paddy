import asyncio

from google.api_core.exceptions import NotFound

from src.integrations import google_client
from src.repositories.emails_repo import EmailsRepository
from src.services.integrations_service import IntegrationsService
from src.services.shortlist_service import ShortlistService
from src.services.tracker_service import TrackerService


class EmailsService:

    @staticmethod
    async def create_email(user_id: str, data: dict) -> dict:
        return await EmailsRepository.create_email(user_id, data)

    @staticmethod
    async def get_email(user_id: str, email_id: str) -> dict:
        email = await EmailsRepository.get_email(user_id, email_id)
        if email is None:
            raise ValueError("Email record not found")
        return email

    @staticmethod
    async def list_emails(user_id: str) -> list[dict]:
        return await EmailsRepository.list_emails(user_id)

    @staticmethod
    async def update_email(user_id: str, email_id: str, data: dict) -> dict:
        try:
            return await EmailsRepository.update_email(user_id, email_id, data)
        except NotFound as e:
            raise ValueError("Email record not found") from e

    @staticmethod
    async def delete_email(user_id: str, email_id: str) -> None:
        try:
            await EmailsRepository.delete_email(user_id, email_id)
        except NotFound as e:
            raise ValueError("Email record not found") from e

    @staticmethod
    async def send_email(user_id: str, email_id: str) -> dict:
        """Send via the user's Gmail, mark sent, and bump the linked status.
        Raises ValueError if the email is missing, has no recipient, or Google
        isn't connected."""
        email = await EmailsRepository.get_email(user_id, email_id)
        if email is None:
            raise ValueError("Email record not found")
        if not email.get("to"):
            raise ValueError("Email has no recipient")

        access_token = await IntegrationsService.get_access_token(user_id)
        await asyncio.to_thread(
            google_client.gmail_send,
            access_token,
            to=email["to"],
            subject=email.get("subject", ""),
            body=email.get("body_markdown", ""),
        )
        sent = await EmailsRepository.mark_sent(user_id, email_id)
        await EmailsService._bump_status(user_id, email)
        return sent

    @staticmethod
    async def _bump_status(user_id: str, email: dict) -> None:
        """Best-effort: reflect the send in the related entity's status."""
        kind = email.get("kind")
        ref_id = email.get("ref_id")
        try:
            if kind == "faculty" and ref_id:
                await ShortlistService.update_outreach_status(user_id, ref_id, "contacted")
            elif kind == "recommender" and ref_id and email.get("linked_application_id"):
                await TrackerService.update_recommender_status(
                    user_id, email["linked_application_id"], ref_id, "asked"
                )
        except Exception:
            # Status bump is non-critical; the email already went out.
            pass
