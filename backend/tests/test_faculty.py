import asyncio
from dotenv import load_dotenv
load_dotenv()

from src.services.faculty_service import (
    search_faculty_profiles,
    get_faculty_papers,
    score_faculty_fit,
    get_conversation_angles,
)

async def test():
    print('--- Test 1: search_faculty_profiles ---')
    results = await search_faculty_profiles(
        query='machine learning natural language processing',
        user_id='CIMaY5AL98YFAuO8cwlBc7S9ch13',
        top_k=3
    )

    print(f'Found {results["total_found"]} faculty')
    for f in results['faculty']:
        print(f'  {f["name"]} — {f["university"]}')
    print()

    print('--- Test 2: get_faculty_papers ---')
    papers = await get_faculty_papers('Robert Berwick', limit=3)
    print(f'Found {papers["count"]} papers')
    for p in papers['papers']:
        print(f'  {p["title"]} ({p["year"]})')
    print()

    print('--- Test 3: score_faculty_fit ---')
    score = await score_faculty_fit(
        faculty_name='Robert Berwick',
        research_areas='AI for Healthcare and Life Sciences, Artificial Intelligence + Machine Learning, Natural Language and Speech Processing',
        user_id='CIMaY5AL98YFAuO8cwlBc7S9ch13',
    )

    print(f'Fit score: {score.get("fit_score")}/100')
    print(f'Reasoning: {score.get("fit_reasoning")}')
    print()

    print('--- Test 4: get_conversation_angles ---')
    angles = await get_conversation_angles(
        faculty_name='Robert Berwick',
        research_areas='AI for Healthcare and Life Sciences, Artificial Intelligence + Machine Learning, Natural Language and Speech Processing',
        user_id='CIMaY5AL98YFAuO8cwlBc7S9ch13',
        paper_titles=", ".join(p["title"] for p in papers["papers"])
    )

    print('Conversation angles:')
    for a in angles.get('angles', []):
        print(f'  → {a}')

asyncio.run(test())

