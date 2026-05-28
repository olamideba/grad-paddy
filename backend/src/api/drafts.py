from fastapi import APIRouter, Depends, Request, Body, HTTPException, Query
from src.core.firebase import verify_firebase_auth
from src.services.drafts_service import DraftsService
from src.api.schemas.requests import DraftCreateRequest, ContentUpdateRequest, StatusUpdateRequest
from src.api.schemas.responses import (
    StandardResponse,
    DraftResponse,
    DraftStatsResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/drafts", tags=["drafts"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[DraftResponse])
async def create_draft(request: Request, body: DraftCreateRequest) -> dict:
    user_id = request.state.user_id
    draft = await DraftsService.create_draft(user_id, body.model_dump())
    return {"success": True, "data": draft, "message": "Draft created successfully"}


@router.get("/", response_model=StandardResponse[list[DraftResponse]])
async def list_drafts(
    request: Request,
    type: str | None = Query(None),
    status: str | None = Query(None),
) -> dict:
    user_id = request.state.user_id
    drafts = await DraftsService.list_drafts(user_id, type, status)
    return {"success": True, "data": drafts, "message": ""}


@router.get("/stats", response_model=StandardResponse[DraftStatsResponse])
async def get_stats(request: Request) -> dict:
    user_id = request.state.user_id
    stats = await DraftsService.get_stats(user_id)
    return {"success": True, "data": stats, "message": ""}


@router.get("/{draft_id}", response_model=StandardResponse[DraftResponse])
async def get_draft(request: Request, draft_id: str) -> dict:
    user_id = request.state.user_id
    try:
        draft = await DraftsService.get_draft(user_id, draft_id)
        return {"success": True, "data": draft, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{draft_id}/content", response_model=StandardResponse[DraftResponse])
async def update_content(request: Request, draft_id: str, body: ContentUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        draft = await DraftsService.update_content(user_id, draft_id, body.content)
        return {"success": True, "data": draft, "message": "Draft content updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{draft_id}/status", response_model=StandardResponse[SuccessStatusResponse])
async def update_status(request: Request, draft_id: str, body: StatusUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        await DraftsService.update_status(user_id, draft_id, body.status)
        return {"success": True, "data": {"status": "success"}, "message": "Draft status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{draft_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_draft(request: Request, draft_id: str) -> dict:
    user_id = request.state.user_id
    try:
        await DraftsService.delete_draft(user_id, draft_id)
        return {"success": True, "data": {"status": "success"}, "message": "Draft deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
