import json
import httpx
import logging

from google.adk.tools import FunctionTool, LongRunningFunctionTool, ToolContext

from src.agents.context import require_user_id
from src.agents.schemas import (
    ApplicationCreateToolRequest,
    ApplicationUpdateToolRequest,
    ContentUpdateToolRequest,
    DraftCreateToolRequest,
    DraftListToolRequest,
    DraftStatusToolRequest,
    EmailCreateToolRequest,
    FacultyCreateToolRequest,
    FacultyUpdateToolRequest,
    OutreachStatusToolRequest,
    PreferencesUpdateToolRequest,
    ProfileUpdateToolRequest,
    RecommenderAddToolRequest,
    RecommenderStatusToolRequest,
    ShortlistListToolRequest,
)
from src.services.drafts_service import DraftsService
from src.services.emails_service import EmailsService
from src.services.hitl_service import HITLService
from src.services.shortlist_service import ShortlistService
from src.services.tracker_service import TrackerService
from src.services.users_service import UserService
from src.services.ingestion_service import IngestionService
from src.services.faculty_service import FacultyService
from src.scraper.grad_scraper.pipelines.elasticsearch import _get_embedding_fn
from src.core.config import get_settings

logger = logging.getLogger(__name__)

try:
    embed_fn, _ = _get_embedding_fn()
except Exception as e:
    logger.error(f"Failed to initialize embedding function: {e}")
    embed_fn = None


def _response(data: object, message: str = "") -> dict[str, object]:
    return {"success": True, "data": data, "message": message}


def _tool_error(error_code: str, message: str) -> dict[str, object]:
    """Sanitized failure payload returned to the LLM.

    Never put raw upstream errors (status bodies, exception text, stack
    traces) in here — anything in this payload lands in the model context
    and can be relayed to the end user.
    """
    return {"success": False, "error_code": error_code, "message": message}


# ── Account ───────────────────────────────────────────────────────────────────


async def get_profile(tool_context: ToolContext) -> dict[str, object]:
    """Retrieve the current user's profile.

    Use this to read the user's identity information before displaying it,
    personalising a response, or deciding whether onboarding is complete.

    Returns:
        A dict with keys:
            'success': bool — always True on success.
            'data': dict containing:
                'id': str — the user's unique ID.
                'email': str — the user's email address.
                'name': str — the user's display name.
                'avatar_url': str | None — URL to the user's profile photo.
                'onboarded': bool — whether the user has completed onboarding.
            'message': str — empty string on read operations.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'uid_abc123',
                    'email': 'jane@example.com',
                    'name': 'Jane Doe',
                    'avatar_url': 'https://example.com/avatars/jane.png',
                    'onboarded': True
                },
                'message': ''
            }

    Raises:
        ValueError: If the user profile does not exist.
    """
    user_id = require_user_id(tool_context)
    profile = await UserService.get_profile(user_id)
    return _response(profile)


