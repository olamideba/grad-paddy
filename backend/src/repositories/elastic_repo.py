from elasticsearch import AsyncElasticsearch
from src.core.config import Settings, get_settings

settings: Settings = get_settings()

def get_es():
    return AsyncElasticsearch(
        hosts=[settings.ES_URL],
        api_key=settings.ELASTIC_API_KEY,
    )