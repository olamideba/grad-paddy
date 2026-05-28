from fastapi import APIRouter, Depends, Request, HTTPException, Query
from src.core.firebase import verify_firebase_auth
from src.services.shortlist_service import ShortlistService
from src.api.schemas.requests import (
    FacultyCreateRequest,
    FacultyUpdateRequest,
    OutreachStatusUpdateRequest,
)
from src.api.schemas.responses import (
    StandardResponse,
    FacultyResponse,
    ShortlistStatsResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/shortlist", tags=["shortlist"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[FacultyResponse])
async def add_faculty(request: Request, body: FacultyCreateRequest) -> dict:
    user_id = request.state.user_id
    faculty = await ShortlistService.add_faculty(user_id, body.model_dump())
    return {"success": True, "data": faculty, "message": "Faculty member added successfully"}


@router.get("/", response_model=StandardResponse[list[FacultyResponse]])
async def list_shortlist(
    request: Request,
    position_status: str | None = Query(None),
    outreach_status: str | None = Query(None),
) -> dict:
    user_id = request.state.user_id
    faculty_list = await ShortlistService.list_shortlist(user_id, position_status, outreach_status)
    return {"success": True, "data": faculty_list, "message": ""}


@router.get("/stats", response_model=StandardResponse[ShortlistStatsResponse])
async def get_stats(request: Request) -> dict:
    user_id = request.state.user_id
    stats = await ShortlistService.get_stats(user_id)
    return {"success": True, "data": stats, "message": ""}


@router.get("/{faculty_id}", response_model=StandardResponse[FacultyResponse])
async def get_faculty(request: Request, faculty_id: str) -> dict:
    user_id = request.state.user_id
    try:
        faculty = await ShortlistService.get_faculty(user_id, faculty_id)
        return {"success": True, "data": faculty, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{faculty_id}", response_model=StandardResponse[FacultyResponse])
async def update_faculty(request: Request, faculty_id: str, body: FacultyUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        faculty = await ShortlistService.update_faculty(user_id, faculty_id, body.model_dump(exclude_unset=True))
        return {"success": True, "data": faculty, "message": "Faculty member updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{faculty_id}/outreach-status", response_model=StandardResponse[SuccessStatusResponse])
async def update_outreach_status(request: Request, faculty_id: str, body: OutreachStatusUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        await ShortlistService.update_outreach_status(user_id, faculty_id, body.status)
        return {"success": True, "data": {"status": "success"}, "message": "Outreach status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{faculty_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_faculty(request: Request, faculty_id: str) -> dict:
    user_id = request.state.user_id
    try:
        await ShortlistService.delete_faculty(user_id, faculty_id)
        return {"success": True, "data": {"status": "success"}, "message": "Faculty member deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