async def update_profile(
    payload: ProfileUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update the current user's display name or avatar URL.

    Use this when the user explicitly asks to change their name or profile
    picture. Pass only the fields that should change; omit the rest.

    Args:
        payload: Fields to update. All fields are optional:
            'name': str — new display name (e.g. 'Jane Doe').
            'avatar_url': str — new avatar URL.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full updated profile (same shape as get_profile).
            'message': str — 'Profile updated successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'uid_abc123',
                    'email': 'jane@example.com',
                    'name': 'Jane Smith',
                    'avatar_url': 'https://example.com/avatars/jane_new.png',
                    'onboarded': True
                },
                'message': 'Profile updated successfully'
            }

    Raises:
        ValueError: If the user profile does not exist.
    """
    user_id = require_user_id(tool_context)
    profile = await UserService.update_profile(user_id, payload.model_dump(exclude_unset=True))
    return _response(profile, "Profile updated successfully")


update_profile = FunctionTool(update_profile)


async def get_preferences(tool_context: ToolContext) -> dict[str, object]:
    """Retrieve the current user's application preferences.

    Call this before calling update_preferences whenever you need to know
    the existing list values — update_preferences performs full list replacement,
    so you must supply the complete desired list, not just new items.

    Also useful for summarising the user's search criteria without modifying
    anything.

    Returns:
        A dict with keys:
            'success': bool — always True on success.
            'data': dict containing:
                'research_interests': list[str] — topics the user wants to study.
                'target_countries': list[str] — preferred countries for study.
                'target_universities': list[str] — preferred institutions.
                'degree_type': str — desired degree level
                    (e.g. 'PhD', 'MSc', 'Either').
                'funding_required': bool — whether the user needs funding.
            'message': str — empty string on read operations.

        Example:
            {
                'success': True,
                'data': {
                    'research_interests': ['machine learning', 'NLP'],
                    'target_countries': ['USA', 'Canada'],
                    'target_universities': ['MIT', 'Stanford'],
                    'degree_type': 'PhD',
                    'funding_required': True
                },
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    preferences = await UserService.get_preferences(user_id)
    return _response(preferences or {})


async def update_preferences(
    payload: PreferencesUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update one or more of the user's application preferences.

    Pass only the fields you want to change; omit any field to leave it
    unchanged. List fields (research_interests, countries, universities) are
    fully replaced when supplied — you must provide the entire desired list,
    not just the new items.

    Workflow for adding a single item to a list:
        1. Call get_preferences to read the current list.
        2. Append the new item to the list locally.
        3. Call update_preferences with the complete updated list.

    Args:
        payload: Fields to update. All fields are optional:
            'research_interests': list[str] — complete replacement list of
                research topics (e.g. ['machine learning', 'robotics']).
            'countries': list[str] — complete replacement list of target
                countries (e.g. ['USA', 'UK', 'Germany']).
            'universities': list[str] — complete replacement list of target
                universities (e.g. ['MIT', 'Oxford']).
            'degree_type': str — desired degree level
                (e.g. 'PhD', 'MSc', 'Either').
            'funding_required': bool — whether the user requires funding.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full updated preferences document
                (same shape as get_preferences).
            'message': str — 'Preferences updated successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'research_interests': ['machine learning', 'robotics'],
                    'target_countries': ['USA', 'Canada'],
                    'target_universities': ['MIT', 'Stanford'],
                    'degree_type': 'PhD',
                    'funding_required': True
                },
                'message': 'Preferences updated successfully'
            }

    Raises:
        ValueError: If the preferences document does not exist.
    """
    user_id = require_user_id(tool_context)
    preferences = await UserService.update_preferences(
        user_id, payload.model_dump(exclude_unset=True)
    )
    return _response(preferences, "Preferences updated successfully")


update_preferences = FunctionTool(update_preferences)


# ── Shortlist ─────────────────────────────────────────────────────────────────


async def add_shortlist_faculty(
    payload: FacultyCreateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Add a faculty member to the user's shortlist.

    Use this after researching a professor and deciding they are a good fit.
    The fit_score should reflect how well this faculty member aligns with the
    user's research interests (0.0–10.0 scale).

    Args:
        payload: Required and optional faculty fields:
            'name': str — full name (e.g. 'Prof. Andrew Ng').
            'university': str — institution (e.g. 'Stanford University').
            'department': str — department (e.g. 'Computer Science').
            'email': str | None — contact email.
            'webpage': str | None — URL to the faculty member's page.
            'research_summary': str | None — short description of their work.
            'fit_score': float — alignment score, 0.0–10.0 (default 0.0).
            'position_status': str — known position availability
                (e.g. 'open', 'unknown', 'closed'). Default 'unknown'.
            'outreach_status': str — current contact state
                (e.g. 'not_contacted', 'email_sent', 'replied'). Default 'not_contacted'.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the newly created shortlist entry, including:
                'id': str — generated ID for this entry.
                'name', 'university', 'department', 'email', 'webpage',
                'research_summary', 'fit_score', 'position_status',
                'outreach_status', 'created_at': str (ISO timestamp).
            'message': str — 'Faculty member added successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'fac_xyz789',
                    'name': 'Prof. Andrew Ng',
                    'university': 'Stanford University',
                    'department': 'Computer Science',
                    'email': 'ang@stanford.edu',
                    'webpage': 'https://www.andrewng.org/',
                    'research_summary': 'Deep learning, ML education.',
                    'fit_score': 9.2,
                    'position_status': 'open',
                    'outreach_status': 'not_contacted',
                    'created_at': '2025-11-01T10:00:00Z'
                },
                'message': 'Faculty member added successfully'
            }
    """
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.add_faculty(user_id, payload.model_dump())
    return _response(faculty, "Faculty member added successfully")


add_shortlist_faculty = FunctionTool(add_shortlist_faculty)


