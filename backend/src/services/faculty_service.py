from __future__ import annotations

import logging
import asyncio
import json

from src.services.users_service import UserService
from src.config import Settings, get_settings
from src.repositories.elastic_repo import get_es
from google import genai
from google.genai import types
import vertexai
from vertexai.generative_models import GenerativeModel

from scholarly import scholarly

settings: Settings = get_settings()
logger = logging.getLogger(__name__)
_genai_client: genai.Client | None = None


class FacultyService:
    @staticmethod
    def _get_genai_client() -> genai.Client:
        global _genai_client
        if _genai_client is None:
            _genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        return _genai_client



    @staticmethod
    async def embed(texts: list[str]) -> list[list[float]]:
        client = FacultyService._get_genai_client()
        response = await client.aio.models.embed_content(
            model="text-embedding-004",
            contents=texts,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY", 
            ),
        )
        return [
            e.values
            for e in (response.embeddings or [])
            if e.values is not None
        ]
    
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
            profile      = await UserService.get_profile(user_id)
            universities = profile.get("universities_of_interest", [])

            # Embed the search query
            vector = await FacultyService.embed(query)

            # Build ES filters
            filters = []
            if min_fit_score > 0:
                filters.append({"range": {"fit_score": {"gte": min_fit_score}}})
            if universities:
                filters.append({"terms": {"university": [u.upper() for u in universities]}})

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

            try:
                resp    = await es.search(index=index, body=body)
                faculty = [h["_source"] for h in resp["hits"]["hits"]]
            finally:
                await es.close()

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
    async def fetch_google_scholar(faculty_name: str, limit: int) -> list:
        """Fetch papers from Google Scholar via scholarly library."""
        def _run():
            results = []
            try:
                search = scholarly.search_author(faculty_name)
                author = next(search, None)
                if not author:
                    return []
                scholarly.fill(author, sections=["publications"])
                for pub in author.get("publications", [])[:limit * 2]:
                    try:
                        scholarly.fill(pub)
                        results.append({
                            "title":    pub["bib"].get("title", ""),
                            "year":     pub["bib"].get("pub_year"),
                            "citations":pub.get("num_citations", 0),
                            "abstract": pub["bib"].get("abstract", "")[:600],
                            "url":      pub.get("pub_url", ""),
                            "authors":  pub["bib"].get("author", "").split(" and ")[:5],
                            "source":   "google_scholar",
                        })
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"scholarly error for {faculty_name}: {e}")
            return results[:limit]

        return await asyncio.to_thread(_run)

    @staticmethod
    async def get_faculty_papers(faculty_name: str, limit: int = 5) -> dict:
        """
        Retrieve recent publications for a faculty member.

        Args:
            faculty_name: Full name. e.g. "Dina Katabi"
            limit: Number of papers to return (default 5).

        Returns:
            Dict with 'name', 'count', 'papers' list.
            Each paper has: title, year, citations, abstract, url, source.
        """
        # Try Google Scholar first — better coverage
        papers = await FacultyService.fetch_google_scholar(faculty_name, limit)

        # Fall back to Semantic Scholar if blocked or empty
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
                return {"error": "Student profile not found", "fit_score": 0}

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

                FACULTY:
                Name:           {faculty_name}
                Research Areas: {research_areas}
                Bio:            {bio[:500]}
                Recent Papers:  {papers_summary[:500]}

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

            # Run blocking Gemini call in thread pool
            result = await asyncio.to_thread(model.generate_content, prompt)
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

            vertexai.init(
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.GOOGLE_CLOUD_LOCATION,
            )
            model = GenerativeModel(settings.GEMINI_MODEL)

            interests = student.get("research_interests", [])
            if isinstance(interests, list):
                interests = ", ".join(interests)

            prompt = f"""Generate 5 specific conversation starters for a student
            reaching out to this professor. Each must be concrete — reference a paper title,
            specific finding, or direct connection to the student's background.
            Never be generic. The student needs to stand out.

            FACULTY:
            Name:           {faculty_name}
            Research Areas: {research_areas}
            Recent Papers:  {paper_titles}

            STUDENT:
            Background:  {student.get('background', '')}
            Interests:   {interests}
            Goals:       {student.get('goals', '')}

            Return ONLY a JSON array of 5 strings. No keys, no markdown:
            [
                "angle 1",
                "angle 2",
                "angle 3",
                "angle 4",
                "angle 5"
            ]"""

            result = await asyncio.to_thread(model.generate_content, prompt)
            raw    = result.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            angles = json.loads(raw)

            return {
                "faculty_name": faculty_name,
                "angles":       angles,
            }

        except Exception as e:
            logger.error(f"get_conversation_angles failed for {faculty_name}: {e}")
            return {"error": str(e), "angles": []}