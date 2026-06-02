"""
query.py
────────
CLI utility to search the Elasticsearch index after scraping.

Usage:
    python query.py "NLP faculty at Toronto"
    python query.py "funded CS PhD deadlines December" --mode keyword
    python query.py "machine learning for healthcare" --top 10
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv

load_dotenv()


def get_es():
    from elasticsearch import Elasticsearch
    es_url  = os.getenv("ES_URL")
    api_key = os.getenv("ES_API_KEY")
    if not es_url or not api_key:
        raise RuntimeError("Set ES_URL and ES_API_KEY in .env")
    return Elasticsearch(es_url, api_key=api_key)


def embed_query(text):
    backend = os.getenv("EMBEDDING_BACKEND", "local").lower()
    if backend == "openai":
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        resp = client.embeddings.create(model="text-embedding-3-small", input=[text])
        return resp.data[0].embedding
    else:
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer

        model_path     = os.getenv("ONNX_MODEL_PATH", "models/model.onnx")
        tokenizer_path = os.getenv("ONNX_TOKENIZER_PATH", os.path.dirname(model_path))

        session   = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        tokenizer = Tokenizer.from_file(os.path.join(tokenizer_path, "tokenizer.json"))
        tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=128)
        tokenizer.enable_truncation(max_length=128)

        encoded        = tokenizer.encode_batch([text])
        input_ids      = np.array([e.ids            for e in encoded], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
        token_type_ids = np.array([e.type_ids       for e in encoded], dtype=np.int64)

        outputs = session.run(None, {
            "input_ids": input_ids, "attention_mask": attention_mask,
            "token_type_ids": token_type_ids,
        })
        mask   = attention_mask[:, :, np.newaxis].astype(np.float32)
        pooled = (outputs[0] * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1e-9)
        norm   = pooled / np.linalg.norm(pooled, axis=1, keepdims=True).clip(min=1e-9)
        return norm[0].tolist()


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
    parser.add_argument("--index", default=os.getenv("PROGRAM_ES_INDEX", "grad-programs"))
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