async def list_shortlist(
    payload: ShortlistListToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """List the user's shortlisted faculty members, with optional filtering.

    Use this to show the user their current shortlist, or to find faculty
    members at a particular stage of outreach or with a specific position status.

    Args:
        payload: Optional filters (both default to None, meaning no filter):
            'position_status': str | None — filter by position availability
                (e.g. 'open', 'unknown', 'closed').
            'outreach_status': str | None — filter by contact stage
                (e.g. 'not_contacted', 'email_sent', 'replied', 'interested').
            Only one filter is applied at a time; position_status takes priority.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': list[dict] — list of shortlist entries, each with the same
                shape as the entry returned by add_shortlist_faculty, ordered
                by fit_score descending.
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': [
                    {
                        'id': 'fac_xyz789',
                        'name': 'Prof. Andrew Ng',
                        'university': 'Stanford University',
                        'department': 'Computer Science',
                        'fit_score': 9.2,
                        'position_status': 'open',
                        'outreach_status': 'not_contacted'
                    }
                ],
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    faculty_list = await ShortlistService.list_shortlist(
        user_id=user_id,
        position_status=payload.position_status,
        outreach_status=payload.outreach_status,
    )
    return _response(faculty_list)


list_shortlist = FunctionTool(list_shortlist)


async def get_shortlist_faculty(faculty_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Retrieve a single shortlisted faculty member by their ID.

    Use this to read the full details of a specific entry before displaying
    them to the user or deciding what to update.

    Args:
        faculty_id: str — the unique ID of the shortlist entry
            (from the 'id' field returned by add_shortlist_faculty or list_shortlist).

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full shortlist entry (same shape as
                add_shortlist_faculty's return value).
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'fac_xyz789',
                    'name': 'Prof. Andrew Ng',
                    'university': 'Stanford University',
                    'department': 'Computer Science',
                    'email': 'ang@stanford.edu',
                    'webpage': 'https://www.andrewng.org/',
                    'research_summary': 'Deep learning, ML education.',
                    'fit_score': 9.2,
                    'position_status': 'open',
                    'outreach_status': 'not_contacted',
                    'created_at': '2025-11-01T10:00:00Z'
                },
                'message': ''
            }

    Raises:
        ValueError: If no shortlist entry with that ID exists for this user.
    """
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.get_faculty(user_id, faculty_id)
    return _response(faculty)


async def update_shortlist_faculty(
    faculty_id: str, payload: FacultyUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update fields on a shortlisted faculty member.

    Use this to correct or enrich existing information — such as adding an
    email address found during research, revising the fit score after reading
    a paper, or updating position_status after checking the lab's website.
    Pass only the fields that should change.

    Args:
        faculty_id: str — the unique ID of the shortlist entry to update.
        payload: Fields to update. All fields are optional:
            'name': str — updated full name.
            'university': str — updated institution.
            'department': str — updated department.
            'email': str — updated contact email.
            'webpage': str — updated webpage URL.
            'research_summary': str — updated research summary.
            'fit_score': float — updated fit score (0.0–10.0).
            'position_status': str — updated position status
                (e.g. 'open', 'unknown', 'closed').
            'outreach_status': str — updated outreach status.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full updated shortlist entry.
            'message': str — 'Faculty member updated successfully'.

    Raises:
        ValueError: If the shortlist entry is not found.
    """
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.update_faculty(
        user_id, faculty_id, payload.model_dump(exclude_unset=True)
    )
    return _response(faculty, "Faculty member updated successfully")


update_shortlist_faculty = FunctionTool(update_shortlist_faculty)


async def update_shortlist_outreach_status(
    faculty_id: str, payload: OutreachStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Record a change in outreach stage for a shortlisted faculty member.

    Use this whenever a contact event occurs — email sent, reply received,
    meeting booked — to keep the shortlist's outreach trail current. This is
    a dedicated tool because outreach stage changes are frequent, user-visible
    actions that benefit from a clear, named operation.

    Typical status progression:
        'not_contacted' → 'email_sent' → 'replied' → 'interested' | 'declined'

    Args:
        faculty_id: str — the unique ID of the shortlist entry to update.
        payload:
            'status': str — the new outreach status value.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Outreach status updated successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Outreach status updated successfully'
            }

    Raises:
        ValueError: If the shortlist entry is not found.
    """
    user_id = require_user_id(tool_context)
    await ShortlistService.update_outreach_status(user_id, faculty_id, payload.status)
    return _response({"status": "success"}, "Outreach status updated successfully")


update_shortlist_outreach_status = FunctionTool(update_shortlist_outreach_status)


async def delete_shortlist_faculty(faculty_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Remove a faculty member from the user's shortlist.

    Use this when the user decides a faculty member is no longer a viable
    target — for example, because their lab is closed, their research no
    longer fits, or the user has chosen to deprioritise them.

    Args:
        faculty_id: str — the unique ID of the shortlist entry to delete.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Faculty member deleted successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Faculty member deleted successfully'
            }

    Raises:
        ValueError: If the shortlist entry is not found.
    """
    user_id = require_user_id(tool_context)
    await ShortlistService.delete_faculty(user_id, faculty_id)
    return _response({"status": "success"}, "Faculty member deleted successfully")


async def get_shortlist_stats(tool_context: ToolContext) -> dict[str, object]:
    """Retrieve summary statistics for the user's shortlist.

    Use this to give the user a quick progress overview — how many faculty
    are on the list, how many positions are known to be open, and how many
    have been contacted.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict containing:
                'total': int — total number of shortlisted faculty.
                'open_positions': int — entries whose position_status is 'open'.
                'contacted': int — entries whose outreach_status is 'email_sent'.
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': {
                    'total': 12,
                    'open_positions': 4,
                    'contacted': 7
                },
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    stats = await ShortlistService.get_stats(user_id)
    return _response(stats)


# ── Tracker ───────────────────────────────────────────────────────────────────


async def create_application(
    payload: ApplicationCreateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Add a graduate programme to the user's application tracker.

    Use this when the user decides to formally track an application — typically
    after shortlisting a faculty member and identifying a target programme.

    Args:
        payload: Application details:
            'university': str — full institution name (e.g. 'MIT').
            'program': str — programme name (e.g. 'PhD Computer Science').
            'department': str — department (e.g. 'EECS').
            'deadline': datetime | None — application deadline, if known.
            'status': str — initial tracking status. Default 'tracking'.
                Valid values: 'tracking', 'draft', 'submitted', 'accepted', 'rejected'.
            'sop_status': str — SOP writing progress. Default 'not_started'.
                Valid values: 'not_started', 'in_progress', 'ready'.
            'cv_status': str — CV preparation progress. Default 'not_started'.
                Valid values: 'not_started', 'in_progress', 'ready'.
            'recommenders': list[dict] — initial recommender list, each with
                'name' (str) and 'status' (str, default 'not_asked').
            'funded': str — funding situation. Default 'unknown'.
                Valid values: 'unknown', 'applied', 'granted', 'no'.
            'notes': str | None — free-text notes.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the newly created tracker entry, including:
                'id': str — generated ID for this application.
                All input fields plus 'created_at': str (ISO timestamp).
            'message': str — 'Application program created successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'app_abc001',
                    'university': 'MIT',
                    'program': 'PhD Computer Science',
                    'department': 'EECS',
                    'deadline': '2025-12-15T00:00:00Z',
                    'status': 'tracking',
                    'sop_status': 'not_started',
                    'cv_status': 'not_started',
                    'recommenders': [],
                    'funded': 'unknown',
                    'notes': None,
                    'created_at': '2025-11-01T10:00:00Z'
                },
                'message': 'Application program created successfully'
            }
    """
    user_id = require_user_id(tool_context)
    application = await TrackerService.create_application(user_id, payload.model_dump())
    return _response(application, "Application program created successfully")


create_application = FunctionTool(create_application)


async def list_applications(tool_context: ToolContext) -> dict[str, object]:
    """List all applications in the user's tracker, ordered by deadline.

    Use this to give the user an overview of every programme they are
    tracking, surface upcoming deadlines, or identify applications that
    need attention.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': list[dict] — all tracker entries for this user, ordered
                by 'deadline' ascending (null deadlines last). Each entry
                has the same shape as create_application's return value.
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': [
                    {
                        'id': 'app_abc001',
                        'university': 'MIT',
                        'program': 'PhD Computer Science',
                        'deadline': '2025-12-15T00:00:00Z',
                        'status': 'tracking',
                        'sop_status': 'in_progress',
                        'cv_status': 'ready',
                        'funded': 'unknown'
                    }
                ],
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    applications = await TrackerService.list_applications(user_id)
    return _response(applications)


