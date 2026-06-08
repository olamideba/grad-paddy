import logging
import numpy as np
from datetime import datetime, timezone


from itemadapter import ItemAdapter
from src.core.config import get_settings
from grad_scraper.items.faculty_profile import FacultyProfileItem
from grad_scraper.pipelines.elasticsearch import _get_splitter, _get_embedding_fn

settings=get_settings()
logger = logging.getLogger(__name__)

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
        api_key = settings.ES_API_KEY
        if not es_url or not api_key:
            raise RuntimeError("ES_URL and ES_API_KEY required in .env")

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
        if not isinstance(item, FacultyProfileItem):
            return item

        if self.embed_fn is None:
            self.embed_fn, self.dims = _get_embedding_fn()
            self._ensure_index()


        adapter = ItemAdapter(item)

        metadata = {
            "name":           adapter.get("name", ""),
            "title":          adapter.get("title", ""),
            "university":     adapter.get("university", ""),
            "email":          adapter.get("email", ""),
            "papers":         adapter.get("papers", []),
            "research_areas": adapter.get("research_areas", ""),
            "paper_keywords": adapter.get("paper_keywords", []),
            "source_url":     adapter.get("source_url", ""),
            "fit_score":      adapter.get("fit_score", 0),
            "scraped_at":     adapter.get("scraped_at", ""),
        }

        bio            = adapter.get("bio", "")
        research_areas = adapter.get("research_areas", "")
        papers         = adapter.get("papers", [])

        papers_text = "\n".join([
            f"{p.get('title', '')} ({p.get('year', '')}): {p.get('abstract', '')}"
            for p in papers
            if p.get("title")
        ])

        full_content = " ".join(filter(None, [
            f"Professor {metadata['name']} at {metadata['university']}.",
            f"Research areas: {research_areas}.",
            bio,
            papers_text,
        ]))

        chunks = self.splitter.split_text(full_content)
        logger.debug(f"  {metadata['name']}: {len(chunks)} chunks")

        embeddings = self.embed_fn(chunks)

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
                    f"Indexed {len(chunks)} chunks for "
                    f"{metadata['name']} @ {metadata['university']} "
                    f"(fit={metadata['fit_score']})"
                )
        return item