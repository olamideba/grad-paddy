from google.cloud import firestore
from src.core.config import get_settings

_client: firestore.AsyncClient | None = None

def get_firestore() -> firestore.AsyncClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = firestore.AsyncClient(database=settings.FIRESTORE_DATABASE_ID)
    return _client