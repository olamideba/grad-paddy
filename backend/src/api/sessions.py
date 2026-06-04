from fastapi import APIRouter, Depends, Request, Body, HTTPException
from src.core.firebase import verify_firebase_auth
from src.services.sessions_service import SessionService
from src.api.schemas.requests import (
    SessionCreateRequest,
    MessageCreateRequest,
    SessionRenameRequest,
    SessionGroupRequest,
)
from src.api.schemas.responses import (
    StandardResponse,
    SessionResponse,
    MessageResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[SessionResponse])
async def create_session(request: Request, body: SessionCreateRequest) -> dict:
    user_id = request.state.user_id
    session = await SessionService.create_session(user_id, body.first_message)
    return {"success": True, "data": session, "message": "Session created successfully"}


@router.get("/", response_model=StandardResponse[list[SessionResponse]])
async def list_sessions(request: Request) -> dict:
    user_id = request.state.user_id
    sessions = await SessionService.list_sessions(user_id)
    return {"success": True, "data": sessions, "message": ""}


@router.get("/{session_id}", response_model=StandardResponse[SessionResponse])
async def get_session(request: Request, session_id: str) -> dict:
    user_id = request.state.user_id
    try:
        session = await SessionService.get_session(user_id, session_id)
        return {"success": True, "data": session, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{session_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_session(request: Request, session_id: str) -> dict:
    user_id = request.state.user_id
    await SessionService.delete_session(user_id, session_id)
    return {"success": True, "data": {"status": "success"}, "message": "Session deleted successfully"}


@router.patch("/{session_id}/rename", response_model=StandardResponse[SessionResponse])
async def rename_session(request: Request, session_id: str, body: SessionRenameRequest) -> dict:
    user_id = request.state.user_id
    try:
        session = await SessionService.rename_session(user_id, session_id, body.title)
        return {"success": True, "data": session, "message": "Session renamed"}
    except ValueError as e:
        status = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=status, detail=str(e))


@router.patch("/{session_id}/star", response_model=StandardResponse[SessionResponse])
async def toggle_star(request: Request, session_id: str) -> dict:
    user_id = request.state.user_id
    try:
        session = await SessionService.toggle_star(user_id, session_id)
        return {"success": True, "data": session, "message": "Session star toggled"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{session_id}/group", response_model=StandardResponse[SessionResponse])
async def set_group(request: Request, session_id: str, body: SessionGroupRequest) -> dict:
    user_id = request.state.user_id
    try:
        session = await SessionService.set_group(user_id, session_id, body.group_id)
        return {"success": True, "data": session, "message": "Session group updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{session_id}/messages", response_model=StandardResponse[list[MessageResponse]])
async def list_messages(request: Request, session_id: str) -> dict:
    user_id = request.state.user_id
    messages = await SessionService.list_messages(user_id, session_id)
    return {"success": True, "data": messages, "message": ""}


@router.post("/{session_id}/messages", response_model=StandardResponse[MessageResponse])
async def create_message(request: Request, session_id: str, body: MessageCreateRequest) -> dict:
    user_id = request.state.user_id
    try:
        message = await SessionService.create_message(user_id, session_id, body.role, body.content)
        return {"success": True, "data": message, "message": "Message created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
