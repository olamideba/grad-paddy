"""
memory_service.py
─────────────────────
Elastic-backed long-term memory for Grad Paddy agents.

Each user gets a collection of atomic fact memories stored in the
`user-memories` Elasticsearch index.  Embeddings are generated *natively by
Elasticsearch* via a Google Vertex AI inference endpoint attached to a
`semantic_text` field — no embedding calls are made from this service.  Elastic
auto-embeds the fact on write and auto-embeds the query on search.

Retrieval uses hybrid semantic + BM25 search so the most semantically and
textually relevant memories surface first, with a recency boost so stale facts
rank lower.

Orchestration (dedup, tag-merge, ownership checks) lives here in the backend
because it is procedural multi-step logic that an Elastic Agent Builder tool
cannot express.  Agents reach this service through native ADK tools
(see agents/memory_tools.py) and the root proactive-injection callback —
NOT through an Elastic Agent Builder MCP round-trip.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from elasticsearch import NotFoundError

from src.core.config import get_settings
from src.repositories.elastic_repo import get_es

logger = logging.getLogger(__name__)
settings = get_settings()

# `fact_semantic` is a semantic_text field: Elasticsearch embeds it on ingest
# (and embeds queries on search) using the Vertex inference endpoint referenced
# by MEMORY_INFERENCE_ID. `fact` is kept as a plain text field so we retain a
# BM25 lexical signal for hybrid search and a clean value for display/dedup.
_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "user_id":       {"type": "keyword"},
            "fact":          {"type": "text"},
            "fact_semantic": {
                "type": "semantic_text",
                "inference_id": settings.MEMORY_INFERENCE_ID,
            },
            "tags":          {"type": "keyword"},
            "source":        {"type": "keyword"},
            "session_id":    {"type": "keyword"},
            "confidence":    {"type": "float"},
            "created_at":    {"type": "date"},
            "updated_at":    {"type": "date"},
        }
    }
}


class MemoryService:

    @staticmethod
    async def ensure_index() -> None:
        """Idempotently create the user-memories Elasticsearch index.

        Uses get_mapping instead of indices.exists — Elastic Serverless does not
        support indices.exists() (same pattern as the scraper pipeline).

        The semantic_text mapping references the Vertex inference endpoint, so
        that endpoint must exist before the index is created.  See the project
        README / deployment notes for the one-time `PUT _inference/...` setup.
        """
        es = get_es()
        try:
            await es.indices.get_mapping(index=settings.MEMORY_ES_INDEX)
            logger.info("Elasticsearch index already exists: %s", settings.MEMORY_ES_INDEX)
        except Exception:
            await es.indices.create(index=settings.MEMORY_ES_INDEX, body=_INDEX_MAPPING)
            logger.info("Created Elasticsearch index: %s", settings.MEMORY_ES_INDEX)

    @staticmethod
    async def save_memory(
        user_id: str,
        fact: str,
        tags: list[str],
        session_id: str = "",
        source: str = "conversation",
    ) -> dict[str, str]:
        """Persist a memory fact, deduplicating via native semantic similarity.

        Runs a semantic query (Elastic embeds the new fact server-side) scoped to
        this user.  If the nearest existing memory scores >=
        MEMORY_SIMILARITY_THRESHOLD, that document is updated in-place (merging
        tags) rather than creating a duplicate.
        """
        es = get_es()
        now = datetime.now(timezone.utc).isoformat()

        dup_resp = await es.search(
            index=settings.MEMORY_ES_INDEX,
            body={
                "size": 1,
                "query": {
                    "bool": {
                        "filter": {"term": {"user_id": user_id}},
                        "must": {"semantic": {"field": "fact_semantic", "query": fact}},
                    }
                },
                "_source": ["fact", "tags"],
            },
        )
        hits = dup_resp["hits"]["hits"]
        if hits and hits[0]["_score"] >= settings.MEMORY_SIMILARITY_THRESHOLD:
            doc_id = hits[0]["_id"]
            merged_tags = list(set(tags + hits[0]["_source"].get("tags", [])))
            await es.update(
                index=settings.MEMORY_ES_INDEX,
                id=doc_id,
                body={
                    "doc": {
                        "fact": fact,
                        "fact_semantic": fact,
                        "tags": merged_tags,
                        "updated_at": now,
                    }
                },
            )
            return {"status": "updated", "id": doc_id}

        doc_id = str(uuid4())
        await es.index(
            index=settings.MEMORY_ES_INDEX,
            id=doc_id,
            body={
                "user_id": user_id,
                "fact": fact,
                "fact_semantic": fact,
                "tags": tags,
                "source": source,
                "session_id": session_id,
                "confidence": 1.0,
                "created_at": now,
                "updated_at": now,
            },
        )
        return {"status": "created", "id": doc_id}

    @staticmethod
    async def search_memory(
        user_id: str,
        query: str = "",
        top_k: int | None = None,
    ) -> list[dict[str, object]]:
        """Retrieve memories for a user.

        When query is non-empty, runs hybrid semantic + BM25 search (Elastic
        embeds the query server-side) with a recency boost.  When query is empty,
        returns the most recently updated memories for broad context injection.
        """
        k = top_k or settings.MEMORY_TOP_K
        es = get_es()
        try:
            if not query:
                resp = await es.search(
                    index=settings.MEMORY_ES_INDEX,
                    body={
                        "size": k,
                        "query": {"term": {"user_id": user_id}},
                        "sort": [{"updated_at": {"order": "desc"}}],
                        "_source": ["fact", "tags", "updated_at", "source"],
                    },
                )
            else:
                resp = await es.search(
                    index=settings.MEMORY_ES_INDEX,
                    body={
                        "size": k,
                        "query": {
                            "function_score": {
                                "query": {
                                    "bool": {
                                        "filter": {"term": {"user_id": user_id}},
                                        "should": [
                                            {"match": {"fact": {"query": query}}},
                                            {
                                                "semantic": {
                                                    "field": "fact_semantic",
                                                    "query": query,
                                                    "boost": 2.0,
                                                }
                                            },
                                        ],
                                        "minimum_should_match": 1,
                                    }
                                },
                                "functions": [{
                                    "gauss": {
                                        "updated_at": {
                                            "origin": "now",
                                            "scale": "30d",
                                            "decay": 0.5,
                                        }
                                    }
                                }],
                                "boost_mode": "sum",
                            }
                        },
                        "_source": ["fact", "tags", "updated_at", "source"],
                    },
                )
            return [
                {
                    "id": h["_id"],
                    "fact": h["_source"]["fact"],
                    "tags": h["_source"].get("tags", []),
                    "updated_at": h["_source"].get("updated_at"),
                    "source": h["_source"].get("source"),
                }
                for h in resp["hits"]["hits"]
            ]
        except Exception as exc:
            logger.warning("Memory search failed for user %s: %s", user_id, exc)
            return []

    @staticmethod
    async def delete_memory(user_id: str, memory_id: str) -> dict[str, str]:
        """Delete a specific memory, verifying ownership before removal."""
        es = get_es()
        try:
            doc = await es.get(
                index=settings.MEMORY_ES_INDEX,
                id=memory_id,
                _source=["user_id"],
            )
            if doc["_source"].get("user_id") != user_id:
                return {"status": "error", "message": "Memory not found"}
            await es.delete(index=settings.MEMORY_ES_INDEX, id=memory_id)
            return {"status": "deleted", "id": memory_id}
        except NotFoundError:
            return {"status": "error", "message": "Memory not found"}
