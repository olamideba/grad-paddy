import asyncio
from datetime import datetime, timezone

from firebase_admin import storage
from google.api_core.exceptions import NotFound
from google.cloud import firestore
from uuid6 import uuid7

from src.core.config import get_settings
from src.repositories.base import get_db


def _bucket():
    """Default Firebase Storage bucket. Requires STORAGE_BUCKET configured at init."""
    return storage.bucket()


class CVsRepository:
    """CV / resume documents: metadata in Firestore, file bytes in Firebase Storage."""

    @staticmethod
    async def create_cv(
        user_id: str,
        *,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        title: str | None = None,
    ) -> dict:
        """Upload the file to Storage and persist a metadata doc."""
        db = get_db()
        settings = get_settings()
        cv_id = str(uuid7())
        now = datetime.now(timezone.utc)
        storage_path = f"users/{user_id}/cvs/{cv_id}/{filename}"

        def _upload() -> None:
            blob = _bucket().blob(storage_path)
            blob.upload_from_string(file_bytes, content_type=content_type)

        await asyncio.to_thread(_upload)

        cv = {
            "id": cv_id,
            "title": title or filename,
            "filename": filename,
            "content_type": content_type,
            "size": len(file_bytes),
            "status": "draft",
            "storage_path": storage_path,
            "created_at": now,
            "updated_at": now,
        }
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_CVS)
            .document(cv_id)
            .set(cv)
        )
        return cv

    @staticmethod
    async def get_cv(user_id: str, cv_id: str) -> dict | None:
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_CVS)
            .document(cv_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None

    @staticmethod
    async def list_cvs(user_id: str) -> list[dict]:
        db = get_db()
        settings = get_settings()
        query = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_CVS)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
        )
        docs = await query.get()
        return [doc.to_dict() for doc in docs]

    @staticmethod
    async def download_cv(user_id: str, cv_id: str) -> tuple[bytes, str, str]:
        """Return (bytes, content_type, filename) for streaming back to the client."""
        cv = await CVsRepository.get_cv(user_id, cv_id)
        if cv is None:
            raise NotFound("CV record not found")

        def _download() -> bytes:
            return _bucket().blob(cv["storage_path"]).download_as_bytes()

        data = await asyncio.to_thread(_download)
        return data, cv.get("content_type", "application/octet-stream"), cv.get("filename", "cv")

    @staticmethod
    async def update_cv(user_id: str, cv_id: str, data: dict) -> dict:
        """Update metadata only (title / status). Ignores unknown keys."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_CVS)
            .document(cv_id)
        )
        snapshot = await doc_ref.get()
        if not snapshot.exists:
            raise NotFound("CV record not found")

        allowed = {k: v for k, v in data.items() if k in ("title", "status") and v is not None}
        allowed["updated_at"] = datetime.now(timezone.utc)
        await doc_ref.update(allowed)
        doc = await doc_ref.get()
        return doc.to_dict() if doc.exists else {}

    @staticmethod
    async def delete_cv(user_id: str, cv_id: str) -> None:
        """Delete the Storage blob and the metadata doc."""
        db = get_db()
        settings = get_settings()
        doc_ref = (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_CVS)
            .document(cv_id)
        )
        snapshot = await doc_ref.get()
        if not snapshot.exists:
            raise NotFound("CV record not found")
        cv = snapshot.to_dict()

        def _delete_blob() -> None:
            try:
                _bucket().blob(cv["storage_path"]).delete()
            except NotFound:
                # Blob already gone; the metadata doc is the source of truth.
                pass

        await asyncio.to_thread(_delete_blob)
        await doc_ref.delete()
