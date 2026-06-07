from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import Response

from src.core.firebase import verify_firebase_auth
from src.services.cvs_service import CVsService
from src.api.schemas.requests import CVUpdateRequest
from src.api.schemas.responses import (
    StandardResponse,
    CVResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/cvs", tags=["cvs"], dependencies=[Depends(verify_firebase_auth)])

# 10 MB cap; accept common resume formats.
MAX_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post("/", response_model=StandardResponse[CVResponse])
async def upload_cv(
    request: Request,
    file: UploadFile = File(...),
    title: str | None = Form(None),
) -> dict:
    user_id = request.state.user_id
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Only PDF or Word documents are allowed.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 10 MB limit.")

    cv = await CVsService.create_cv(
        user_id,
        file_bytes=file_bytes,
        filename=file.filename or "cv",
        content_type=content_type,
        title=title,
    )
    return {"success": True, "data": cv, "message": "CV uploaded successfully"}


@router.get("/", response_model=StandardResponse[list[CVResponse]])
async def list_cvs(request: Request) -> dict:
    user_id = request.state.user_id
    cvs = await CVsService.list_cvs(user_id)
    return {"success": True, "data": cvs, "message": ""}


@router.get("/{cv_id}/download")
async def download_cv(request: Request, cv_id: str) -> Response:
    user_id = request.state.user_id
    try:
        data, content_type, filename = await CVsService.download_cv(user_id, cv_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.patch("/{cv_id}", response_model=StandardResponse[CVResponse])
async def update_cv(request: Request, cv_id: str, body: CVUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        cv = await CVsService.update_cv(user_id, cv_id, body.model_dump(exclude_unset=True))
        return {"success": True, "data": cv, "message": "CV updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{cv_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_cv(request: Request, cv_id: str) -> dict:
    user_id = request.state.user_id
    try:
        await CVsService.delete_cv(user_id, cv_id)
        return {"success": True, "data": {"status": "success"}, "message": "CV deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
