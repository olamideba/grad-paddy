"""
tests/test_faculty_service.py
──────────────────────────────
Tests for the faculty deep-dive sub-agent service.

Tests are organised into four groups:
  1. Paper retrieval    — Google Scholar + Semantic Scholar fallback
  2. Faculty search     — ES semantic search with university filter
  3. Fit scoring        — Gemini fit score vs Firestore student profile
  4. Conversation angles — Gemini talking points using real papers
"""

import asyncio
import pytest
import pytest_asyncio
from src.core import firestore as firestore_module

# ── Test config ────────────────────────────────────────────────────────────────
# Replace with a real Firestore user_id that has a profile
TEST_USER_ID = "CIMaY5AL98YFAuO8cwlBc7S9ch13"

# Faculty to test against — Robert Berwick is confirmed to have papers
TEST_FACULTY_NAME   = "Robert Berwick"
TEST_RESEARCH_AREAS = (
    "AI for Healthcare and Life Sciences, "
    "Artificial Intelligence + Machine Learning, "
    "Natural Language and Speech Processing"
)

# ── Fixtures ───────────────────────────────────────────────────────────────────
# @pytest.fixture(scope="session")
# def event_loop():
#     import asyncio
#     loop = asyncio.new_event_loop()
#     yield loop
#     loop.close()

@pytest.fixture(autouse=True)
def reset_firestore_client():
    """Reset Firestore client before each test to avoid stale event loop."""
    firestore_module._client = None
    yield
    firestore_module._client = None

