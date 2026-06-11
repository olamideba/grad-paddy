from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from uuid import uuid4

from elasticsearch import NotFoundError
from google import genai
from google.genai import types

from src.core.config import get_settings
from src.repositories.elastic_repo import get_es

logger = logging.getLogger(__name__)
settings = get_settings()

# Must stay in sync with the save_memory tool docstring taxonomy.
_MEMORY_TAGS = (
    "research_interests",
    "academic_background",
    "application_goals",
    "target_programs",
    "target_faculty",
    "preferences",
    "sop_strategy",
    "outreach_strategy",
    "constraints",
)

_EXTRACTION_PROMPT = (
    "You extract durable, cross-session facts about a graduate-school applicant "
    "from a single conversation turn. Return ONLY a JSON array (possibly empty).\n"
    "Each element: {{\"fact\": <third-person statement>, \"tags\": [<one or more "
    "of: {tags}>]}}.\n"
    "Save ONLY genuinely durable facts the user has confirmed about themselves: "
    "research interests, academic background, target programs/universities/faculty, "
    "application strategy, SOP framing, funding/timeline constraints, stated "
    "preferences, or explicit 'remember this' instructions.\n"
    "Do NOT save: transient chit-chat, questions, tool outputs, things the "
    "assistant said, or anything the user has not confirmed as their own goal or "
    "preference. When in doubt, omit. Write facts in third person, e.g. "
    "'User is targeting NLP PhD programs with a focus on healthcare AI.'\n\n"
    "USER MESSAGE:\n{user_text}\n\n"
    "ASSISTANT REPLY (context only — do not extract facts about the assistant):\n"
    "{assistant_text}\n"
)

# fact_semantic: Elastic embeds on ingest/search via Vertex inference (MEMORY_INFERENCE_ID).
# fact: plain text retained for BM25 signal in hybrid search and dedup display.
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
        # Uses get_mapping not indices.exists — Elastic Serverless doesn't support the latter.
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

    @staticmethod
    async def extract_and_save(
        user_id: str,
        user_text: str,
        assistant_text: str = "",
        session_id: str = "",
    ) -> int:
        """Extract durable user facts from one turn and persist them.

        This runs OFF the agent's tool-decision loop (fired from the root
        after_agent_callback) so memory writes never compete with the app's
        CRUD/HITL tools for the model's attention. A single cheap flash-lite
        call distils the turn into atomic facts; save_memory dedups each one,
        so re-running on paraphrased turns is safe.

        Returns the number of facts persisted. Best-effort: any failure is
        swallowed (logged) because memory is non-critical to the user's turn.
        """
        if not user_text or len(user_text.strip()) < 12:
            return 0

        try:
            client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            prompt = _EXTRACTION_PROMPT.format(
                tags=", ".join(_MEMORY_TAGS),
                user_text=user_text.strip()[:4000],
                assistant_text=(assistant_text or "").strip()[:2000],
            )
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                ),
            )
            facts = MemoryService._parse_facts(response.text or "")
        except Exception as exc:
            logger.warning("Memory extraction failed for user %s: %s", user_id, exc)
            return 0

        saved = 0
        for item in facts:
            fact = str(item.get("fact", "")).strip()
            if not fact:
                continue
            tags = [t for t in item.get("tags", []) if t in _MEMORY_TAGS]
            try:
                await MemoryService.save_memory(
                    user_id=user_id,
                    fact=fact,
                    tags=tags or ["preferences"],
                    session_id=session_id,
                    source="auto_extracted",
                )
                saved += 1
            except Exception as exc:
                logger.warning("Memory save failed for user %s: %s", user_id, exc)
        if saved:
            logger.info("Auto-extracted %d memories for user %s", saved, user_id)
        return saved

    @staticmethod
    def _parse_facts(raw: str) -> list[dict[str, object]]:
        """Parse the extraction model's JSON array, tolerating code fences."""
        text = raw.strip()
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return []
        return [f for f in parsed if isinstance(f, dict)] if isinstance(parsed, list) else []
