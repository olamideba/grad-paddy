from elasticsearch import AsyncElasticsearch
from src.config import Settings, get_settings

settings: Settings = get_settings()

def get_es():
    return AsyncElasticsearch(
        url=settings.ES_URL,
        api_key=settings.ES_API_KEY,
    )