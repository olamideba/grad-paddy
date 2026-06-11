import logging
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from itemadapter import ItemAdapter

logger = logging.getLogger(__name__)
load_dotenv(dotenv_path="/app/.env")

class _S:
    GOOGLE_CLOUD_PROJECT  = os.getenv("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION")
    EMBEDDING_MODEL       = os.getenv("EMBEDDING_MODEL")
    PROGRAM_ES_INDEX      = os.getenv("PROGRAM_ES_INDEX")
    ES_URL                = os.getenv("ES_URL")
    ELASTIC_API_KEY       = os.getenv("ELASTIC_API_KEY")

settings = _S()

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

    model = settings.EMBEDDING_MODEL
    if not model:
        raise RuntimeError(
            "EMBEDDING_MODEL env var is not set — cannot initialize embedding function"
        )
    client = genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )
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
                "chunk_index":   {"type": "integer"},
                "university":    {"type": "keyword"},
                "program":       {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "source_url":     {"type": "keyword"},
                "semesters":       {"type": "keyword"},
                "application_fee": {"type": "keyword"},
                "deadline":      {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "deadline_type": {"type": "keyword"},
                "scraped_at": {"type": "date"},
            }
        }
    }


def _clean_html(raw_html: str) -> str:
    """
    Strip HTML tags and clean whitespace from raw page HTML.
    Returns plain readable text suitable for chunking.
    """
    from parsel import Selector
    import re

    sel   = Selector(text=raw_html)

    for tag in ["script", "style", "nav", "footer", "header", "noscript"]:
        sel.css(tag).drop()

    texts = sel.css("main *::text, article *::text, .content *::text, body *::text").getall()

    if not texts:
        texts = sel.css("*::text").getall()

    # Join and clean whitespace
    text = " ".join(t.strip() for t in texts if t.strip())
    text = re.sub(r"\s+", " ", text).strip()
    return text


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

        es_url   = settings.ES_URL    
        api_key  = settings.ELASTIC_API_KEY

        if not es_url or not api_key:
            raise RuntimeError(
                "Serverless Elasticsearch requires ES_URL and ELASTIC_API_KEY in .env"
            )
        
        self.es = Elasticsearch(es_url, api_key=api_key)
        self.splitter = _get_splitter()
        self.embed_fn = None  
        self.dims     = None  

        try:
            self.es.info()
            logger.info(f"Connected to Elasticsearch Serverless at {es_url}")
        except Exception as e:
            logger.error(f"Cannot connect to Elasticsearch: {e}")
            raise

    def close_spider(self, spider):
        if self.es:
            self.es.close()


    def _ensure_index(self):
        try:
            self.es.indices.get_mapping(index=self.index)
            logger.info(f"Index '{self.index}' already exists")
        except Exception:
            self.es.indices.create(index=self.index, body=_build_mapping(self.dims))
            logger.info(f"Created index '{self.index}' with {self.dims}-dim vectors")


    def process_item(self, item, spider):
        from grad_scraper.items.faculty_profile import FacultyProfileItem
        
        # Route faculty items to faculty pipeline only
        if isinstance(item, FacultyProfileItem):
            return item

        adapter = ItemAdapter(item)
        if self.embed_fn is None:
            self.embed_fn, self.dims = _get_embedding_fn()
            self._ensure_index()

        source_url = adapter.get("source_url", "")
        university = adapter.get("university", "")

        # ── Get clean text ────────────────────────────────────────────────
        raw_html   = adapter.get("raw_html", "")
        clean_text = _clean_html(raw_html) if raw_html else ""

        if not clean_text:
            clean_text = " ".join(filter(None, [
                adapter.get("program_description", ""),
                adapter.get("research_focus", ""),
                adapter.get("funding", ""),
                adapter.get("requirements", ""),
            ]))

        if not clean_text:
            logger.warning(f"No content to chunk for {source_url}")
            return item

        # ── Minimal metadata ──────────────────────────────────────────────
        metadata = {
            "university":  university,
            "source_url":  source_url,
            "url_type":    "program",
            "scraped_at":  adapter.get("scraped_at", datetime.now(timezone.utc).isoformat()),
            # keep these only if they exist — don't store empty strings
            **({"program":  adapter.get("program")}  if adapter.get("program")  else {}),
            **({"deadline": adapter.get("deadline")} if adapter.get("deadline") else {}),
        }

        chunks     = self.splitter.split_text(clean_text)
        logger.info(f"Chunking {source_url} → {len(chunks)} chunks")
        try:
            embeddings = self.embed_fn(chunks)
            logger.info(f"Embedded {len(embeddings)} chunks for {source_url}")
        except Exception as e:
            logger.error(f"Embedding failed for {source_url}: {e}")
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
                    logger.info(f"Indexed {len(chunks)} chunks for {university} — {source_url}")
        except Exception as e:
            logger.error(f"Indexing failed for {source_url}: {e}")

        return item