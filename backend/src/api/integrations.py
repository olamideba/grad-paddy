from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import RedirectResponse

from src.core.config import get_settings
from src.core.firebase import verify_firebase_auth
from src.services.integrations_service import IntegrationsService
from src.api.schemas.responses import (
    StandardResponse,
    GoogleStatusResponse,
    SuccessStatusResponse,
)

# No global auth dependency: the OAuth callback is hit by the browser via a
# Google redirect (no Authorization header). It authenticates via the state nonce.
router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/google/auth-url", response_model=StandardResponse[dict])
async def google_auth_url(user_id: str = Depends(verify_firebase_auth)) -> dict:
    url = await IntegrationsService.get_google_auth_url(user_id)
    return {"success": True, "data": {"url": url}, "message": ""}


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
) -> RedirectResponse:
    settings = get_settings()
    base = settings.FRONTEND_URL.rstrip("/")
    if error or not code or not state:
        return RedirectResponse(url=f"{base}/settings?google=error")
    try:
        await IntegrationsService.handle_google_callback(code, state)
        return RedirectResponse(url=f"{base}/settings?google=connected")
    except Exception:
        return RedirectResponse(url=f"{base}/settings?google=error")


@router.get("/google/status", response_model=StandardResponse[GoogleStatusResponse])
async def google_status(user_id: str = Depends(verify_firebase_auth)) -> dict:
    status = await IntegrationsService.get_google_status(user_id)
    return {"success": True, "data": status, "message": ""}


@router.delete("/google", response_model=StandardResponse[SuccessStatusResponse])
async def google_disconnect(user_id: str = Depends(verify_firebase_auth)) -> dict:
    await IntegrationsService.disconnect_google(user_id)
    return {"success": True, "data": {"status": "success"}, "message": "Google disconnected"}
