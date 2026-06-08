from fastapi import APIRouter, Depends, Request, Body, HTTPException
from src.core.firebase import verify_firebase_auth
from src.services.tracker_service import TrackerService
from src.services.calendar_service import CalendarService
from src.api.schemas.requests import (
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    StatusUpdateRequest,
    SOPStatusUpdateRequest,
    CVStatusUpdateRequest,
    FundedUpdateRequest,
    RecommenderAddRequest,
    AttachmentAddRequest,
)
from src.api.schemas.responses import (
    StandardResponse,
    ApplicationResponse,
    TrackerStatsResponse,
    SuccessStatusResponse,
)

router = APIRouter(prefix="/api/tracker", tags=["tracker"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/", response_model=StandardResponse[ApplicationResponse])
async def create_application(request: Request, body: ApplicationCreateRequest) -> dict:
    user_id = request.state.user_id
    app = await TrackerService.create_application(user_id, body.model_dump())
    return {"success": True, "data": app, "message": "Application program created successfully"}


@router.get("/", response_model=StandardResponse[list[ApplicationResponse]])
async def list_applications(request: Request) -> dict:
    user_id = request.state.user_id
    apps = await TrackerService.list_applications(user_id)
    return {"success": True, "data": apps, "message": ""}


@router.get("/stats", response_model=StandardResponse[TrackerStatsResponse])
async def get_stats(request: Request) -> dict:
    user_id = request.state.user_id
    stats = await TrackerService.get_stats(user_id)
    return {"success": True, "data": stats, "message": ""}


@router.get("/{application_id}", response_model=StandardResponse[ApplicationResponse])
async def get_application(request: Request, application_id: str) -> dict:
    user_id = request.state.user_id
    try:
        app = await TrackerService.get_application(user_id, application_id)
        return {"success": True, "data": app, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{application_id}", response_model=StandardResponse[ApplicationResponse])
async def update_application(request: Request, application_id: str, body: ApplicationUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        app = await TrackerService.update_application(user_id, application_id, body.model_dump(exclude_unset=True))
        return {"success": True, "data": app, "message": "Application program updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{application_id}/status", response_model=StandardResponse[SuccessStatusResponse])
async def update_status(request: Request, application_id: str, body: StatusUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        await TrackerService.update_status(user_id, application_id, body.status)
        return {"success": True, "data": {"status": "success"}, "message": "Status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{application_id}/sop-status", response_model=StandardResponse[SuccessStatusResponse])
async def update_sop_status(request: Request, application_id: str, body: SOPStatusUpdateRequest) -> dict:
    user_id = request.state.user_id
    sop_status = body.sop_status or body.status
    if not sop_status:
        raise HTTPException(status_code=400, detail="Missing required field: sop_status or status")
    try:
        await TrackerService.update_sop_status(user_id, application_id, sop_status)
        return {"success": True, "data": {"status": "success"}, "message": "SOP status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{application_id}/cv-status", response_model=StandardResponse[SuccessStatusResponse])
async def update_cv_status(request: Request, application_id: str, body: CVStatusUpdateRequest) -> dict:
    user_id = request.state.user_id
    cv_status = body.cv_status or body.status
    if not cv_status:
        raise HTTPException(status_code=400, detail="Missing required field: cv_status or status")
    try:
        await TrackerService.update_cv_status(user_id, application_id, cv_status)
        return {"success": True, "data": {"status": "success"}, "message": "CV status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{application_id}/funded", response_model=StandardResponse[SuccessStatusResponse])
async def update_funded(request: Request, application_id: str, body: FundedUpdateRequest) -> dict:
    user_id = request.state.user_id
    funded = body.funded or body.status
    if not funded:
        raise HTTPException(status_code=400, detail="Missing required field: funded or status")
    try:
        await TrackerService.update_funded(user_id, application_id, funded)
        return {"success": True, "data": {"status": "success"}, "message": "Funded status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{application_id}/recommenders", response_model=StandardResponse[SuccessStatusResponse])
async def add_recommender(request: Request, application_id: str, body: RecommenderAddRequest) -> dict:
    user_id = request.state.user_id
    recommender = {
        "name": body.name,
        "status": body.status,
        "email": body.email,
    }
    await TrackerService.add_recommender(user_id, application_id, recommender)
    return {"success": True, "data": {"status": "success"}, "message": "Recommender added successfully"}


@router.patch("/{application_id}/recommenders/{name}/status", response_model=StandardResponse[SuccessStatusResponse])
async def update_recommender_status(
    request: Request, application_id: str, name: str, body: StatusUpdateRequest
) -> dict:
    user_id = request.state.user_id
    try:
        await TrackerService.update_recommender_status(user_id, application_id, name, body.status)
        return {"success": True, "data": {"status": "success"}, "message": "Recommender status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{application_id}/attachments", response_model=StandardResponse[ApplicationResponse])
async def add_attachment(request: Request, application_id: str, body: AttachmentAddRequest) -> dict:
    user_id = request.state.user_id
    try:
        app = await TrackerService.add_attachment(
            user_id, application_id, body.kind, body.ref_id, body.title
        )
        return {"success": True, "data": app, "message": "Attachment linked successfully"}
    except ValueError as e:
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)


@router.delete("/{application_id}/attachments/{ref_id}", response_model=StandardResponse[ApplicationResponse])
async def remove_attachment(request: Request, application_id: str, ref_id: str) -> dict:
    user_id = request.state.user_id
    try:
        app = await TrackerService.remove_attachment(user_id, application_id, ref_id)
        return {"success": True, "data": app, "message": "Attachment removed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{application_id}/calendar", response_model=StandardResponse[ApplicationResponse])
async def add_to_calendar(request: Request, application_id: str) -> dict:
    user_id = request.state.user_id
    try:
        app = await CalendarService.add_deadline_event(user_id, application_id)
        return {"success": True, "data": app, "message": "Added deadline to Google Calendar"}
    except ValueError as e:
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)


@router.delete("/{application_id}/calendar", response_model=StandardResponse[ApplicationResponse])
async def remove_from_calendar(request: Request, application_id: str) -> dict:
    user_id = request.state.user_id
    try:
        app = await CalendarService.remove_deadline_event(user_id, application_id)
        return {"success": True, "data": app, "message": "Removed deadline from Google Calendar"}
    except ValueError as e:
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)


@router.delete("/{application_id}", response_model=StandardResponse[SuccessStatusResponse])
async def delete_application(request: Request, application_id: str) -> dict:
    user_id = request.state.user_id
    try:
        await TrackerService.delete_application(user_id, application_id)
        return {"success": True, "data": {"status": "success"}, "message": "Application program deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
