import logging
import numpy as np
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

from itemadapter import ItemAdapter
from grad_scraper.items.faculty_profile import FacultyProfileItem
from grad_scraper.pipelines.elasticsearch import _get_splitter, _get_embedding_fn

load_dotenv(dotenv_path="/app/.env")
logger = logging.getLogger(__name__)

class _S:
    FACULTY_ES_INDEX = os.getenv("FACULTY_ES_INDEX")
    ES_URL           = os.getenv("ES_URL")
    ELASTIC_API_KEY  = os.getenv("ELASTIC_API_KEY")

settings = _S()
FACULTY_INDEX = settings.FACULTY_ES_INDEX


def _faculty_mapping(dims: int) -> dict:
    return {
        "mappings": {
            "properties": {
                "embedding": {
                    "type":       "dense_vector",
                    "dims":       dims,
                    "index":      True,
                    "similarity": "cosine",
                },
                "text":        {"type": "text", "analyzer": "english"},
                "chunk_index": {"type": "integer"},
                "name":        {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "title":       {"type": "keyword"},
                "university":  {"type": "keyword"},
                "email":       {"type": "keyword"},
                "source_url":  {"type": "keyword"},
                "research_areas":  {"type": "text"},
                "paper_keywords":  {"type": "keyword"},
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
                "fit_score":     {"type": "integer"},
                "scraped_at": {"type": "date"},
            }
        }
    }


class FacultyElasticsearchPipeline:
    def __init__(self):
        self.es       = None
        self.index    = FACULTY_INDEX
        self.splitter = None
        self.embed_fn = None
        self.dims     = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def open_spider(self, spider):
        from elasticsearch import Elasticsearch
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        es_url  = settings.ES_URL
        api_key = settings.ELASTIC_API_KEY
        if not es_url or not api_key:
            raise RuntimeError("ES_URL and ELASTIC_API_KEY required in .env")

        self.es = Elasticsearch(es_url, api_key=api_key)
        self.splitter = _get_splitter()
        self.embed_fn = None  
        self.dims     = None  

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
        from grad_scraper.items.faculty_profile import FacultyProfileItem
        if not isinstance(item, FacultyProfileItem):
            return item

        if self.embed_fn is None:
            self.embed_fn, self.dims = _get_embedding_fn()
            self._ensure_index()

        adapter = ItemAdapter(item)

        name           = adapter.get("name", "")
        email          = adapter.get("email", "")
        research_areas = adapter.get("research_areas", "")
        bio            = adapter.get("bio", "")
        university     = adapter.get("university", "")
        source_url     = adapter.get("source_url", "")

        # ── Build content to chunk ────────────────────────────────────────
        content = " ".join(filter(None, [
            f"{name} is a faculty member at {university}." if name else "",
            f"Research areas: {research_areas}."           if research_areas else "",
            bio,
        ]))

        if not content:
            logger.warning(f"No content to chunk for {source_url}")
            return item

        # ── Metadata attached to every chunk ─────────────────────────────
        metadata = {
            "name":           name,
            "email":          email,
            "research_areas": research_areas,
            "university":     university,
            "source_url":     source_url,
            "url_type":       "faculty",
            "scraped_at":     adapter.get("scraped_at", datetime.now(timezone.utc).isoformat()),
        }

        chunks     = self.splitter.split_text(content)
        logger.info(f"Chunking {name} @ {university} → {len(chunks)} chunks")
        try:
            embeddings = self.embed_fn(chunks)
            logger.info(f"Embedded {len(embeddings)} chunks for {name}")
        except Exception as e:
            logger.error(f"Embedding failed for {name}: {e}")
            return item

        try:
            operations = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                doc = {
                    **metadata,
                    "text":        chunk,
                    "chunk_index": i,
                    "embedding":   embedding,
                }
                operations.append({"index": {"_index": self.index}})
                operations.append(doc)

            if operations:
                resp = self.es.bulk(operations=operations)
                if resp.get("errors"):
                    for item_resp in resp.get("items", []):
                        op = item_resp.get("index", {})
                        if op.get("error"):
                            logger.warning(f"Bulk error: {op['error']}")
                            break
                else:
                    logger.info(
                        f"Indexed {len(chunks)} chunks for {name} @ {university}"
                    )
        except Exception as e:
            logger.error(f"Indexing failed for {name}: {e}")

        return item