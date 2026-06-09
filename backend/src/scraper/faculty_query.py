import argparse
from src.core.config import get_settings
from src.scraper.query import embed_query

settings = get_settings()

def get_es():
    from elasticsearch import Elasticsearch
    return Elasticsearch(
        settings.ES_URL,
        api_key=settings.ELASTIC_API_KEY
    )


def search_faculty(query: str, top_k: int = 5, min_fit: int = 0, university: str = ""):
    es    = get_es()
    index = settings.FACULTY_ES_INDEX
    vec   = embed_query(query)

    filters = []
    if min_fit > 0:
        filters.append({"range": {"fit_score": {"gte": min_fit}}})
    if university:
        filters.append({"term": {"university": university.upper()}})

    body = {
        "knn": {
            "field":        "embedding",
            "query_vector": vec,
            "k":            top_k,
            "num_candidates": top_k * 5,
            "filter": {"bool": {"must": filters}} if filters else {"match_all": {}},
        },
        "_source": [
            "name", "title", "university", "department", "program",
            "email", "source_url", "research_areas", "paper_keywords",
            "papers", "fit_score", "fit_reasoning", "conversation_angles",
        ],
        "size": top_k,
    }

    resp = es.search(index=index, body=body)
    return resp["hits"]["hits"]


def print_results(hits: list):
    if not hits:
        print("No faculty found.")
        return

    for i, hit in enumerate(hits, 1):
        src   = hit["_source"]
        score = hit.get("_score", "–")

        print(f"\n{'═'*65}")
        print(f"#{i}  {src.get('name', '')}  —  {src.get('title', '')}")
        print(f"     {src.get('university', '')} · {src.get('department', '')} · {src.get('program', '')}")

        if src.get("email"):
            print(f"{src['email']}")
        if src.get("source_url"):
            print(f"{src['source_url']}")

        print(f"\n  Fit score      : {src.get('fit_score', 0)}/100")
        if src.get("fit_reasoning"):
            print(f"  Fit reasoning  : {src['fit_reasoning']}")

        if src.get("paper_keywords"):
            print(f"\n  Research themes: {', '.join(src['paper_keywords'])}")

        if src.get("research_areas"):
            print(f"  Research areas : {src['research_areas'][:120]}...")

        if src.get("papers"):
            print(f"\n  Recent papers ({len(src['papers'])}):")
            for p in src["papers"][:3]:
                print(f"    • {p.get('title', '')} ({p.get('year', '?')}, {p.get('citations', 0)} citations)")

        if src.get("conversation_angles"):
            print(f"\n  Conversation angles:")
            for angle in src["conversation_angles"]:
                print(f"    → {angle}")

        print(f"\n  Similarity score: {score}")


def main():
    parser = argparse.ArgumentParser(description="Search faculty profiles")
    parser.add_argument("query",        help="Research interest or topic")
    parser.add_argument("--top",        type=int,   default=5,  help="Number of results")
    parser.add_argument("--min-fit",    type=int,   default=0,  help="Minimum fit score (0-100)")
    parser.add_argument("--university", type=str,   default="", help="Filter by university")
    parser.add_argument("--index",      default=settings.FACULTY_ES_INDEX)
    args = parser.parse_args()

    print(f"\nSearching faculty: \"{args.query}\"")
    if args.min_fit:
        print(f"  Min fit score : {args.min_fit}")
    if args.university:
        print(f"  University    : {args.university}")

    hits = search_faculty(args.query, args.top, args.min_fit, args.university)
    print_results(hits)


if __name__ == "__main__":
    main()