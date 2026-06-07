import asyncio
from uuid6 import uuid7

from src.integrations import google_client
from src.integrations.google_client import GoogleAuthError
from src.repositories.integrations_repo import IntegrationsRepository


class IntegrationsService:

    @staticmethod
    async def get_google_auth_url(user_id: str) -> str:
        """Create a single-use state nonce and return the Google consent URL."""
        nonce = uuid7().hex
        await IntegrationsRepository.create_oauth_state(nonce, user_id)
        return google_client.build_auth_url(nonce)

    @staticmethod
    async def handle_google_callback(code: str, state: str) -> str:
        """Exchange the code, store the refresh token, return the uid. Raises
        ValueError on a bad/expired state or a missing refresh token."""
        user_id = await IntegrationsRepository.consume_oauth_state(state)
        if not user_id:
            raise ValueError("Invalid or expired OAuth state")

        tokens = await asyncio.to_thread(google_client.exchange_code, code)
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            # Google omits it if the user already granted without prompt=consent;
            # we force prompt=consent, so treat absence as a retryable failure.
            raise ValueError("Google did not return a refresh token; please reconnect.")

        access_token = tokens.get("access_token", "")
        email = ""
        try:
            info = await asyncio.to_thread(google_client.get_userinfo, access_token)
            email = info.get("email", "")
        except GoogleAuthError:
            pass

        await IntegrationsRepository.save_google(
            user_id,
            refresh_token=refresh_token,
            scopes=tokens.get("scope", ""),
            email=email,
        )
        return user_id

    @staticmethod
    async def get_google_status(user_id: str) -> dict:
        rec = await IntegrationsRepository.get_google(user_id)
        if not rec:
            return {"connected": False, "email": None}
        return {"connected": True, "email": rec.get("email")}

    @staticmethod
    async def disconnect_google(user_id: str) -> None:
        rec = await IntegrationsRepository.get_google(user_id)
        if rec and rec.get("refresh_token"):
            await asyncio.to_thread(google_client.revoke, rec["refresh_token"])
        await IntegrationsRepository.delete_google(user_id)

    @staticmethod
    async def get_access_token(user_id: str) -> str:
        """Mint a fresh access token for API calls. Raises ValueError if the user
        hasn't connected Google."""
        rec = await IntegrationsRepository.get_google(user_id)
        if not rec or not rec.get("refresh_token"):
            raise ValueError("Google account not connected")
        return await asyncio.to_thread(google_client.refresh_access_token, rec["refresh_token"])
