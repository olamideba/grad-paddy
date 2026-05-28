from fastapi import APIRouter, Depends, Request, Body, HTTPException
from src.core.firebase import verify_firebase_auth
from src.services.users_service import UserService
from src.api.schemas.requests import (
    ProfileCreateRequest,
    ProfileUpdateRequest,
    PreferencesUpdateRequest,
    ValueRequest,
)
from src.api.schemas.responses import (
    StandardResponse,
    ProfileResponse,
    PreferencesResponse,
)

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(verify_firebase_auth)])


@router.post("/me", response_model=StandardResponse[ProfileResponse])
async def create_or_fetch_profile(request: Request, body: ProfileCreateRequest) -> dict:
    user_id = request.state.user_id
    profile = await UserService.get_or_create_profile(user_id, body.email, body.name, body.avatar_url)
    return {"success": True, "data": profile, "message": "Profile created or fetched successfully"}


@router.get("/me", response_model=StandardResponse[ProfileResponse])
async def get_profile(request: Request) -> dict:
    user_id = request.state.user_id
    try:
        profile = await UserService.get_profile(user_id)
        return {"success": True, "data": profile, "message": ""}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/me", response_model=StandardResponse[ProfileResponse])
async def update_profile(request: Request, body: ProfileUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        profile = await UserService.update_profile(user_id, body.model_dump(exclude_unset=True))
        return {"success": True, "data": profile, "message": "Profile updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/me/preferences", response_model=StandardResponse[PreferencesResponse])
async def get_preferences(request: Request) -> dict:
    user_id = request.state.user_id
    pref = await UserService.get_preferences(user_id)
    if pref is None:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return {"success": True, "data": pref, "message": ""}


@router.put("/me/preferences", response_model=StandardResponse[PreferencesResponse])
async def upsert_preferences(request: Request, body: PreferencesUpdateRequest) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.upsert_preferences(user_id, body.model_dump())
        return {"success": True, "data": pref, "message": "Preferences updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/me/preferences/research-interests", response_model=StandardResponse[PreferencesResponse])
async def append_research_interest(request: Request, body: ValueRequest) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.append_research_interest(user_id, body.value)
        return {"success": True, "data": pref, "message": "Research interest appended successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/me/preferences/research-interests/{value}", response_model=StandardResponse[PreferencesResponse])
async def remove_research_interest(request: Request, value: str) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.remove_research_interest(user_id, value)
        return {"success": True, "data": pref, "message": "Research interest removed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/me/preferences/countries", response_model=StandardResponse[PreferencesResponse])
async def append_target_country(request: Request, body: ValueRequest) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.append_target_country(user_id, body.value)
        return {"success": True, "data": pref, "message": "Target country appended successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/me/preferences/countries/{value}", response_model=StandardResponse[PreferencesResponse])
async def remove_target_country(request: Request, value: str) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.remove_target_country(user_id, value)
        return {"success": True, "data": pref, "message": "Target country removed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/me/preferences/universities", response_model=StandardResponse[PreferencesResponse])
async def append_target_university(request: Request, body: ValueRequest) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.append_target_university(user_id, body.value)
        return {"success": True, "data": pref, "message": "Target university appended successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/me/preferences/universities/{value}", response_model=StandardResponse[PreferencesResponse])
async def remove_target_university(request: Request, value: str) -> dict:
    user_id = request.state.user_id
    try:
        pref = await UserService.remove_target_university(user_id, value)
        return {"success": True, "data": pref, "message": "Target university removed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