async def get_application(application_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Retrieve a single application tracker entry by its ID.

    Use this to read the full details of a specific application before
    updating it or generating content for it.

    Args:
        application_id: str — the unique ID of the tracker entry
            (from the 'id' field returned by create_application or list_applications).

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full tracker entry (same shape as
                create_application's return value).
            'message': str — empty string.

    Raises:
        ValueError: If no application with that ID exists for this user.
    """
    user_id = require_user_id(tool_context)
    application = await TrackerService.get_application(user_id, application_id)
    return _response(application)


async def update_application(
    application_id: str, payload: ApplicationUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update one or more fields on an application tracker entry.

    This is the single tool for all application field updates — status,
    SOP progress, CV progress, funding status, deadline corrections, and
    notes. Pass only the fields that should change; omit the rest.

    Args:
        application_id: str — the unique ID of the tracker entry to update.
        payload: Fields to update. All fields are optional:
            'university': str — updated institution name.
            'program': str — updated programme name.
            'department': str — updated department.
            'deadline': datetime — updated application deadline.
            'status': str — updated overall status
                (e.g. 'tracking', 'draft', 'submitted', 'accepted', 'rejected').
            'sop_status': str — updated SOP progress
                (e.g. 'not_started', 'in_progress', 'ready').
            'cv_status': str — updated CV progress
                (e.g. 'not_started', 'in_progress', 'ready').
            'funded': str — updated funding status
                (e.g. 'unknown', 'applied', 'granted', 'no').
            'notes': str — updated free-text notes.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full updated tracker entry.
            'message': str — 'Application program updated successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'app_abc001',
                    'university': 'MIT',
                    'program': 'PhD Computer Science',
                    'status': 'submitted',
                    'sop_status': 'ready',
                    'cv_status': 'ready',
                    'funded': 'applied'
                },
                'message': 'Application program updated successfully'
            }

    Raises:
        ValueError: If the application is not found.
    """
    user_id = require_user_id(tool_context)
    application = await TrackerService.update_application(
        user_id, application_id, payload.model_dump(exclude_unset=True)
    )
    return _response(application, "Application program updated successfully")


update_application = FunctionTool(update_application)


async def add_application_recommender(
    application_id: str, payload: RecommenderAddToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Add a recommender to an application's letter-of-recommendation list.

    Use this when the user identifies someone they intend to ask for a
    reference letter. The recommender starts with a status of 'not_asked'
    unless specified otherwise.

    Args:
        application_id: str — the unique ID of the tracker entry.
        payload:
            'name': str — recommender's full name
                (e.g. 'Prof. Jane Smith').
            'status': str — current status of this recommendation request.
                Default 'not_asked'.
                Valid values: 'not_asked', 'asked', 'confirmed', 'submitted'.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Recommender added successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Recommender added successfully'
            }
    """
    user_id = require_user_id(tool_context)
    recommender = {"name": payload.name, "status": payload.status, "email": payload.email or ""}
    await TrackerService.add_recommender(user_id, application_id, recommender)
    return _response({"status": "success"}, "Recommender added successfully")


add_application_recommender = FunctionTool(add_application_recommender)


async def update_application_recommender_status(
    application_id: str, recommender_name: str, payload: RecommenderStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update the letter status of a specific recommender on an application.

    Use this when the user reports a change in a recommender's progress —
    for example, after asking them, receiving confirmation, or the letter
    being submitted.

    Typical status progression:
        'not_asked' → 'asked' → 'confirmed' → 'submitted'

    Args:
        application_id: str — the unique ID of the tracker entry.
        recommender_name: str — the exact name of the recommender as stored
            in the application's recommenders list.
        payload:
            'status': str — the new recommender status.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Recommender status updated successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Recommender status updated successfully'
            }

    Raises:
        ValueError: If the application is not found.
    """
    user_id = require_user_id(tool_context)
    await TrackerService.update_recommender_status(
        user_id, application_id, recommender_name, payload.status
    )
    return _response({"status": "success"}, "Recommender status updated successfully")


update_application_recommender_status = FunctionTool(update_application_recommender_status)


async def delete_application(application_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Remove an application from the user's tracker.

    Use this when the user decides to stop tracking a programme — for
    example, after a rejection, a withdrawal, or a change in plans.

    Args:
        application_id: str — the unique ID of the tracker entry to delete.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Application program deleted successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Application program deleted successfully'
            }

    Raises:
        ValueError: If the application is not found.
    """
    user_id = require_user_id(tool_context)
    await TrackerService.delete_application(user_id, application_id)
    return _response({"status": "success"}, "Application program deleted successfully")


async def get_tracker_stats(tool_context: ToolContext) -> dict[str, object]:
    """Retrieve summary statistics for the user's application tracker.

    Use this to give the user a high-level progress snapshot — how many
    programmes are tracked, how many SOPs are ready, how many funded
    programmes are in play, and how many recommendation letters have been
    confirmed.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict containing:
                'total': int — total number of tracked applications.
                'sop_ready': int — applications whose sop_status is 'ready'.
                'funded_programs': int — applications whose funded is 'granted'.
                'recs_confirmed': int — total individual recommender entries
                    whose status is 'confirmed' or 'submitted' across all apps.
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': {
                    'total': 8,
                    'sop_ready': 3,
                    'funded_programs': 2,
                    'recs_confirmed': 5
                },
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    stats = await TrackerService.get_stats(user_id)
    return _response(stats)


# ── Drafts ────────────────────────────────────────────────────────────────────


async def create_draft(payload: DraftCreateToolRequest, tool_context: ToolContext) -> dict[str, object]:
    """Create a new writing draft for the user.

    Use this to start a new SOP, personal statement, outreach email, or any
    other application document. The draft begins in 'draft' status.

    Args:
        payload: Draft metadata and content:
            'type': str — document category
                (e.g. 'sop', 'personal_statement', 'outreach_email', 'cover_letter').
            'title': str — human-readable title
                (e.g. 'MIT PhD SOP — Draft 1').
            'content': str — initial body text (may be empty). Default ''.
            'ai_generated': bool — whether this content was AI-generated. Default False.
            'source_tags': list[str] — labels for source materials referenced
                (e.g. ['faculty_profile', 'research_paper']). Default [].
            'linked_faculty_id': str | None — ID of a shortlisted faculty
                this draft is written for.
            'linked_application_id': str | None — ID of a tracker application
                this draft belongs to.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the newly created draft, including:
                'id': str — generated ID for this draft.
                All input fields, plus:
                'status': str — 'draft' (initial status).
                'word_count': int — number of words in 'content'.
                'created_at': str — ISO timestamp.
            'message': str — 'Draft created successfully'.

        Example:
            {
                'success': True,
                'data': {
                    'id': 'drft_001',
                    'type': 'sop',
                    'title': 'MIT PhD SOP — Draft 1',
                    'content': 'My research journey began...',
                    'status': 'draft',
                    'word_count': 4,
                    'ai_generated': False,
                    'source_tags': [],
                    'linked_faculty_id': 'fac_xyz789',
                    'linked_application_id': 'app_abc001',
                    'created_at': '2025-11-01T10:00:00Z'
                },
                'message': 'Draft created successfully'
            }
    """
    user_id = require_user_id(tool_context)
    draft = await DraftsService.create_draft(user_id, payload.model_dump())
    return _response(draft, "Draft created successfully")


create_draft = FunctionTool(create_draft)


async def list_drafts(payload: DraftListToolRequest, tool_context: ToolContext) -> dict[str, object]:
    """List the user's writing drafts, with optional filtering by type or status.

    Use this to show the user their drafts, or to find all SOPs, all approved
    documents, or all drafts linked to a particular application.

    Args:
        payload: Optional filters (both default to None, meaning no filter):
            'type': str | None — return only drafts of this type
                (e.g. 'sop', 'outreach_email').
            'status': str | None — return only drafts with this status
                (e.g. 'draft', 'in_review', 'approved').

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': list[dict] — matching drafts, each with the same shape as
                create_draft's return value but without the full 'content'
                field (use get_draft to retrieve full content).
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': [
                    {
                        'id': 'drft_001',
                        'type': 'sop',
                        'title': 'MIT PhD SOP — Draft 1',
                        'status': 'draft',
                        'word_count': 542,
                        'created_at': '2025-11-01T10:00:00Z'
                    }
                ],
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    drafts = await DraftsService.list_drafts(user_id, payload.type, payload.status)
    return _response(drafts)


list_drafts = FunctionTool(list_drafts)


async def get_draft(draft_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Retrieve a single draft by its ID, including the full body content.

    Use this before editing a draft, reviewing it with the user, or
    generating a revision — list_drafts omits the full content for brevity.

    Args:
        draft_id: str — the unique ID of the draft
            (from the 'id' field returned by create_draft or list_drafts).

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full draft including 'content'
                (same shape as create_draft's return value).
            'message': str — empty string.

    Raises:
        ValueError: If no draft with that ID exists for this user.
    """
    user_id = require_user_id(tool_context)
    draft = await DraftsService.get_draft(user_id, draft_id)
    return _response(draft)


async def update_draft_content(
    draft_id: str, payload: ContentUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Replace the body text of a draft.

    Use this after writing or revising a draft's text. The word count is
    recalculated automatically. The full updated draft is returned so the
    agent can confirm the new word count to the user.

    Args:
        draft_id: str — the unique ID of the draft to update.
        payload:
            'content': str — the complete new body text. This fully
                replaces the existing content; it is not appended.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the full updated draft, including the new
                'content' and recalculated 'word_count'.
            'message': str — 'Draft content updated successfully'.

    Raises:
        ValueError: If the draft is not found.
    """
    user_id = require_user_id(tool_context)
    draft = await DraftsService.update_content(user_id, draft_id, payload.content)
    return _response(draft, "Draft content updated successfully")


update_draft_content = FunctionTool(update_draft_content)


async def update_draft_status(
    draft_id: str, payload: DraftStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Advance the workflow status of a draft.

    Use this when the user finishes writing (→ 'in_review'), after feedback
    is incorporated (→ 'approved'), or if a draft is abandoned (→ 'archived').

    Typical status progression:
        'draft' → 'in_review' → 'approved' | 'archived'

    Args:
        draft_id: str — the unique ID of the draft to update.
        payload:
            'status': str — the new workflow status.
                Valid values: 'draft', 'in_review', 'approved', 'archived'.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Draft status updated successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Draft status updated successfully'
            }

    Raises:
        ValueError: If the draft is not found.
    """
    user_id = require_user_id(tool_context)
    await DraftsService.update_status(user_id, draft_id, payload.status)
    return _response({"status": "success"}, "Draft status updated successfully")


update_draft_status = FunctionTool(update_draft_status)


async def delete_draft(draft_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Permanently delete a draft.

    Use this when the user discards a draft entirely. Prefer update_draft_status
    with 'archived' if there is any chance the user may want to revisit it.

    Args:
        draft_id: str — the unique ID of the draft to delete.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — {'status': 'success'}.
            'message': str — 'Draft deleted successfully'.

        Example:
            {
                'success': True,
                'data': {'status': 'success'},
                'message': 'Draft deleted successfully'
            }

    Raises:
        ValueError: If the draft is not found.
    """
    user_id = require_user_id(tool_context)
    await DraftsService.delete_draft(user_id, draft_id)
    return _response({"status": "success"}, "Draft deleted successfully")


async def get_draft_stats(tool_context: ToolContext) -> dict[str, object]:
    """Retrieve summary statistics for the user's drafts.

    Use this to give the user a quick overview of their writing progress
    across all documents.

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict containing:
                'total': int — total number of drafts.
                'approved': int — drafts whose status is 'approved'.
                'need_review': int — drafts whose status is 'in_review'.
            'message': str — empty string.

        Example:
            {
                'success': True,
                'data': {
                    'total': 6,
                    'approved': 2,
                    'need_review': 1
                },
                'message': ''
            }
    """
    user_id = require_user_id(tool_context)
    stats = await DraftsService.get_stats(user_id)
    return _response(stats)


# ── HITL ──────────────────────────────────────────────────────────────────────


async def get_pending_hitl(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Check whether there is an open human-approval request for the current session.

    Use this at the start of a turn to determine whether the agent was
    resumed after a HITL gate, and to retrieve the human's decision before
    continuing.

    Args:
        session_id: str — the current ADK session ID
            (available via tool_context.session.id).

    Returns:
        A dict with keys:
            'success': bool — True on success.
            'data': dict — the pending HITL record if one exists, otherwise
                an empty dict. When a record exists, expected keys include:
                'id': str — the HITL record ID.
                'kind': str — 'approval', 'choice', or 'input'.
                'status': str — 'pending', 'approved', or 'rejected'.
                'decision': str | None — the human's decision, once resolved.
                'response': dict | None — structured input supplied by the human
                    (for kind='input').
                'title': str — title shown to the human.
                'description': str — description shown to the human.
            'message': str — empty string.

        Example (approved):
            {
                'success': True,
                'data': {
                    'id': 'hitl_001',
                    'kind': 'approval',
                    'status': 'approved',
                    'decision': 'approved',
                    'response': None,
                    'title': 'Add Prof. Ng to shortlist?',
                    'description': 'Fit score 9.2, open position confirmed.'
                },
                'message': ''
            }

        Example (no pending gate):
            {'success': True, 'data': {}, 'message': ''}
    """
    user_id = require_user_id(tool_context)
    hitl = await HITLService.get_pending_hitl(user_id, session_id)
    return _response(hitl or {})


async def request_hitl(
    kind: str,
    title: str,
    description: str,
    tool_context: ToolContext,
    options_json: str = "",
    input_schema_json: str = "",
    payload_json: str = "",
    expires_in_seconds: int = 0,
) -> dict[str, object]:
    """Pause the current agent turn and request a decision from the human.

    Use this before any irreversible action (create, update, delete) when the
    APPROVAL POLICY requires it. The tool suspends the agent's turn; execution
    does not continue until the human responds via the UI. Do not resolve the
    gate yourself — always wait for the human.

    Choose 'kind' based on what you need from the human:
        - 'approval': yes/no confirmation before an action.
        - 'choice': selection from a named list of options.
        - 'input': structured free-text or form input.

    Args:
        kind: str — type of gate: 'approval', 'choice', or 'input'.
        title: str — short headline shown to the human
            (e.g. 'Add Prof. Ng to shortlist?').
        description: str — full explanation of what the human is deciding,
            including any relevant proposed values the human should review.
        options_json: str — required for kind 'approval' and 'choice'.
            A JSON array of option objects, each with:
                'id': str — machine identifier returned when selected.
                'label': str — human-readable label.
            Example: '[{"id":"yes","label":"Approve"},{"id":"no","label":"Reject"}]'
        input_schema_json: str — required for kind 'input'.
            A JSON object schema with a 'properties' map describing expected fields.
            Example: '{"properties":{"edits":{"type":"string","description":"Your edits"}}}'
        payload_json: str — optional JSON object with additional context to
            display to the human alongside the title and description.
            Example: '{"proposed_fit_score": 9.2, "university": "MIT"}'
        expires_in_seconds: int — optional expiry window in seconds.
            0 means no expiry.

    Returns:
        A dict indicating the gate was successfully created and is now pending:
            'status': str — always 'pending'.
            'hitl_id': str — ID of the created HITL record (for reference).
            'message': str — 'Awaiting human response'.

        Example:
            {
                'status': 'pending',
                'hitl_id': 'hitl_001',
                'message': 'Awaiting human response'
            }

    Raises:
        ValueError: If options are missing for kind 'approval'/'choice', or
            input_schema is missing for kind 'input', or any JSON argument
            is malformed.
    """
    user_id = require_user_id(tool_context)
    session_id = tool_context.session.id
    run_id = str(tool_context.state.get("current_run_id") or "")
    tool_call_id = tool_context.function_call_id

    def _parse(label: str, raw: str):
        if not raw or not raw.strip():
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{label} must be valid JSON: {exc}") from exc

    options = _parse("options_json", options_json)
    input_schema = _parse("input_schema_json", input_schema_json)
    payload = _parse("payload_json", payload_json) or {}

    if kind in {"choice", "approval"} and not options:
        raise ValueError(f"options are required for kind={kind}")
    if kind == "input" and not input_schema:
        raise ValueError("input_schema is required for kind=input")

    hitl = await HITLService.create_hitl(
        user_id=user_id,
        session_id=session_id,
        run_id=run_id,
        kind=kind,
        title=title,
        description=description,
        payload=payload,
        tool_call_id=tool_call_id,
        options=options,
        input_schema=input_schema,
        expires_in_seconds=expires_in_seconds or None,
    )
    return {
        "status": "pending",
        "hitl_id": hitl["id"],
        "message": "Awaiting human response",
    }


REQUEST_HITL_TOOL = LongRunningFunctionTool(request_hitl)


# ── Emails (Gmail) ──────────────────────────────────────────────────────────────


async def create_email(payload: EmailCreateToolRequest, tool_context: ToolContext) -> dict[str, object]:
    """Draft an email (faculty outreach or recommender request) for the user to review.

    Creates the email in 'draft' status — it is NOT sent. Always gate sending
    behind human approval: draft here, request_hitl to let the human review and
    edit the body in the canvas, then call send_email only after approval.

    Args:
        payload:
            'to': str — recipient email address.
            'subject': str — subject line.
            'body_markdown': str — body in markdown (the human edits this).
            'kind': str — 'faculty' (cold outreach) or 'recommender' (LoR request).
            'ref_id': str | None — faculty id, or recommender name for kind='recommender'.
            'linked_application_id': str | None — application this relates to.

    Returns:
        {'success': True, 'data': <email incl. 'id'>, 'message': 'Email draft created'}
    """
    user_id = require_user_id(tool_context)
    email = await EmailsService.create_email(user_id, payload.model_dump())
    return _response(email, "Email draft created")


create_email = FunctionTool(create_email)


async def list_emails(tool_context: ToolContext) -> dict[str, object]:
    """List the user's email drafts and sent emails (newest first).

    Returns:
        {'success': True, 'data': [<email>...], 'message': ''}
    """
    user_id = require_user_id(tool_context)
    emails = await EmailsService.list_emails(user_id)
    return _response(emails)


list_emails = FunctionTool(list_emails)


async def send_email(email_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Send a previously-drafted email via the user's connected Gmail.

    Only call this AFTER the human has approved the draft via request_hitl.
    Marks the email 'sent' and bumps the linked recommender/faculty status.

    Args:
        email_id: str — the id returned by create_email.

    Returns:
        {'success': True, 'data': <sent email>, 'message': 'Email sent'}

    Raises:
        ValueError: if the email is missing, has no recipient, or the user has
            not connected their Google account.
    """
    user_id = require_user_id(tool_context)
    email = await EmailsService.send_email(user_id, email_id)
    return _response(email, "Email sent")


send_email = FunctionTool(send_email)


# ── Ingestion ───────────────────────────────────────────────────────────────
async def check_url(url: str) -> dict:
    """
    Check if a URL has already been indexed in ES.
    Call this before ingest_url to avoid re-scraping.

    Args:
        url: The URL to check.

    Returns:
        Dict with 'indexed' bool and 'chunks' count if found.
    """
    check_url = await IngestionService.check_url_indexed(url)
    return _response(check_url, "URL checked successfully")


async def ingest_url(url: str, url_type: str, tool_context: ToolContext) -> dict:
    """
    Scrape a URL and index its content into Elasticsearch.
    Use this when the student provides a new program or faculty URL
    that isn't already in the database.

    Args:
        url: The program or faculty directory URL to scrape.
            e.g. "https://oge.mit.edu/programs/eecs/"
        url_type: "program" for grad program pages,
            "faculty" for faculty directory pages.

    Returns:
        Dict with status, chunks_indexed, and a summary of what was found.
    """
    user_id = require_user_id(tool_context)
    result = await IngestionService.ingest_url_background(url, url_type, user_id)
    return _response(result, "Ingestion started in background")


async def check_ingestion_status(job_id: str, tool_context: ToolContext) -> dict:
    """
    Check the status of a background ingestion job.

    Args:
        user_id: The user's ID
        job_id: The job ID returned by ingest_url

    Returns:
        Dict with status: "running", "complete", or "failed"
    """
    user_id = require_user_id(tool_context)
    result = await IngestionService.get_ingestion_status(user_id, job_id)
    return _response(result, "Status retrieved")

check_url = FunctionTool(check_url)
ingest_url = FunctionTool(ingest_url)
check_ingestion_status = FunctionTool(check_ingestion_status)

# ── Hybrid Search ───────────────────────────────────────────────────────────────
_SEARCH_UNAVAILABLE_MESSAGE = (
    "The search service is temporarily unavailable due to an internal issue. "
    "Apologize briefly, suggest the user try again later, and do not retry, "
    "speculate about, or disclose any technical cause."
)


async def _hybrid_search(index: str, query: str, success_message: str) -> dict:
    """Run a hybrid (text + kNN) search against an Elasticsearch index.

    All failure modes are logged in full server-side and collapsed into a
    sanitized error payload for the model — raw Elasticsearch errors must
    never reach the LLM context.
    """
    if embed_fn is None:
        logger.error("Hybrid search on %s unavailable: embedding function not initialized", index)
        return _tool_error("SEARCH_UNAVAILABLE", _SEARCH_UNAVAILABLE_MESSAGE)

    try:
        query_vector = embed_fn([query])[0]
    except Exception:
        logger.exception("Hybrid search on %s failed: could not embed query", index)
        return _tool_error("SEARCH_UNAVAILABLE", _SEARCH_UNAVAILABLE_MESSAGE)

    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.ES_URL}/{index}/_search",
                headers={
                    "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": {"match": {"text": query}},
                    "knn": {
                        "field": "embedding",
                        "query_vector": query_vector,
                        "num_candidates": 20,
                        "k": 5,
                    },
                },
            )
    except httpx.HTTPError:
        logger.exception("Hybrid search request to %s failed", index)
        return _tool_error("SEARCH_UNAVAILABLE", _SEARCH_UNAVAILABLE_MESSAGE)

    if response.status_code != 200:
        logger.error(
            "Hybrid search on %s returned %s: %s", index, response.status_code, response.text
        )
        return _tool_error("SEARCH_UNAVAILABLE", _SEARCH_UNAVAILABLE_MESSAGE)

    return _response(response.json(), success_message)


async def hybrid_faculty_search(research_query: str, tool_context: ToolContext) -> dict:
    return await _hybrid_search(
        "faculty-profiles", research_query, "Faculty search completed successfully"
    )


async def hybrid_program_search(program_query: str, tool_context: ToolContext) -> dict:
    return await _hybrid_search(
        "grad-programs", program_query, "Program search completed successfully"
    )

hybrid_faculty_search = FunctionTool(hybrid_faculty_search)
hybrid_program_search = FunctionTool(hybrid_program_search)


# ── Faculty deep dive helpers ──────────────────────────────────────────
async def get_faculty_papers(faculty_name: str, limit: int = 5) -> dict:
    """
    Fetch recent papers and publications for a specific faculty member.
    Use this whenever you need details on a professor's real-world publication history.

    Args:
        faculty_name: Full name of the faculty member.
        limit: Max number of papers to retrieve (default is 5).
    """
    papers = await FacultyService.get_faculty_papers(faculty_name, limit)
    return _response(papers, "Papers fetched successfully")


async def score_faculty_fit(
    faculty_name: str, 
    research_areas: str, 
    tool_context: ToolContext,
    bio: str = "", 
    papers_summary: str = ""
) -> dict:
    """
    Scores how well a faculty member fits the currently authenticated student's profile.
    Calculates a match score and analyzes contextual alignments.

    Args:
        faculty_name: Full name of the faculty member.
        research_areas: Faculty's research areas as a comma-separated string.
        bio: Optional brief summary biography of the faculty member.
        papers_summary: Optional summary list of recent papers.
    """
    user_id = require_user_id(tool_context)
    result = await FacultyService.score_faculty_fit(
        faculty_name=faculty_name,
        research_areas=research_areas,
        user_id=user_id,
        bio=bio,
        papers_summary=papers_summary
    )
    return _response(result, "Fit evaluation scoring completed")


async def get_conversation_angles(
    faculty_name: str, 
    research_areas: str, 
    tool_context: ToolContext,
    paper_titles: str = ""
) -> dict:
    """
    Generates personalized, specific cold outreach conversation starters 
    tailored directly to the student's background and the professor's verified papers.

    Args:
        faculty_name: Full name of the faculty member.
        research_areas: Faculty's core research tracks.
        paper_titles: Comma-separated list of recent paper titles.
    """
    user_id = require_user_id(tool_context)
    result = await FacultyService.get_conversation_angles(
        faculty_name=faculty_name,
        research_areas=research_areas,
        user_id=user_id,
        paper_titles=paper_titles
    )
    return _response(result, "Conversation starters generated successfully")

get_faculty_papers = FunctionTool(get_faculty_papers)
score_faculty_fit = FunctionTool(score_faculty_fit)
get_conversation_angles = FunctionTool(get_conversation_angles)

# ── Tool groups ───────────────────────────────────────────────────────────────

ACCOUNT_TOOLS = [
    get_profile,
    update_profile,
    get_preferences,
    update_preferences,
]

SHORTLIST_TOOLS = [
    add_shortlist_faculty,
    list_shortlist,
    get_shortlist_faculty,
    update_shortlist_faculty,
    update_shortlist_outreach_status,
    delete_shortlist_faculty,
    get_shortlist_stats,
]

TRACKER_TOOLS = [
    create_application,
    list_applications,
    get_application,
    update_application,
    add_application_recommender,
    update_application_recommender_status,
    delete_application,
    get_tracker_stats,
]

DRAFT_TOOLS = [
    create_draft,
    list_drafts,
    get_draft,
    update_draft_content,
    update_draft_status,
    delete_draft,
    get_draft_stats,
]

EMAIL_TOOLS = [
    create_email,
    list_emails,
    send_email,
]

SCRAPER_TOOLS = [
    check_url,
    ingest_url,
    check_ingestion_status
]

HYBRID_SEARCH_TOOLS = [
    hybrid_faculty_search,
    hybrid_program_search
]

FACULTY_DEEP_DIVE_TOOLS = [
    get_faculty_papers, score_faculty_fit, get_conversation_angles
]

GOVERNANCE_TOOLS = [get_pending_hitl, REQUEST_HITL_TOOL]

APPLICATION_TOOLS = SHORTLIST_TOOLS + TRACKER_TOOLS + DRAFT_TOOLS + EMAIL_TOOLS + SCRAPER_TOOLS + HYBRID_SEARCH_TOOLS
OPERATIONS_TOOLS = ACCOUNT_TOOLS + APPLICATION_TOOLS + GOVERNANCE_TOOLS
