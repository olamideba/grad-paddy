import logging
from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from src.core.firebase import verify_firebase_auth
from src.services.hitl_service import HITLService
from src.api.schemas.requests import HITLResolveRequest
from src.api.schemas.responses import StandardResponse, HITLResponse

router = APIRouter(prefix="/api/hitl", tags=["hitl"], dependencies=[Depends(verify_firebase_auth)])


@router.get("/sessions/{session_id}/pending", response_model=StandardResponse[Optional[HITLResponse]])
async def get_pending_hitl(request: Request, session_id: str) -> dict:
    user_id = request.state.user_id
    hitl = await HITLService.get_pending_hitl(user_id, session_id)
    return {"success": True, "data": hitl, "message": ""}


@router.get("/sessions/{session_id}", response_model=StandardResponse[list[HITLResponse]])
async def list_session_hitl(request: Request, session_id: str) -> dict:
    """All HITL records (pending + resolved) for a session, oldest first.

    Lets the client rebuild approval gates and result cards on reload."""
    user_id = request.state.user_id
    records = await HITLService.list_hitl(user_id, session_id)
    return {"success": True, "data": records, "message": ""}


@router.post("/{hitl_id}/resolve", response_model=StandardResponse[HITLResponse])
async def resolve_hitl(request: Request, hitl_id: str, body: HITLResolveRequest) -> dict:
    user_id = request.state.user_id
    try:
        resolved, _created = await HITLService.resolve_hitl(
            user_id, hitl_id, body.decision, body.response
        )
        return {"success": True, "data": resolved, "message": "HITL resolved successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # The approved change failed to persist. The gate is left pending (see
        # resolve_hitl), so the client must NOT show "Saved" — surface the failure.
        logging.getLogger(__name__).error(
            "Failed to apply approved HITL %s: %s", hitl_id, e, exc_info=True
        )
        raise HTTPException(status_code=500, detail="Failed to apply the approved change.")
