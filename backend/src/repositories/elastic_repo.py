import urllib.parse

from elasticsearch import AsyncElasticsearch
from src.core.config import Settings, get_settings

settings: Settings = get_settings()

_es_client: AsyncElasticsearch | None = None


def _build_es() -> AsyncElasticsearch:
    url = settings.ES_URL.rstrip("/")
    parsed = urllib.parse.urlparse(url)
    if not parsed.port:
        # elastic_transport requires an explicit port; default to scheme-appropriate port
        url = f"{url}:{443 if parsed.scheme == 'https' else 9200}"
    return AsyncElasticsearch(url, api_key=settings.ELASTIC_API_KEY)


def get_es() -> AsyncElasticsearch:
    """Return a shared AsyncElasticsearch client.

    The client is created once and reused for the process lifetime.
    AsyncElasticsearch is safe for concurrent use and pools connections
    internally, so a singleton avoids paying a fresh TLS handshake to Elastic
    Serverless on every call — which was the dominant latency in memory
    injection (a new client per memory op).

    Callers MUST NOT close the returned client. Use close_es() once on
    application shutdown.
    """
    global _es_client
    if _es_client is None:
        _es_client = _build_es()
    return _es_client


async def close_es() -> None:
    """Close the shared client on application shutdown."""
    global _es_client
    if _es_client is not None:
        await _es_client.close()
        _es_client = None
