"""
ElasticsearchPipeline
──────────────────────
For each scraped item:
  1. Chunk free-text fields (RecursiveCharacterTextSplitter)
  2. Embed each chunk (ONNX MiniLM-L6-v2 OR OpenAI)
  3. Index into Elasticsearch Serverless with structured metadata alongside vectors

Serverless ES differences vs self-hosted:
  - Auth is API key only (no basic auth)
  - es.info() returns no 'version' key — we skip that log line
  - Index creation: no 'number_of_shards'/'number_of_replicas' settings (serverless manages these)
  - es.indices.exists() is not available — we use a try/except on get_mapping instead
  - bulk() response uses 'items' list; error check is the same
  - RRF (hybrid search) requires Elastic Platinum/Enterprise on serverless — handled in query.py
"""

import os
import logging
import numpy as np
from datetime import datetime, timezone

from dotenv import load_dotenv
from itemadapter import ItemAdapter

load_dotenv()
logger = logging.getLogger(__name__)


# ── Embedding backends ────────────────────────────────────────────────────────

def _get_splitter():
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    return RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=75,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )


def _get_embedding_fn():
    backend = os.getenv("EMBEDDING_BACKEND", "local").lower()

    if backend == "openai":
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        def embed(texts):
            resp = client.embeddings.create(model="text-embedding-3-small", input=texts)
            return [d.embedding for d in resp.data]
        return embed, 1536

    else:
        import onnxruntime as ort
        from tokenizers import Tokenizer

        model_path     = os.getenv("ONNX_MODEL_PATH", "models/model.onnx")
        tokenizer_path = os.getenv("ONNX_TOKENIZER_PATH", os.path.dirname(model_path))

        session   = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        tokenizer = Tokenizer.from_file(os.path.join(tokenizer_path, "tokenizer.json"))
        tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=128)
        tokenizer.enable_truncation(max_length=128)

        def _mean_pool(token_embeddings, attention_mask):
            mask   = attention_mask[:, :, np.newaxis].astype(np.float32)
            summed = (token_embeddings * mask).sum(axis=1)
            return summed / mask.sum(axis=1).clip(min=1e-9)

        def _normalize(vecs):
            return vecs / np.linalg.norm(vecs, axis=1, keepdims=True).clip(min=1e-9)

        def embed(texts):
            encoded        = tokenizer.encode_batch(texts)
            input_ids      = np.array([e.ids            for e in encoded], dtype=np.int64)
            attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
            token_type_ids = np.array([e.type_ids       for e in encoded], dtype=np.int64)
            outputs        = session.run(None, {
                "input_ids": input_ids, "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
            })
            return _normalize(_mean_pool(outputs[0], attention_mask)).tolist()

        logger.info(f"ONNX MiniLM loaded from {model_path}")
        return embed, 384


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


# ── Pipeline ──────────────────────────────────────────────────────────────────

class ElasticsearchPipeline:

    def __init__(self):
        self.es       = None
        self.index    = os.getenv("PROGRAM_ES_INDEX", "grad-programs")
        self.splitter = None
        self.embed_fn = None
        self.dims     = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def open_spider(self, spider):
        from elasticsearch import Elasticsearch

        # Serverless requires an API key — basic auth is not supported
        es_url   = os.getenv("ES_URL")          # full URL e.g. https://<deployment>.es.us-east-1.aws.elastic.cloud
        api_key  = os.getenv("ES_API_KEY")      # from Kibana → Stack Management → API Keys

        if not es_url or not api_key:
            raise RuntimeError(
                "Serverless Elasticsearch requires ES_URL and ES_API_KEY in .env"
            )

        self.es = Elasticsearch(
            es_url,
            api_key=api_key,
        )

        # Serverless: es.info() succeeds but returns no 'version' dict
        try:
            self.es.info()
            logger.info(f"Connected to Elasticsearch Serverless at {es_url}")
        except Exception as e:
            logger.error(f"Cannot connect to Elasticsearch: {e}")
            raise

        self.splitter          = _get_splitter()
        self.embed_fn, self.dims = _get_embedding_fn()
        self._ensure_index()

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
