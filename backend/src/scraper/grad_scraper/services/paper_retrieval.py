import logging
import asyncio
import httpx
from src.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

async def _fetch_from_google_scholar(faculty_name: str, limit: int = 5) -> list:
    try:
        from scholarly import scholarly, ProxyGenerator

        # Optional: use free proxies to avoid blocks
        # pg = ProxyGenerator()
        # pg.FreeProxies()
        # scholarly.use_proxy(pg)

        def _search():
            results = []
            search  = scholarly.search_author(faculty_name)
            author  = next(search, None)
            if not author:
                return []
            scholarly.fill(author, sections=["publications"])
            for pub in author.get("publications", [])[:limit * 2]:
                try:
                    scholarly.fill(pub)
                    results.append({
                        "title":     pub["bib"].get("title", ""),
                        "year":      pub["bib"].get("pub_year"),
                        "citations": pub.get("num_citations", 0),
                        "abstract":  pub["bib"].get("abstract", "")[:600],
                        "url":       pub.get("pub_url", ""),
                        "authors":   pub["bib"].get("author", "").split(" and ")[:5],
                        "source":    "google_scholar",
                    })
                except Exception:
                    continue
            return results[:limit]

        # Run blocking scholarly calls in a thread
        papers = await asyncio.to_thread(_search)
        logger.info(f"Google Scholar: {len(papers)} papers for {faculty_name}")
        return papers

    except Exception as e:
        logger.warning(f"Google Scholar failed for {faculty_name}: {e}")
        return []


async def _fetch_from_semantic_scholar(faculty_name: str, limit: int = 5) -> list:
    headers = {}
    api_key = settings.SEMANTIC_SCHOLAR_API_KEY
    if api_key:
        headers["x-api-key"] = api_key

    params = {
        "query":  faculty_name,
        "limit":  min(limit * 3, 20),
        "fields": "title,year,citationCount,abstract,url,authors",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params=params,
                headers=headers,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
    except Exception as e:
        logger.warning(f"Semantic Scholar failed for {faculty_name}: {e}")
        return []

    papers     = data.get("data", [])
    name_parts = faculty_name.lower().split()

    filtered = []
    for paper in papers:
        authors    = [a.get("name", "").lower() for a in paper.get("authors", [])]
        is_author  = any(
            all(part in author for part in name_parts)
            for author in authors
        )
        if is_author:
            filtered.append({
                "title":     paper.get("title", ""),
                "year":      paper.get("year"),
                "citations": paper.get("citationCount", 0),
                "abstract":  (paper.get("abstract") or "")[:600],
                "url":       paper.get("url", ""),
                "authors":   [a.get("name", "") for a in paper.get("authors", [])[:5]],
                "source":    "semantic_scholar",
            })

    filtered.sort(key=lambda x: x.get("year") or 0, reverse=True)
    return filtered[:limit]


async def fetch_papers(faculty_name: str, limit: int = 5) -> list:
    """
    Fetch recent papers for a faculty member.
    Tries Google Scholar first, falls back to Semantic Scholar.
    """
    # Try Google Scholar first
    papers = await _fetch_from_google_scholar(faculty_name, limit)

    # Fall back to Semantic Scholar if blocked or empty
    if not papers:
        logger.info(f"Falling back to Semantic Scholar for {faculty_name}")
        papers = await _fetch_from_semantic_scholar(faculty_name, limit)

    return papers