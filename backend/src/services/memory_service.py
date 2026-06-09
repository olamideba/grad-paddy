"""
memory_service.py
─────────────────────
Elastic-backed long-term memory for Grad Paddy agents.

Each user gets a collection of atomic fact memories stored in the
`user-memories` Elasticsearch index.  Retrieval uses hybrid kNN +
BM25 search so the most semantically and textually relevant memories
surface first, with a recency boost so stale facts rank lower.

Memory-as-a-Tool: agents call save_memory/search_memory themselves.
Proactive injection: before_model_callback on root agent fetches recent
memories and appends them to the system prompt on every LLM call.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import uuid4

from elasticsearch import NotFoundError
from google import genai
from google.genai import types

from src.core.config import get_settings
from src.repositories.elastic_repo import get_es

logger = logging.getLogger(__name__)
settings = get_settings()

_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "user_id":    {"type": "keyword"},
            "fact":       {"type": "text"},
            "embedding":  {"type": "dense_vector", "dims": 768, "similarity": "cosine"},
            "tags":       {"type": "keyword"},
            "source":     {"type": "keyword"},
            "session_id": {"type": "keyword"},
            "confidence": {"type": "float"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
        }
    }
}


async def _embed(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed text using Gemini text-embedding-004.

    Use task_type="RETRIEVAL_DOCUMENT" when storing a fact, and
    task_type="RETRIEVAL_QUERY" when embedding a search query.
    This asymmetric embedding is a Gemini-specific optimization that
    meaningfully improves kNN retrieval quality.
    """
    client = genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )
    response = await asyncio.to_thread(
        client.models.embed_content,
        model=settings.EMBEDDING_MODEL,
        contents=[text],
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return response.embeddings[0].values


async def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Public wrapper around _embed for use outside this module."""
    return await _embed(text, task_type=task_type)


class MemoryService:

    @staticmethod
    async def ensure_index() -> None:
        """Idempotently create the user-memories Elasticsearch index.

        Uses get_mapping instead of indices.exists — Elastic Serverless does not
        support indices.exists() (same pattern as the scraper pipeline).
        """
        es = get_es()
        try:
            try:
                await es.indices.get_mapping(index=settings.MEMORY_ES_INDEX)
                logger.info("Elasticsearch index already exists: %s", settings.MEMORY_ES_INDEX)
            except Exception:
                await es.indices.create(index=settings.MEMORY_ES_INDEX, body=_INDEX_MAPPING)
                logger.info("Created Elasticsearch index: %s", settings.MEMORY_ES_INDEX)
        finally:
            await es.close()

    @staticmethod
    async def save_memory(
        user_id: str,
        fact: str,
        tags: list[str],
        session_id: str = "",
        source: str = "conversation",
    ) -> dict[str, str]:
        """Embed and persist a memory fact, deduplicating via cosine similarity.

        If an existing memory for this user scores >= MEMORY_SIMILARITY_THRESHOLD
        against the new fact, the existing document is updated in-place (merging
        tags) rather than creating a duplicate.
        """
        es = get_es()
        try:
            embedding = await _embed(fact)
            now = datetime.now(timezone.utc).isoformat()

            dup_resp = await es.search(
                index=settings.MEMORY_ES_INDEX,
                body={
                    "knn": {
                        "field": "embedding",
                        "query_vector": embedding,
                        "k": 1,
                        "num_candidates": 20,
                        "filter": {"term": {"user_id": user_id}},
                    },
                    "_source": ["fact", "tags"],
                    "size": 1,
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
                            "tags": merged_tags,
                            "embedding": embedding,
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
                    "embedding": embedding,
                    "tags": tags,
                    "source": source,
                    "session_id": session_id,
                    "confidence": 1.0,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            return {"status": "created", "id": doc_id}
        finally:
            await es.close()

    @staticmethod
    async def search_memory(
        user_id: str,
        query: str = "",
        top_k: int | None = None,
    ) -> list[dict[str, object]]:
        """Retrieve memories for a user.

        When query is non-empty, runs hybrid kNN (semantic) + BM25 (keyword)
        search with a recency boost.  When query is empty, returns the most
        recently updated memories for broad context injection.
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
                embedding = await _embed(query, task_type="RETRIEVAL_QUERY")
                resp = await es.search(
                    index=settings.MEMORY_ES_INDEX,
                    body={
                        "size": k,
                        "knn": {
                            "field": "embedding",
                            "query_vector": embedding,
                            "k": k,
                            "num_candidates": k * 5,
                            "filter": {"term": {"user_id": user_id}},
                            "boost": 2.0,
                        },
                        "query": {
                            "function_score": {
                                "query": {
                                    "bool": {
                                        "must": {"match": {"fact": {"query": query}}},
                                        "filter": {"term": {"user_id": user_id}},
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
        finally:
            await es.close()

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
        finally:
            await es.close()
