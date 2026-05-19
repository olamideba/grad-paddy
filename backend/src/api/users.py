from fastapi import APIRouter, Depends

from src.core.firebase import get_current_user_id

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}
