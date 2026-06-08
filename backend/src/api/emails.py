from fastapi import APIRouter, Depends, Request, HTTPException

from src.core.firebase import verify_firebase_auth
from src.services.emails_service import EmailsService
from src.api.schemas.requests import EmailCreateRequest, EmailUpdateRequest
from src.api.schemas.responses import (
    StandardResponse,
    EmailResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/emails", tags=["emails"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[EmailResponse])
async def create_email(request: Request, body: EmailCreateRequest) -> dict:
    user_id = request.state.user_id
    email = await EmailsService.create_email(user_id, body.model_dump())
    return {"success": True, "data": email, "message": "Email draft created"}


@router.get("/", response_model=StandardResponse[list[EmailResponse]])
async def list_emails(request: Request) -> dict:
    user_id = request.state.user_id
    emails = await EmailsService.list_emails(user_id)
    return {"success": True, "data": emails, "message": ""}


@router.get("/{email_id}", response_model=StandardResponse[EmailResponse])
async def get_email(request: Request, email_id: str) -> dict:
    user_id = request.state.user_id
    try:
        email = await EmailsService.get_email(user_id, email_id)
        return {"success": True, "data": email, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{email_id}", response_model=StandardResponse[EmailResponse])
async def update_email(request: Request, email_id: str, body: EmailUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        email = await EmailsService.update_email(user_id, email_id, body.model_dump(exclude_unset=True))
        return {"success": True, "data": email, "message": "Email updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{email_id}/send", response_model=StandardResponse[EmailResponse])
async def send_email(request: Request, email_id: str) -> dict:
    user_id = request.state.user_id
    try:
        email = await EmailsService.send_email(user_id, email_id)
        return {"success": True, "data": email, "message": "Email sent"}
    except ValueError as e:
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)


@router.delete("/{email_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_email(request: Request, email_id: str) -> dict:
    user_id = request.state.user_id
    try:
        await EmailsService.delete_email(user_id, email_id)
        return {"success": True, "data": {"status": "success"}, "message": "Email deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
