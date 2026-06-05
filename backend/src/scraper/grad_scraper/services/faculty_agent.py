import json
import asyncio
import logging
import re

from src.core.config import get_settings
from src.repositories.elastic_repo import get_es
from src.services.users_service import UserService
from grad_scraper.services.paper_retrieval import fetch_papers

settings = get_settings()
logger = logging.getLogger(__name__)


async def _gemini_analyze(faculty: dict, papers: list) -> dict:
    """
    Sends faculty profile + papers + student profile to Gemini.
    Returns fit score, reasoning, paper keywords, and conversation angles.
    Falls back to empty dict if Gemini is disabled or fails.
    """
    if settings.GEMINI_ENABLED:
        return {}

    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
        model = GenerativeModel(
            settings.GEMINI_MODEL
        )
    except Exception as e:
        logger.warning(f"Vertex AI init failed: {e}")
        return {}

    student = await UserService.get_profile(user_id)

    papers_text = "\n".join([
        f"- \"{p['title']}\" ({p['year']}, {p['citations']} citations)\n"
        f"  {p['abstract'][:300]}"
        for p in papers
    ]) or "No papers found on Semantic Scholar."

    prompt = f"""You are helping a graduate school applicant evaluate faculty fit
and prepare for cold outreach emails and interviews.

FACULTY PROFILE:
Name:             {faculty.get('name', '')}
Title:            {faculty.get('title', '')}
University:       {faculty.get('university', '')}
Department:       {faculty.get('department', '')}
Research Areas:   {faculty.get('research_areas', '')}
Bio:              {str(faculty.get('bio', ''))[:800]}

RECENT PAPERS:
{papers_text}

STUDENT PROFILE:
Research Interests: {student['research_interests']}
Background:         {student['background']}
Skills:             {student['skills']}
Goals:              {student['goals']}

Return ONLY a valid JSON object. No markdown, no backticks, no extra text.
{{
  "paper_keywords": [
    "3 to 5 key research themes distilled from the papers above"
  ],
  "fit_score": <integer 0-100 reflecting how well this faculty's research
                aligns with the student's interests and background>,
  "fit_reasoning": "2-3 sentences explaining the score, referencing specific
                    papers or research areas and the student's background",
  "conversation_angles": [
    "Specific talking point 1 — reference a paper title or finding and
     connect it to something in the student's background",
    "Specific talking point 2 — a research question the student could
     explore with this faculty member",
    "Specific talking point 3 — a skill or project the student has that
     is directly relevant to this faculty's current work"
  ]
}}"""

    try:
        result = await asyncio.to_thread(model.generate_content, prompt)
        raw    = result.text.strip()
        raw    = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"Gemini returned invalid JSON for {faculty.get('name')}: {e}")
        return {}
    except Exception as e:
        logger.warning(f"Gemini analysis failed for {faculty.get('name')}: {e}")
        return {}



class FacultySubAgent:
    """
    Enriches a faculty dict with papers, fit score, and conversation angles.

    Usage:
        agent  = FacultySubAgent()
        result = await agent.analyze(faculty_dict)
        # result contains: papers, paper_keywords, fit_score,
        # fit_reasoning, conversation_angles
    """

    async def analyze(self, faculty: dict) -> dict:
        name = faculty.get("name", "").strip()
        if not name:
            logger.debug("FacultySubAgent: skipping — no faculty name")
            return {}

        logger.info(f"FacultySubAgent: analyzing {name}")
        
        # Only fetch papers at scrape time — no fit scoring
        papers = await fetch_papers(name, limit=5)

        return {
            "papers":              papers,
            "paper_keywords":      FacultySubAgent._extract_keywords(papers),
            "fit_score":           0,
            "fit_reasoning":       " ",
            "conversation_angles": [],
        }


    @staticmethod
    def _extract_keywords(papers: list) -> list:
        """Extract simple keywords from paper titles without Gemini."""
        words = []
        for p in papers:
            title = p.get("title", "").lower()
            # Remove common stop words, keep meaningful terms
            words.extend(re.findall(r'\b[a-z]{4,}\b', title))
        # Return most common unique terms
        from collections import Counter
        return [w for w, _ in Counter(words).most_common(10)
            if w not in {"with", "from", "that", "this", "using", "based", "toward"}]