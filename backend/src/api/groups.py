from fastapi import APIRouter, Depends, Request, HTTPException
from src.core.firebase import verify_firebase_auth
from src.services.groups_service import GroupService
from src.api.schemas.requests import GroupCreateRequest
from src.api.schemas.responses import StandardResponse, GroupResponse, SuccessStatusResponse

router = APIRouter(prefix="/api/groups", tags=["groups"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[GroupResponse])
async def create_group(request: Request, body: GroupCreateRequest) -> dict:
    user_id = request.state.user_id
    try:
        group = await GroupService.create_group(user_id, body.name)
        return {"success": True, "data": group, "message": "Group created"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=StandardResponse[list[GroupResponse]])
async def list_groups(request: Request) -> dict:
    user_id = request.state.user_id
    groups = await GroupService.list_groups(user_id)
    return {"success": True, "data": groups, "message": ""}


@router.delete("/{group_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_group(request: Request, group_id: str, delete_sessions: bool = False) -> dict:
    """Delete a group. delete_sessions=true also deletes member chats; otherwise
    members are ungrouped."""
    user_id = request.state.user_id
    try:
        await GroupService.delete_group(user_id, group_id, delete_sessions)
        return {"success": True, "data": {"status": "success"}, "message": "Group deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