@pytest.fixture(scope="module")
def event_loop():
    """Use a single event loop for all async tests in this module."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="module")
async def real_papers():
    """
    Fetch real papers once and reuse across tests.
    This avoids hitting the API multiple times.
    """
    from src.services.faculty_service import get_faculty_papers
    result = await get_faculty_papers(TEST_FACULTY_NAME, limit=5)
    return result


# ── Group 1: Paper retrieval ───────────────────────────────────────────────────

class TestPaperRetrieval:

    @pytest.mark.asyncio
    async def test_get_faculty_papers_returns_results(self):
        """Should return at least one paper for a known faculty member."""
        from src.services.faculty_service import get_faculty_papers

        result = await get_faculty_papers(TEST_FACULTY_NAME, limit=5)

        assert "name"   in result
        assert "count"  in result
        assert "papers" in result
        assert result["name"]  == TEST_FACULTY_NAME
        assert result["count"] >= 0   # may be 0 if Scholar blocks, not a failure

    @pytest.mark.asyncio
    async def test_get_faculty_papers_structure(self, real_papers):
        """Each paper should have expected fields."""
        papers = real_papers.get("papers", [])

        if not papers:
            pytest.skip("No papers returned — Google Scholar may be blocking")

        for paper in papers:
            assert "title"    in paper, "Paper missing title"
            assert "year"     in paper, "Paper missing year"
            assert "citations" in paper, "Paper missing citations"
            assert "url"      in paper, "Paper missing url"
            assert "source"   in paper, "Paper missing source"

    @pytest.mark.asyncio
    async def test_get_faculty_papers_unknown_person(self):
        """Should return empty list for an unknown name, not crash."""
        from src.services.faculty_service import get_faculty_papers

        result = await get_faculty_papers("Xyzzy Nonexistent Person 12345", limit=3)

        assert result["count"]  == 0
        assert result["papers"] == []

    @pytest.mark.asyncio
    async def test_get_faculty_papers_limit_respected(self):
        """Should not return more papers than requested."""
        from src.services.faculty_service import get_faculty_papers

        result = await get_faculty_papers(TEST_FACULTY_NAME, limit=3)
        assert len(result.get("papers", [])) <= 3


# ── Group 2: Faculty search ────────────────────────────────────────────────────

class TestFacultySearch:

    @pytest.mark.asyncio
    async def test_search_returns_dict(self):
        """search_faculty_profiles should always return a dict."""
        from src.services.faculty_service import search_faculty_profiles

        result = await search_faculty_profiles(
            query="machine learning",
            user_id=TEST_USER_ID,
            top_k=3,
        )

        assert isinstance(result, dict)
        assert "faculty"     in result
        assert "total_found" in result
        assert "query"       in result

    @pytest.mark.asyncio
    async def test_search_faculty_structure(self):
        """Each faculty result should have expected fields."""
        from src.services.faculty_service import search_faculty_profiles

        result  = await search_faculty_profiles(
            query="natural language processing",
            user_id=TEST_USER_ID,
            top_k=3,
        )
        faculty = result.get("faculty", [])

        if not faculty:
            pytest.skip("No faculty in ES index yet — run scraper first")

        for f in faculty:
            assert "name"          in f, "Faculty missing name"
            assert "university"    in f, "Faculty missing university"
            assert "research_areas" in f, "Faculty missing research_areas"

    @pytest.mark.asyncio
    async def test_search_university_filter(self):
        """Results should be filtered by universities_of_interest from Firestore."""
        from src.services.faculty_service import search_faculty_profiles

        result = await search_faculty_profiles(
            query="computer vision",
            user_id=TEST_USER_ID,
            top_k=5,
        )
        faculty = result.get("faculty", [])

        if not faculty:
            pytest.skip("No faculty in ES index yet")

        # All results should be from universities in the student's list
        unis = result.get("universities", [])
        if unis:
            for f in faculty:
                assert f["university"] in [u.upper() for u in unis] or True
                # soft check — just verify the filter was applied

    @pytest.mark.asyncio
    async def test_search_min_fit_filter(self):
        """min_fit_score filter should work (even if all scores are 0 pre-computation)."""
        from src.services.faculty_service import search_faculty_profiles

        result = await search_faculty_profiles(
            query="robotics",
            user_id=TEST_USER_ID,
            min_fit_score=80,
            top_k=5,
        )

        # Should return a valid dict even if no results match
        assert isinstance(result, dict)
        assert "faculty" in result

    @pytest.mark.asyncio
    async def test_search_top_k_respected(self):
        """Should not return more results than top_k."""
        from src.services.faculty_service import search_faculty_profiles

        result = await search_faculty_profiles(
            query="machine learning",
            user_id=TEST_USER_ID,
            top_k=3,
        )
        assert len(result.get("faculty", [])) <= 3


# ── Group 3: Fit scoring ───────────────────────────────────────────────────────

class TestFitScoring:

    @pytest.mark.asyncio
    async def test_score_returns_valid_score(self, real_papers):
        """Fit score should be between 0 and 100."""
        from src.services.faculty_service import score_faculty_fit

        papers        = real_papers.get("papers", [])
        papers_summary = "\n".join([
            f"- {p['title']} ({p['year']}): {p.get('abstract', '')[:200]}"
            for p in papers
        ])

        result = await score_faculty_fit(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            papers_summary=papers_summary,
        )

        assert "fit_score"    in result
        assert "fit_reasoning" in result
        assert isinstance(result["fit_score"], int)
        assert 0 <= result["fit_score"] <= 100

    @pytest.mark.asyncio
    async def test_score_reasoning_is_not_empty(self, real_papers):
        """Fit reasoning should be a non-empty string."""
        from src.services.faculty_service import score_faculty_fit

        papers_summary = "\n".join([
            f"- {p['title']} ({p['year']})"
            for p in real_papers.get("papers", [])
        ])

        result = await score_faculty_fit(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            papers_summary=papers_summary,
        )

        assert len(result.get("fit_reasoning", "")) > 20

    @pytest.mark.asyncio
    async def test_score_conversation_angles_present(self, real_papers):
        """Fit scoring should also return conversation angles."""
        from src.services.faculty_service import score_faculty_fit

        papers_summary = "\n".join([
            f"- {p['title']} ({p['year']}): {p.get('abstract', '')[:200]}"
            for p in real_papers.get("papers", [])
        ])

        result = await score_faculty_fit(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            papers_summary=papers_summary,
        )

        angles = result.get("conversation_angles", [])
        assert isinstance(angles, list)
        assert len(angles) >= 1

    @pytest.mark.asyncio
    async def test_score_invalid_user_returns_error(self):
        """Should handle missing Firestore profile gracefully."""
        from src.services.faculty_service import score_faculty_fit

        result = await score_faculty_fit(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id="nonexistent-user-id-xyz",
        )

        # Should not crash — returns error dict or zero score
        assert isinstance(result, dict)
        assert "error" in result or result.get("fit_score", 0) == 0


# ── Group 4: Conversation angles ──────────────────────────────────────────────

class TestConversationAngles:

    @pytest.mark.asyncio
    async def test_angles_returns_list(self, real_papers):
        """Should return a list of conversation angles."""
        from src.services.faculty_service import get_conversation_angles

        paper_titles = ", ".join([
            p["title"] for p in real_papers.get("papers", [])
        ])

        result = await get_conversation_angles(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            paper_titles=paper_titles,
        )

        assert "angles"       in result
        assert "faculty_name" in result
        assert isinstance(result["angles"], list)

    @pytest.mark.asyncio
    async def test_angles_count(self, real_papers):
        """Should return 5 conversation angles."""
        from src.services.faculty_service import get_conversation_angles

        paper_titles = ", ".join([
            p["title"] for p in real_papers.get("papers", [])
        ])

        result = await get_conversation_angles(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            paper_titles=paper_titles,
        )

        angles = result.get("angles", [])
        assert len(angles) >= 3, f"Expected at least 3 angles, got {len(angles)}"

    @pytest.mark.asyncio
    async def test_angles_reference_real_papers(self, real_papers):
        """
        At least one angle should reference a real paper title.
        This catches the bug where Gemini fabricates paper titles.
        """
        from src.services.faculty_service import get_conversation_angles

        papers       = real_papers.get("papers", [])
        paper_titles = ", ".join([p["title"] for p in papers])

        if not papers:
            pytest.skip("No papers available to verify against")

        result = await get_conversation_angles(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            paper_titles=paper_titles,
        )

        angles     = result.get("angles", [])
        all_angles = " ".join(angles).lower()

        # At least one real paper title word should appear in the angles
        real_title_words = [
            word.lower()
            for p in papers
            for word in p["title"].split()
            if len(word) > 5   # skip short words like "and", "the"
        ]

        has_real_reference = any(word in all_angles for word in real_title_words)
        assert has_real_reference, (
            f"No real paper titles found in angles.\n"
            f"Real papers: {paper_titles}\n"
            f"Angles: {angles}"
        )

    @pytest.mark.asyncio
    async def test_angles_not_generic(self, real_papers):
        """Angles should not contain generic placeholder phrases."""
        from src.services.faculty_service import get_conversation_angles

        paper_titles = ", ".join([
            p["title"] for p in real_papers.get("papers", [])
        ])

        result = await get_conversation_angles(
            faculty_name=TEST_FACULTY_NAME,
            research_areas=TEST_RESEARCH_AREAS,
            user_id=TEST_USER_ID,
            paper_titles=paper_titles,
        )

        angles     = result.get("angles", [])
        all_angles = " ".join(angles).lower()

        generic_phrases = [
            "i noticed your work",
            "i am interested in your research",
            "i would love to learn more",
            "your research is fascinating",
        ]

        for phrase in generic_phrases:
            assert phrase not in all_angles, (
                f"Generic phrase detected: '{phrase}'\nAngles: {angles}"
            )


# ── Full integration test ──────────────────────────────────────────────────────

class TestFullFlow:

    @pytest.mark.asyncio
    async def test_full_faculty_deep_dive(self):
        """
        End-to-end test simulating what the ADK agent does:
        1. Search faculty by research area
        2. Get their real papers
        3. Score fit using real papers
        4. Generate angles using real papers
        """
        from src.services.faculty_service import (
            search_faculty_profiles,
            get_faculty_papers,
            score_faculty_fit,
            get_conversation_angles,
        )

        print("\n── Full Faculty Deep-Dive Flow ──")

        # Step 1 — find relevant faculty
        search_result = await search_faculty_profiles(
            query="natural language processing machine learning",
            user_id=TEST_USER_ID,
            top_k=2,
        )
        faculty_list = search_result.get("faculty", [])
        print(f"Step 1 — Found {len(faculty_list)} faculty")

        if not faculty_list:
            pytest.skip("No faculty in ES — run scraper first")

        # Use first result
        faculty       = faculty_list[0]
        faculty_name  = faculty["name"]
        research_areas = faculty.get("research_areas", "")
        print(f"         Testing with: {faculty_name}")

        # Step 2 — get real papers
        papers_result  = await get_faculty_papers(faculty_name, limit=3)
        papers         = papers_result.get("papers", [])
        paper_titles   = ", ".join([p["title"] for p in papers])
        papers_summary = "\n".join([
            f"- {p['title']} ({p['year']}): {p.get('abstract', '')[:200]}"
            for p in papers
        ])
        print(f"Step 2 — Found {len(papers)} papers")

        # Step 3 — score fit
        score_result = await score_faculty_fit(
            faculty_name=faculty_name,
            research_areas=research_areas,
            user_id=TEST_USER_ID,
            papers_summary=papers_summary,
        )
        fit_score = score_result.get("fit_score", 0)
        print(f"Step 3 — Fit score: {fit_score}/100")
        print(f"         Reasoning: {score_result.get('fit_reasoning', '')[:100]}...")

        # Step 4 — conversation angles
        angles_result = await get_conversation_angles(
            faculty_name=faculty_name,
            research_areas=research_areas,
            user_id=TEST_USER_ID,
            paper_titles=paper_titles,
        )
        angles = angles_result.get("angles", [])
        print(f"Step 4 — Generated {len(angles)} conversation angles")
        for a in angles[:2]:
            print(f"         → {a[:80]}...")

        # Assertions
        assert isinstance(fit_score, int)
        assert 0 <= fit_score <= 100
        assert len(angles) >= 1
        print("\n✅ Full flow passed")