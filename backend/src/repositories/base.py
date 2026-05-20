from google.cloud import firestore
from src.core.firestore import get_firestore

def get_db() -> firestore.AsyncClient:
    return get_firestore()
