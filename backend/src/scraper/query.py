import sys
import json
import argparse
from src.core.config import get_settings

settings = get_settings()

def get_es():
    from elasticsearch import Elasticsearch
    es_url  = settings.ES_URL
    api_key = settings.ELASTIC_API_KEY
    if not es_url or not api_key:
        raise RuntimeError("Set ES_URL and ELASTIC_API_KEY in .env")
    return Elasticsearch(es_url, api_key=api_key)


def embed_query(text: str) -> list[float]:
    import vertexai
    from vertexai.language_models import TextEmbeddingModel

    vertexai.init(
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )
    model    = TextEmbeddingModel.from_pretrained(
        settings.EMBEDDING_MODEL
    )
    response = model.get_embeddings([text])
    return response[0].values


def semantic_search(es, index, query_text, top_k=5):
    """kNN vector search."""
    vector = embed_query(query_text)
    resp = es.search(
        index=index,
        body={
            "knn": {
                "field": "embedding",
                "query_vector": vector,
                "k": top_k,
                "num_candidates": top_k * 5,
            },
            "_source": ["university", "program", "text", "source_field", "deadline", "funding", "source_url"],
        }
    )
    return resp["hits"]["hits"]


def keyword_search(es, index, query_text, top_k=5):
    """Full-text BM25 search."""
    resp = es.search(
        index=index,
        body={
            "query": {
                "multi_match": {
                    "query": query_text,
                    "fields": ["text^3", "program^2", "university^2", "research_groups"],
                    "fuzziness": "AUTO",
                }
            },
            "size": top_k,
            "_source": ["university", "program", "text", "source_field", "deadline", "funding", "source_url"],
        }
    )
    return resp["hits"]["hits"]


def hybrid_search(es, index, query_text, top_k=5):
    """Combine BM25 + kNN with Reciprocal Rank Fusion (RRF) — ES 8.8+."""
    vector = embed_query(query_text)
    resp = es.search(
        index=index,
        body={
            "retriever": {
                "rrf": {
                    "retrievers": [
                        {
                            "standard": {
                                "query": {
                                    "multi_match": {
                                        "query": query_text,
                                        "fields": ["text^3", "program^2", "university"],
                                    }
                                }
                            }
                        },
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": vector,
                                "k": top_k,
                                "num_candidates": top_k * 5,
                            }
                        },
                    ],
                    "rank_window_size": 50,
                    "rank_constant": 20,
                }
            },
            "size": top_k,
            "_source": ["university", "program", "text", "source_field", "deadline", "funding", "url"],
        }
    )
    return resp["hits"]["hits"]


def print_results(hits):
    if not hits:
        print("No results found.")
        return
    for i, hit in enumerate(hits, 1):
        src = hit["_source"]
        score = hit.get("_score", "–")
        print(f"\n{'─'*60}")
        print(f"#{i}  [{src.get('university','')}]  {src.get('program','')}")
        print(f"    Source field : {src.get('source_field','')}")
        print(f"    Score        : {score}")
        if src.get("deadline"):
            print(f"    Deadline     : {src['deadline']}")
        if src.get("funding"):
            snippet = src["funding"][:120].replace("\n", " ")
            print(f"    Funding      : {snippet}...")
        print(f"    Text snippet : {src.get('text','')[:200]}...")
        print(f"    URL: {src.get('source_url', '')}")


def main():
    parser = argparse.ArgumentParser(description="Search the grad-programs ES index")
    parser.add_argument("query", help="Natural language search query")
    parser.add_argument(
        "--mode", choices=["semantic", "keyword", "hybrid"], default="hybrid",
        help="Search mode (default: hybrid)"
    )
    parser.add_argument("--top", type=int, default=5, help="Number of results (default: 5)")
    parser.add_argument("--index", default=settings.PROGRAM_ES_INDEX)
    args = parser.parse_args()

    es = get_es()
    print(f"\nSearching [{args.mode}]: \"{args.query}\"\n")

    if args.mode == "semantic":
        hits = semantic_search(es, args.index, args.query, args.top)
    elif args.mode == "keyword":
        hits = keyword_search(es, args.index, args.query, args.top)
    else:
        hits = hybrid_search(es, args.index, args.query, args.top)

    print_results(hits)


if __name__ == "__main__":
    main()
