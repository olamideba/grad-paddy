import urllib.parse

from elasticsearch import AsyncElasticsearch
from src.core.config import Settings, get_settings

settings: Settings = get_settings()


def get_es() -> AsyncElasticsearch:
    url = settings.ES_URL.rstrip("/")
    parsed = urllib.parse.urlparse(url)
    if not parsed.port:
        # elastic_transport requires an explicit port; default to scheme-appropriate port
        url = f"{url}:{443 if parsed.scheme == 'https' else 9200}"
    return AsyncElasticsearch(url, api_key=settings.ELASTIC_API_KEY)