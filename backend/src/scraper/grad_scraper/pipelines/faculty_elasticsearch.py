"""
FacultyElasticsearchPipeline
─────────────────────────────
Indexes FacultyProfileItem documents into a dedicated 'faculty-profiles'
index in Elasticsearch Serverless.

Each faculty member is stored as a single document (not chunked) because:
  - Bios are short enough to fit in one vector
  - Fit scores and conversation angles are per-faculty, not per-chunk
  - The agent queries by faculty name or fit_score, not by text search

The embedding is generated from a concatenation of:
  name + research_areas + paper_keywords + bio[:500]
This gives the most semantically meaningful vector for faculty search.
"""

import os
import logging
import numpy as np
from datetime import datetime, timezone

from dotenv import load_dotenv
from itemadapter import ItemAdapter
from grad_scraper.items.faculty_profile import FacultyProfileItem

load_dotenv()
logger = logging.getLogger(__name__)

FACULTY_INDEX = os.getenv("FACULTY_ES_INDEX", "faculty-profiles")


def _faculty_mapping(dims: int) -> dict:
    return {
        "mappings": {
            "properties": {
                # ── Vector ────────────────────────────────────────────────
                "embedding": {
                    "type":       "dense_vector",
                    "dims":       dims,
                    "index":      True,
                    "similarity": "cosine",
                },
                # ── Identity ──────────────────────────────────────────────
                "name":        {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "title":       {"type": "keyword"},
                "university":  {"type": "keyword"},
                "department":  {"type": "keyword"},
                "program":     {"type": "keyword"},
                "email":       {"type": "keyword"},
                "source_url":  {"type": "keyword"},
                # ── Research ──────────────────────────────────────────────
                "research_areas":  {"type": "text"},
                "bio":             {"type": "text"},
                "paper_keywords":  {"type": "keyword"},
                # ── Papers ────────────────────────────────────────────────
                "papers": {
                    "type": "nested",
                    "properties": {
                        "title":     {"type": "text"},
                        "year":      {"type": "integer"},
                        "citations": {"type": "integer"},
                        "abstract":  {"type": "text"},
                        "url":       {"type": "keyword"},
                    },
                },
                # ── Fit scoring ───────────────────────────────────────────
                "fit_score":     {"type": "integer"},
                "fit_reasoning": {"type": "text"},
                # ── Conversation angles ───────────────────────────────────
                "conversation_angles": {"type": "text"},
                # ── Metadata ──────────────────────────────────────────────
                "scraped_at": {"type": "date"},
            }
        }
    }


class FacultyElasticsearchPipeline:

    def __init__(self):
        self.es       = None
        self.index    = FACULTY_INDEX
        self.embed_fn = None
        self.dims     = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def open_spider(self, spider):
        from elasticsearch import Elasticsearch

        es_url  = os.getenv("ES_URL")
        api_key = os.getenv("ES_API_KEY")
        if not es_url or not api_key:
            raise RuntimeError("ES_URL and ES_API_KEY required in .env")

        self.es = Elasticsearch(es_url, api_key=api_key)

        # Reuse the same ONNX embedding function
        from grad_scraper.pipelines.elasticsearch import _get_embedding_fn
        self.embed_fn, self.dims = _get_embedding_fn()

        self._ensure_index()
        logger.info(f"FacultyElasticsearchPipeline ready → index '{self.index}'")

    def close_spider(self, spider):
        if self.es:
            self.es.close()

    def _ensure_index(self):
        try:
            self.es.indices.get_mapping(index=self.index)
            logger.info(f"Faculty index '{self.index}' already exists")
        except Exception:
            self.es.indices.create(
                index=self.index,
                body=_faculty_mapping(self.dims)
            )
            logger.info(f"Created faculty index '{self.index}' with {self.dims}-dim vectors")

    def process_item(self, item, spider):
        # Only process FacultyProfileItem — pass everything else through
        if not isinstance(item, FacultyProfileItem):
            return item

        adapter = ItemAdapter(item)

        # Build embedding text from the most meaningful fields
        embed_text = " ".join(filter(None, [
            adapter.get("name", ""),
            adapter.get("research_areas", ""),
            " ".join(adapter.get("paper_keywords", [])),
            adapter.get("bio", "")[:500],
        ]))

        try:
            embedding = self.embed_fn([embed_text])[0]
        except Exception as e:
            logger.warning(f"Embedding failed for {adapter.get('name')}: {e}")
            embedding = []

        doc = {
            "name":               adapter.get("name", ""),
            "title":              adapter.get("title", ""),
            "university":         adapter.get("university", ""),
            "department":         adapter.get("department", ""),
            "program":            adapter.get("program", ""),
            "email":              adapter.get("email", ""),
            "source_url":         adapter.get("source_url", ""),
            "research_areas":     adapter.get("research_areas", ""),
            "bio":                adapter.get("bio", ""),
            "paper_keywords":     adapter.get("paper_keywords", []),
            "papers":             adapter.get("papers", []),
            "fit_score":          adapter.get("fit_score", 0),
            "fit_reasoning":      adapter.get("fit_reasoning", ""),
            "conversation_angles":adapter.get("conversation_angles", []),
            "scraped_at":         adapter.get("scraped_at", datetime.now(timezone.utc).isoformat()),
            "embedding":          embedding,
        }

        try:
            self.es.index(index=self.index, document=doc)
            logger.info(
                f"Indexed faculty: {adapter.get('name')} "
                f"(fit={adapter.get('fit_score', 0)}) "
                f"@ {adapter.get('university')}"
            )
        except Exception as e:
            logger.error(f"Failed to index faculty {adapter.get('name')}: {e}")

        return item