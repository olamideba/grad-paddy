import os
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.core.config import Settings

security_scheme = HTTPBearer()

def initialize_firebase(settings: Settings) -> None:
    try:
        firebase_admin.get_app()
        return
    except ValueError:
        pass

    service_account_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    if service_account_path:
        credential_path = Path(service_account_path)
        if not credential_path.is_file():
            raise RuntimeError(
                f"Firebase service account file not found: {credential_path}"
            )
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(credential_path)
        firebase_admin.initialize_app(credentials.Certificate(str(credential_path)))
        return

    firebase_admin.initialize_app()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> str:
    token = credentials.credentials 

    try:
        decoded_token = auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token.",
        ) from exc

    uid = decoded_token.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token missing uid.",
        )

    return uid

async def verify_firebase_auth(
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> str:
    request.state.user_id = user_id
    return user_id