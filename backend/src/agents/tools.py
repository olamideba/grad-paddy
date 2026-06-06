import json

from google.adk.tools import FunctionTool, LongRunningFunctionTool, ToolContext

from src.agents.context import require_user_id
from src.agents.schemas import (
    ApplicationCreateToolRequest,
    ApplicationCvStatusToolRequest,
    ApplicationFundedToolRequest,
    ApplicationSopStatusToolRequest,
    ApplicationStatusToolRequest,
    ApplicationUpdateToolRequest,
    ContentUpdateToolRequest,
    DraftCreateToolRequest,
    DraftListToolRequest,
    DraftStatusToolRequest,
    FacultyCreateToolRequest,
    FacultyUpdateToolRequest,
    OutreachStatusToolRequest,
    PreferencesUpsertToolRequest,
    ProfileUpdateToolRequest,
    RecommenderAddToolRequest,
    RecommenderStatusToolRequest,
    ShortlistListToolRequest,
)
from src.services.drafts_service import DraftsService
from src.services.groups_service import GroupService
from src.services.hitl_service import HITLService
from src.services.sessions_service import SessionService
from src.services.shortlist_service import ShortlistService
from src.services.tracker_service import TrackerService
from src.services.users_service import UserService


def _response(data: object, message: str = "") -> dict[str, object]:
    return {"success": True, "data": data, "message": message}



# ── Users and preferences ────────────────────────────────────────────────────


async def get_profile(tool_context: ToolContext) -> dict[str, object]:
    """Fetch the current user's profile."""
    user_id = require_user_id(tool_context)
    profile = await UserService.get_profile(user_id)
    return _response(profile)


