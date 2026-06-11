from __future__ import annotations

import logging
import asyncio
import json

from src.services.users_service import UserService
from src.core.config import Settings, get_settings
from src.repositories.elastic_repo import get_es
from google import genai
from google.genai import types
import vertexai
from vertexai.generative_models import GenerativeModel

from scholarly import scholarly

settings: Settings = get_settings()
logger = logging.getLogger(__name__)
_genai_client: genai.Client | None = None

# Normalise university names before filtering
UNI_MAP = {
    "massachusetts institute of technology": "MIT",
    "carnegie mellon university":            "CMU",
    "stanford university":                   "STANFORD",
    "university of california berkeley":     "BERKELEY",
    "university of toronto":                 "TORONTO",
}

class FacultyService:

    @staticmethod
    async def embed(text: str) -> list[float]:
        """Embed a query string using Gemini text-embedding-004."""
        from google import genai
        from google.genai import types
        client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
        response = await asyncio.to_thread(
            client.models.embed_content,
            model=settings.EMBEDDING_MODEL,
            contents=[text],
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
        )
        return response.embeddings[0].values
    
    @staticmethod
    def _normalise_uni(name: str) -> str:
        return UNI_MAP.get(name.lower(), name.upper())
    
    @staticmethod
    async def search_faculty_profiles(query: list[str], user_id: str, min_fit_score: int = 0, top_k: int = 5,) -> dict:
        """
        Semantic search against the faculty-profiles ES index.
        Automatically filters by the student's universities_of_interest
        from their Firestore profile.

        Args:
            query:         Research area to search. e.g. "NLP for healthcare"
            user_id:       Firestore user ID to load university preferences.
            min_fit_score: Only return faculty with fit_score >= this (0-100).
            top_k:         Number of results to return.

        Returns:
            Dict with 'faculty' list, each containing name, title, university,
            fit_score, fit_reasoning, conversation_angles, papers.
        """
        try:
            # Load student preferences from Firestore
            profile = await UserService.get_profile(user_id)
            prefs = await UserService.get_preferences(user_id) or {}
            profile = {**profile, **prefs}
            universities = profile.get("target_universities", [])

            # Embed the search query
            vector = await FacultyService.embed(query)

            # Build ES filters
            filters = []
            if min_fit_score > 0:
                filters.append({"range": {"fit_score": {"gte": min_fit_score}}})
            if universities:
                normalised = [FacultyService._normalise_uni(u) for u in universities]
                filters.append({"terms": {"university": normalised}})

            body = {
                "knn": {
                    "field":          "embedding",
                    "query_vector":   vector,
                    "k":              top_k,
                    "num_candidates": top_k * 5,
                    **({"filter": {"bool": {"must": filters}}} if filters else {}),
                },
                "_source": [
                    "name", "title", "university", "department", "program",
                    "email", "source_url", "research_areas", "paper_keywords",
                    "papers", "fit_score", "fit_reasoning", "conversation_angles",
                ],
                "size": top_k,
            }

            es    = get_es()
            index = settings.FACULTY_ES_INDEX

            resp    = await es.search(index=index, body=body)
            hits    = resp["hits"]["hits"]
            seen    = {}
            for hit in hits:
                name = hit["_source"].get("name", "")
                if name not in seen:
                    seen[name] = hit["_source"]
            faculty = list(seen.values())[:top_k]

            return {
                "query":        query,
                "total_found":  len(faculty),
                "universities": universities,
                "faculty":      faculty,
            }

        except Exception as e:
            logger.error(f"search_faculty_profiles failed: {e}")
            return {"error": str(e), "faculty": []}
    

    @staticmethod
    async def fetch_semantic_scholar(faculty_name: str, limit: int) -> list:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/author/search",
                params={"query": faculty_name, "fields": "name,papers.title,papers.year,papers.abstract,papers.citationCount,papers.externalIds"},
                timeout=10,
            )
            if resp.status_code == 429:
                logger.info("Semantic Scholar rate limited, falling back to Google Scholar")
                return await FacultyService.fetch_google_scholar(faculty_name, limit)
        
            data = resp.json()
            authors = data.get("data", [])
            if not authors:
                return await FacultyService.fetch_google_scholar(faculty_name, limit)
        
            papers = authors[0].get("papers", [])[:limit]
            return [{
                "title":     p.get("title", ""),
                "year":      p.get("year"),
                "citations": p.get("citationCount", 0),
                "abstract":  (p.get("abstract") or "")[:600],
                "url":       f"https://www.semanticscholar.org/paper/{p.get('externalIds', {}).get('paperId','')}",
                "source":    "semantic_scholar",
            } for p in papers]

    @staticmethod
    async def fetch_google_scholar(faculty_name: str, limit: int) -> list:
        import asyncio
        from scholarly import scholarly

        def _fetch():
            search_query = scholarly.search_author(faculty_name)
            author = next(search_query, None)
            if not author:
                return []
            author = scholarly.fill(author, sections=['publications'])
            papers = author.get('publications', [])[:limit]
            return [{
                "title":     p['bib'].get('title', ''),
                "year":      p['bib'].get('pub_year'),
                "citations": p.get('num_citations', 0),
                "abstract":  p['bib'].get('abstract', '')[:600],
                "url":       f"https://scholar.google.com/scholar?q={p['bib'].get('title', '').replace(' ', '+')}",
                "source":    "google_scholar",
            } for p in papers]

        return await asyncio.get_event_loop().run_in_executor(None, _fetch)

    @staticmethod
    async def get_faculty_papers(faculty_name: str, limit: int = 5) -> dict:
        # Semantic Scholar
        papers = await FacultyService.fetch_semantic_scholar(faculty_name, limit)

        if not papers:
            logger.info(f"No papers for {faculty_name}")
        return {
            "name":   faculty_name,
            "count":  len(papers),
            "papers": papers,
        }

    @staticmethod
    async def score_faculty_fit(faculty_name: str, research_areas: str, user_id: str, bio: str = "", papers_summary: str = "",) -> dict:
        """
        Score how well a faculty member fits the student's research profile.
        Reads student profile from Firestore.

        Args:
            faculty_name:    Full name of faculty member.
            research_areas:  Faculty's research areas as a string.
            user_id:         Firestore user ID.
            bio:             Optional faculty bio.
            papers_summary:  Optional summary of recent papers.

        Returns:
            Dict with fit_score (0-100), fit_reasoning, conversation_angles.
        """
        try:
            # Load student profile from Firestore
            student = await UserService.get_profile(user_id)
            if not student:
                return {"error": "Student profile not found", "fit_score": 0, "conversation_angles": []}
            prefs = await UserService.get_preferences(user_id) or {}
            student = {**student, **prefs}

            vertexai.init(
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            model = GenerativeModel(settings.GEMINI_MODEL)

            # Format research interests as string if it's a list
            interests = student.get("research_interests", [])
            if isinstance(interests, list):
                interests = ", ".join(interests)

            prompt = f"""Score the research fit between this faculty member and student.
                ONLY reference the papers listed below — do not invent or assume any papers.

                FACULTY:
                Name:           {faculty_name}
                Research Areas: {research_areas}
                Bio:            {bio[:500]}
                Verified Recent Papers:
                {papers_summary if papers_summary else "No papers available"}

                STUDENT:
                Research Interests: {interests}
                Background:         {student.get('background', '')}
                Skills:             {student.get('skills', '')}
                Goals:              {student.get('goals', '')}

                Return ONLY valid JSON, no markdown:
                {{
                    "fit_score": <integer 0-100>,
                    "fit_reasoning": "2-3 sentences explaining the score, referencing specific research areas",
                    "conversation_angles": [
                    "specific talking point referencing a paper title or finding",
                    "how student background directly connects to faculty work",
                    "a concrete research question they could explore together"
                    ]
                }}"""

            result = await model.generate_content_async(prompt)
            raw    = result.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data   = json.loads(raw)

            return {"faculty_name": faculty_name, **data}

        except json.JSONDecodeError as e:
            logger.warning(f"Gemini returned invalid JSON for {faculty_name}: {e}")
            return {"fit_score": 0, "conversation_angles": []}
        except Exception as e:
            logger.error(f"score_faculty_fit failed for {faculty_name}: {e}")
            return {"error": str(e), "fit_score": 0, "conversation_angles": []}

    
    @staticmethod
    async def get_conversation_angles(faculty_name: str, research_areas: str, user_id: str, paper_titles: str = "",) -> dict:
        """
        Generate specific conversation starters for cold outreach to a faculty member.
        Tailored to the student's Firestore profile.

        Args:
            faculty_name:    Full name of faculty member.
            research_areas:  Faculty's research areas.
            user_id:         Firestore user ID.
            paper_titles:    Comma-separated recent paper titles.

        Returns:
            Dict with 'faculty_name' and 'angles' list of 5 talking points.
        """
        try:
            # Load student profile from Firestore
            student = await UserService.get_profile(user_id)
            if not student:
                return {"error": "Student profile not found", "angles": []}
            prefs = await UserService.get_preferences(user_id) or {}
            student = {**student, **prefs}
            vertexai.init(
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            model = GenerativeModel(settings.GEMINI_MODEL)

            interests = student.get("research_interests", [])
            if isinstance(interests, list):
                interests = ", ".join(interests)

            prompt = f"""Generate 5 specific conversation starters for a student
            reaching out to this professor. 
            CRITICAL: Only reference papers from the verified list below. 
            Do NOT invent paper titles or findings.
            If no papers are listed, base angles only on research areas.

            FACULTY:
            Name:           {faculty_name}
            Research Areas: {research_areas}
            Recent Papers:  {paper_titles}
            Verified Papers (use ONLY these):
            {paper_titles if paper_titles else "No papers available — use research areas only"}


            STUDENT:
            Background:  {student.get('background', '')}
            Interests:   {interests}
            Goals:       {student.get('goals', '')}

            Return ONLY a JSON array of 5 strings. No keys, no markdown:
            [
                "angle referencing a specific paper title from the list above",
                "angle connecting student background to a specific research area",
                "angle asking about a specific finding from one of the papers above",
                "angle about a research gap the student noticed in the papers above",
                "angle about a skill the student has that applies to the faculty's work"
            ]"""

            result = await model.generate_content_async(prompt)
            raw    = result.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            angles = json.loads(raw)

            return {
                "faculty_name": faculty_name,
                "angles":       angles,
            }

        except Exception as e:
            logger.error(f"get_conversation_angles failed for {faculty_name}: {e}")
            return {"error": str(e), "angles": []}


# Module-level aliases so ADK can use them as plain callables
search_faculty_profiles  = FacultyService.search_faculty_profiles
get_faculty_papers       = FacultyService.get_faculty_papers
score_faculty_fit        = FacultyService.score_faculty_fit
get_conversation_angles  = FacultyService.get_conversation_angles