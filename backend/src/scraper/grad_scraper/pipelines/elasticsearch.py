import logging
import numpy as np
from datetime import datetime, timezone

from itemadapter import ItemAdapter
from src.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _get_splitter():
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    return RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=75,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )


def _get_embedding_fn():
    """
    Returns (embed_fn, dims) using Gemini text-embedding-004 via google-genai SDK.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )
    model = settings.EMBEDDING_MODEL
    dims  = 768

    def embed(texts: list[str]) -> list[list[float]]:
        all_embeddings = []
        batch_size     = 20
        for i in range(0, len(texts), batch_size):
            batch    = texts[i:i + batch_size]
            response = client.models.embed_content(
                model=model,
                contents=batch,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            all_embeddings.extend([e.values for e in response.embeddings])
        return all_embeddings

    logger.info(f"Gemini embedding model loaded: {model} ({dims} dims)")
    return embed, dims


# ── Index mapping ─────────────────────────────────────────────────────────────
# Note: no 'settings' block — serverless manages shards/replicas automatically.
# dense_vector with index:True + similarity:cosine enables kNN on serverless.

def _build_mapping(dims: int) -> dict:
    return {
        "mappings": {
            "properties": {
                "embedding": {
                    "type":       "dense_vector",
                    "dims":       dims,
                    "index":      True,
                    "similarity": "cosine",
                },
                "text":          {"type": "text", "analyzer": "english"},
                "source_field":  {"type": "keyword"},
                "chunk_index":   {"type": "integer"},
                "university":    {"type": "keyword"},
                "program":       {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "department":    {"type": "keyword"},
                "source_rl":     {"type": "keyword"},
                "semesters":       {"type": "keyword"},
                "application_fee": {"type": "keyword"},
                "requirements_url":{"type": "keyword"},
                "deadline":      {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "deadline_type": {"type": "keyword"},
                "funding":       {"type": "text"},
                "stipend_amount":{"type": "keyword"},
                "funding_years": {"type": "keyword"},
                "research_groups":{"type": "keyword"},
                "degree_length": {"type": "keyword"},
                "faculty": {
                    "type": "nested",
                    "properties": {
                        "name":           {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                        "title":          {"type": "keyword"},
                        "research_areas": {"type": "text"},
                        "bio_url":        {"type": "keyword"},
                    },
                },
                "scraped_at": {"type": "date"},
            }
        }
    }


CHUNKABLE_FIELDS = [
    "program_description",
    "research_focus",
    "funding",
    "requirements",
]


class ElasticsearchPipeline:

    def __init__(self):
        self.es       = None
        self.index    = settings.PROGRAM_ES_INDEX
        self.splitter = None
        self.embed_fn = None
        self.dims     = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def open_spider(self, spider):
        from elasticsearch import Elasticsearch
        print("DEBUG: open_spider start")

        es_url   = settings.ES_URL    
        api_key  = settings.ES_API_KEY

        if not es_url or not api_key:
            raise RuntimeError(
                "Serverless Elasticsearch requires ES_URL and ES_API_KEY in .env"
            )
        print("DEBUG: creating ES client")
        
        self.es = Elasticsearch(es_url, api_key=api_key)
        self.splitter = _get_splitter()
        self.embed_fn = None  # ← lazy
        self.dims     = None  # ← lazy
        print("DEBUG: calling es.info()")

        # Serverless: es.info() succeeds but returns no 'version' dict
        try:
            self.es.info()
            logger.info(f"Connected to Elasticsearch Serverless at {es_url}")
        except Exception as e:
            logger.error(f"Cannot connect to Elasticsearch: {e}")
            raise
        print("DEBUG: open_spider done")


    def close_spider(self, spider):
        if self.es:
            self.es.close()


    def _ensure_index(self):
        # Serverless does not support es.indices.exists() — use get_mapping instead
        try:
            self.es.indices.get_mapping(index=self.index)
            logger.info(f"Index '{self.index}' already exists")
        except Exception:
            self.es.indices.create(index=self.index, body=_build_mapping(self.dims))
            logger.info(f"Created index '{self.index}' with {self.dims}-dim vectors")

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        if self.embed_fn is None:
            self.embed_fn, self.dims = _get_embedding_fn()
            self._ensure_index()

        base_doc = {
            "university":     adapter.get("university", ""),
            "program":        adapter.get("program", ""),
            "department":     adapter.get("department", ""),
            "source_url":     adapter.get("source_url", ""),
            "deadline":       adapter.get("deadline", ""),
            "deadline_type":  adapter.get("deadline_type", ""),
            "stipend_amount": adapter.get("stipend_amount", ""),
            "funding_years":  adapter.get("funding_years", ""),
            "research_groups":adapter.get("research_groups", []),
            "degree_length":  adapter.get("degree_length", ""),
            "faculty":        adapter.get("faculty", []),
            "scraped_at":     adapter.get("scraped_at", datetime.now(timezone.utc).isoformat()),
        }

        docs_to_index = []

        for field in CHUNKABLE_FIELDS:
            text = adapter.get(field, "")
            if not text:
                continue
            chunks     = self.splitter.split_text(text)
            embeddings = self.embed_fn(chunks)
            # logger.debug(f"  {field}: {len(chunks)} chunks")
            logger.debug(f"  {field}: {len(chunks)} chunks, embedding[0] length: {len(embeddings[0])}")  # ← add this
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                docs_to_index.append({
                    **base_doc,
                    "text":         chunk,
                    "source_field": field,
                    "chunk_index":  i,
                    "embedding":    emb,
                })

        if not docs_to_index:
            summary = f"{base_doc['program']} at {base_doc['university']}"
            emb = self.embed_fn([summary])[0]
            docs_to_index.append({
                **base_doc,
                "text":         summary,
                "source_field": "summary",
                "chunk_index":  0,
                "embedding":    emb,
            })

        operations = []
        for doc in docs_to_index:
            operations.append({"index": {"_index": self.index}})
            operations.append(doc)

        if operations:
            resp = self.es.bulk(operations=operations)
            if resp.get("errors"):
                # Log the first error detail to help diagnose
                for item_resp in resp.get("items", []):
                    op = item_resp.get("index", {})
                    if op.get("error"):
                        logger.warning(f"Bulk error: {op['error']}")
                        break
            else:
                logger.info(
                    f"Indexed {len(docs_to_index)} chunks for "
                    f"{base_doc['university']} — {base_doc['program']}"
                )

        return item
