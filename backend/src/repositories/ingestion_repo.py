from datetime import datetime, timezone
from uuid6 import uuid7
from src.repositories.base import get_db
from src.core.config import get_settings


class IngestionRepository:

    @staticmethod
    async def create_job(user_id: str, url: str, url_type: str) -> dict:
        """Create a new ingestion job record."""
        db = get_db()
        settings = get_settings()

        job_id = str(uuid7())
        now = datetime.now(timezone.utc)

        job = {
            "id":         job_id,
            "user_id":    user_id,
            "url":        url,
            "url_type":   url_type,
            "status":     "running",
            "chunks_indexed": 0,
            "error":      None,
            "created_at": now,
            "finished_at": None,
        }

        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INGESTION_JOBS)
            .document(job_id)
            .set(job)
        )
        return job

    @staticmethod
    async def complete_job(user_id: str, job_id: str, chunks_indexed: int) -> None:
        """Mark a job as complete."""
        db = get_db()
        settings = get_settings()
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INGESTION_JOBS)
            .document(job_id)
            .update({
                "status":         "completed",
                "chunks_indexed": chunks_indexed,
                "finished_at":    datetime.now(timezone.utc),
            })
        )

    @staticmethod
    async def fail_job(user_id: str, job_id: str, error: str) -> None:
        """Mark a job as failed."""
        db = get_db()
        settings = get_settings()
        await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INGESTION_JOBS)
            .document(job_id)
            .update({
                "status":      "failed",
                "error":       error,
                "finished_at": datetime.now(timezone.utc),
            })
        )

    @staticmethod
    async def get_job(user_id: str, job_id: str) -> dict | None:
        """Get a single ingestion job by ID."""
        db = get_db()
        settings = get_settings()
        doc = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INGESTION_JOBS)
            .document(job_id)
            .get()
        )
        return doc.to_dict() if doc.exists else None

    @staticmethod
    async def list_jobs(user_id: str) -> list[dict]:
        """List all ingestion jobs for a user."""
        db = get_db()
        settings = get_settings()
        docs = await (
            db.collection(settings.COLLECTION_USERS)
            .document(user_id)
            .collection(settings.COLLECTION_INGESTION_JOBS)
            .order_by("created_at")
            .get()
        )
        return [doc.to_dict() for doc in docs]