async def update_profile(
    payload: ProfileUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update the current user's profile."""
    user_id = require_user_id(tool_context)
    profile = await UserService.update_profile(user_id, payload.model_dump(exclude_unset=True))
    return _response(profile, "Profile updated successfully")


update_profile = FunctionTool(update_profile)


async def get_preferences(tool_context: ToolContext) -> dict[str, object]:
    """Fetch the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.get_preferences(user_id)
    return _response(preferences or {})


async def upsert_preferences(
    payload: PreferencesUpsertToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Create or replace the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.upsert_preferences(user_id, payload.model_dump())
    return _response(preferences, "Preferences updated successfully")


upsert_preferences = FunctionTool(upsert_preferences)


async def append_research_interest(interest: str, tool_context: ToolContext) -> dict[str, object]:
    """Append a research interest to the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.append_research_interest(user_id, interest)
    return _response(preferences, "Research interest appended successfully")


async def remove_research_interest(interest: str, tool_context: ToolContext) -> dict[str, object]:
    """Remove a research interest from the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.remove_research_interest(user_id, interest)
    return _response(preferences, "Research interest removed successfully")


async def append_target_country(country: str, tool_context: ToolContext) -> dict[str, object]:
    """Append a target country to the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.append_target_country(user_id, country)
    return _response(preferences, "Target country appended successfully")


async def remove_target_country(country: str, tool_context: ToolContext) -> dict[str, object]:
    """Remove a target country from the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.remove_target_country(user_id, country)
    return _response(preferences, "Target country removed successfully")


async def append_target_university(university: str, tool_context: ToolContext) -> dict[str, object]:
    """Append a target university to the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.append_target_university(user_id, university)
    return _response(preferences, "Target university appended successfully")


async def remove_target_university(university: str, tool_context: ToolContext) -> dict[str, object]:
    """Remove a target university from the current user's preferences."""
    user_id = require_user_id(tool_context)
    preferences = await UserService.remove_target_university(user_id, university)
    return _response(preferences, "Target university removed successfully")


# ── Sessions and groups ──────────────────────────────────────────────────────


async def create_session(first_message: str, tool_context: ToolContext) -> dict[str, object]:
    """Create a chat session from the first user message."""
    user_id = require_user_id(tool_context)
    session = await SessionService.create_session(user_id, first_message)
    return _response(session, "Session created successfully")


async def list_sessions(tool_context: ToolContext) -> dict[str, object]:
    """List the current user's sessions."""
    user_id = require_user_id(tool_context)
    sessions = await SessionService.list_sessions(user_id)
    return _response(sessions)


async def get_session(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Fetch a single session by id."""
    user_id = require_user_id(tool_context)
    session = await SessionService.get_session(user_id, session_id)
    return _response(session)


async def delete_session(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Delete a session and its messages."""
    user_id = require_user_id(tool_context)
    await SessionService.delete_session(user_id, session_id)
    return _response({"status": "success"}, "Session deleted successfully")


async def rename_session(session_id: str, title: str, tool_context: ToolContext) -> dict[str, object]:
    """Rename a session."""
    user_id = require_user_id(tool_context)
    session = await SessionService.rename_session(user_id, session_id, title)
    return _response(session, "Session renamed")


async def toggle_session_star(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Toggle the starred flag for a session."""
    user_id = require_user_id(tool_context)
    session = await SessionService.toggle_star(user_id, session_id)
    return _response(session, "Session star toggled")


async def set_session_group(session_id: str, group_id: str | None, tool_context: ToolContext) -> dict[str, object]:
    """Assign a session to a group or clear the group assignment."""
    user_id = require_user_id(tool_context)
    session = await SessionService.set_group(user_id, session_id, group_id)
    return _response(session, "Session group updated")


async def list_session_messages(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """List the messages in a session."""
    user_id = require_user_id(tool_context)
    messages = await SessionService.list_messages(user_id, session_id)
    return _response(messages)


async def create_session_message(session_id: str, role: str, content: str, tool_context: ToolContext) -> dict[str, object]:
    """Append a message to an existing session."""
    user_id = require_user_id(tool_context)
    message = await SessionService.create_message(user_id, session_id, role, content)
    return _response(message, "Message created successfully")


async def create_group(name: str, tool_context: ToolContext) -> dict[str, object]:
    """Create a new group."""
    user_id = require_user_id(tool_context)
    group = await GroupService.create_group(user_id, name)
    return _response(group, "Group created")


async def list_groups(tool_context: ToolContext) -> dict[str, object]:
    """List the current user's groups."""
    user_id = require_user_id(tool_context)
    groups = await GroupService.list_groups(user_id)
    return _response(groups)


async def delete_group(group_id: str, delete_sessions: bool, tool_context: ToolContext) -> dict[str, object]:
    """Delete a group and optionally delete the sessions inside it."""
    user_id = require_user_id(tool_context)
    await GroupService.delete_group(user_id, group_id, delete_sessions)
    return _response({"status": "success"}, "Group deleted")


# ── Shortlist ────────────────────────────────────────────────────────────────


async def add_shortlist_faculty(
    payload: FacultyCreateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Add a faculty member to the shortlist."""
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.add_faculty(user_id, payload.model_dump())
    return _response(faculty, "Faculty member added successfully")


add_shortlist_faculty = FunctionTool(add_shortlist_faculty)


async def list_shortlist(
    payload: ShortlistListToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """List shortlist entries with optional filters."""
    user_id = require_user_id(tool_context)
    faculty_list = await ShortlistService.list_shortlist(
        user_id=user_id,
        position_status=payload.position_status,
        outreach_status=payload.outreach_status,
    )
    return _response(faculty_list)


list_shortlist = FunctionTool(list_shortlist)


async def get_shortlist_faculty(faculty_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Fetch a single shortlist entry by id."""
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.get_faculty(user_id, faculty_id)
    return _response(faculty)


async def update_shortlist_faculty(
    faculty_id: str, payload: FacultyUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update a shortlist entry."""
    user_id = require_user_id(tool_context)
    faculty = await ShortlistService.update_faculty(
        user_id, faculty_id, payload.model_dump(exclude_unset=True)
    )
    return _response(faculty, "Faculty member updated successfully")


update_shortlist_faculty = FunctionTool(update_shortlist_faculty)


async def update_shortlist_outreach_status(
    faculty_id: str, payload: OutreachStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update a faculty outreach status."""
    user_id = require_user_id(tool_context)
    await ShortlistService.update_outreach_status(user_id, faculty_id, payload.status)
    return _response({"status": "success"}, "Outreach status updated successfully")


update_shortlist_outreach_status = FunctionTool(update_shortlist_outreach_status)


async def delete_shortlist_faculty(faculty_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Delete a shortlist entry."""
    user_id = require_user_id(tool_context)
    await ShortlistService.delete_faculty(user_id, faculty_id)
    return _response({"status": "success"}, "Faculty member deleted successfully")


async def get_shortlist_stats(tool_context: ToolContext) -> dict[str, object]:
    """Return shortlist stats."""
    user_id = require_user_id(tool_context)
    stats = await ShortlistService.get_stats(user_id)
    return _response(stats)


# ── Tracker ──────────────────────────────────────────────────────────────────


async def create_application(
    payload: ApplicationCreateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Create a new application tracker entry."""
    user_id = require_user_id(tool_context)
    application = await TrackerService.create_application(user_id, payload.model_dump())
    return _response(application, "Application program created successfully")


create_application = FunctionTool(create_application)


async def list_applications(tool_context: ToolContext) -> dict[str, object]:
    """List all tracker entries for the current user."""
    user_id = require_user_id(tool_context)
    applications = await TrackerService.list_applications(user_id)
    return _response(applications)


async def get_application(application_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Fetch a tracker entry by id."""
    user_id = require_user_id(tool_context)
    application = await TrackerService.get_application(user_id, application_id)
    return _response(application)


async def update_application(
    application_id: str, payload: ApplicationUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update a tracker entry."""
    user_id = require_user_id(tool_context)
    application = await TrackerService.update_application(
        user_id, application_id, payload.model_dump(exclude_unset=True)
    )
    return _response(application, "Application program updated successfully")


update_application = FunctionTool(update_application)


async def update_application_status(
    application_id: str, payload: ApplicationStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update application status."""
    user_id = require_user_id(tool_context)
    await TrackerService.update_status(user_id, application_id, payload.status)
    return _response({"status": "success"}, "Status updated successfully")


update_application_status = FunctionTool(update_application_status)


async def update_application_sop_status(
    application_id: str, payload: ApplicationSopStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update SOP status."""
    user_id = require_user_id(tool_context)
    await TrackerService.update_sop_status(user_id, application_id, payload.sop_status)
    return _response({"status": "success"}, "SOP status updated successfully")


update_application_sop_status = FunctionTool(update_application_sop_status)


async def update_application_cv_status(
    application_id: str, payload: ApplicationCvStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update CV status."""
    user_id = require_user_id(tool_context)
    await TrackerService.update_cv_status(user_id, application_id, payload.cv_status)
    return _response({"status": "success"}, "CV status updated successfully")


update_application_cv_status = FunctionTool(update_application_cv_status)


async def update_application_funded(
    application_id: str, payload: ApplicationFundedToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update funding status."""
    user_id = require_user_id(tool_context)
    await TrackerService.update_funded(user_id, application_id, payload.funded)
    return _response({"status": "success"}, "Funded status updated successfully")


update_application_funded = FunctionTool(update_application_funded)


async def add_application_recommender(
    application_id: str, payload: RecommenderAddToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Add a recommender to an application."""
    user_id = require_user_id(tool_context)
    recommender = {"name": payload.name, "status": payload.status}
    await TrackerService.add_recommender(user_id, application_id, recommender)
    return _response({"status": "success"}, "Recommender added successfully")


add_application_recommender = FunctionTool(add_application_recommender)


async def update_application_recommender_status(
    application_id: str, recommender_name: str, payload: RecommenderStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update a specific recommender status."""
    user_id = require_user_id(tool_context)
    await TrackerService.update_recommender_status(
        user_id, application_id, recommender_name, payload.status
    )
    return _response({"status": "success"}, "Recommender status updated successfully")


update_application_recommender_status = FunctionTool(update_application_recommender_status)


async def delete_application(application_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Delete an application tracker entry."""
    user_id = require_user_id(tool_context)
    await TrackerService.delete_application(user_id, application_id)
    return _response({"status": "success"}, "Application program deleted successfully")


async def get_tracker_stats(tool_context: ToolContext) -> dict[str, object]:
    """Return tracker stats."""
    user_id = require_user_id(tool_context)
    stats = await TrackerService.get_stats(user_id)
    return _response(stats)


# ── Drafts ───────────────────────────────────────────────────────────────────


async def create_draft(payload: DraftCreateToolRequest, tool_context: ToolContext) -> dict[str, object]:
    """Create a new draft."""
    user_id = require_user_id(tool_context)
    draft = await DraftsService.create_draft(user_id, payload.model_dump())
    return _response(draft, "Draft created successfully")


create_draft = FunctionTool(create_draft)


async def list_drafts(payload: DraftListToolRequest, tool_context: ToolContext) -> dict[str, object]:
    """List drafts with optional filters."""
    user_id = require_user_id(tool_context)
    drafts = await DraftsService.list_drafts(user_id, payload.type, payload.status)
    return _response(drafts)


list_drafts = FunctionTool(list_drafts)


async def get_draft(draft_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Fetch a draft by id."""
    user_id = require_user_id(tool_context)
    draft = await DraftsService.get_draft(user_id, draft_id)
    return _response(draft)


async def update_draft_content(
    draft_id: str, payload: ContentUpdateToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update draft content."""
    user_id = require_user_id(tool_context)
    draft = await DraftsService.update_content(user_id, draft_id, payload.content)
    return _response(draft, "Draft content updated successfully")


update_draft_content = FunctionTool(update_draft_content)


async def update_draft_status(
    draft_id: str, payload: DraftStatusToolRequest, tool_context: ToolContext
) -> dict[str, object]:
    """Update draft status."""
    user_id = require_user_id(tool_context)
    await DraftsService.update_status(user_id, draft_id, payload.status)
    return _response({"status": "success"}, "Draft status updated successfully")


update_draft_status = FunctionTool(update_draft_status)


async def delete_draft(draft_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Delete a draft."""
    user_id = require_user_id(tool_context)
    await DraftsService.delete_draft(user_id, draft_id)
    return _response({"status": "success"}, "Draft deleted successfully")


async def get_draft_stats(tool_context: ToolContext) -> dict[str, object]:
    """Return draft stats."""
    user_id = require_user_id(tool_context)
    stats = await DraftsService.get_stats(user_id)
    return _response(stats)


# ── HITL ─────────────────────────────────────────────────────────────────────


async def get_pending_hitl(session_id: str, tool_context: ToolContext) -> dict[str, object]:
    """Fetch the pending human-in-the-loop request for a session."""
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
    """Pause the current turn and ask the human to approve, choose, or supply input.

    Args:
      kind: One of "approval", "choice", or "input".
      title: Short title shown to the human.
      description: What the human is being asked to decide.
      options_json: For kind "approval"/"choice", a JSON array of
        {"id": "...", "label": "..."} options, e.g.
        '[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]'.
      input_schema_json: For kind "input", a JSON object schema with a
        "properties" map describing the fields to collect.
      payload_json: Optional JSON object of context to show the human.
      expires_in_seconds: Optional expiry in seconds (0 = no expiry).

    Use simple flat JSON strings; do not nest beyond what is described.
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


# ── Tool groups ──────────────────────────────────────────────────────────────


ACCOUNT_TOOLS = [
    get_profile,
    update_profile,
    get_preferences,
    upsert_preferences,
    append_research_interest,
    remove_research_interest,
    append_target_country,
    remove_target_country,
    append_target_university,
    remove_target_university,
]

SESSION_TOOLS = [
    create_session,
    list_sessions,
    get_session,
    delete_session,
    rename_session,
    toggle_session_star,
    set_session_group,
    list_session_messages,
    create_session_message,
]

GROUP_TOOLS = [create_group, list_groups, delete_group]

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
    update_application_status,
    update_application_sop_status,
    update_application_cv_status,
    update_application_funded,
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

GOVERNANCE_TOOLS = [get_pending_hitl, REQUEST_HITL_TOOL]

APPLICATION_TOOLS = SHORTLIST_TOOLS + TRACKER_TOOLS + DRAFT_TOOLS
OPERATIONS_TOOLS = ACCOUNT_TOOLS + SESSION_TOOLS + GROUP_TOOLS + APPLICATION_TOOLS + GOVERNANCE_TOOLS
