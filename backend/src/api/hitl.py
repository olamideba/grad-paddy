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


@router.post("/{hitl_id}/resolve", response_model=StandardResponse[HITLResponse])
async def resolve_hitl(request: Request, hitl_id: str, body: HITLResolveRequest) -> dict:
    user_id = request.state.user_id
    try:
        resolved = await HITLService.resolve_hitl(user_id, hitl_id, body.approved)
        return {"success": True, "data": resolved, "message": "HITL resolved successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
