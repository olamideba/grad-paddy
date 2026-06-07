import asyncio
from datetime import timedelta

from src.integrations import google_client
from src.repositories.tracker_repo import TrackerRepository
from src.repositories.users_repo import UserRepository
from src.services.integrations_service import IntegrationsService

# Google caps reminder lead time at 4 weeks (40320 minutes).
MAX_REMINDER_MINUTES = 40320


def _reminder_minutes(offsets_days: list[int]) -> list[int]:
    mins = []
    for d in offsets_days or []:
        try:
            m = int(d) * 1440
        except (TypeError, ValueError):
            continue
        if 0 < m <= MAX_REMINDER_MINUTES:
            mins.append(m)
    return mins or [1440]  # fall back to 1 day if nothing valid


class CalendarService:

    @staticmethod
    async def add_deadline_event(user_id: str, application_id: str) -> dict:
        """Create (or replace) a Google Calendar deadline event for an application.
        Returns the updated application. Raises ValueError if Google isn't connected
        or the application is missing."""
        app = await TrackerRepository.get_application(user_id, application_id)
        if app is None:
            raise ValueError("Application record not found")

        deadline = app.get("deadline")
        if deadline is None:
            raise ValueError("Application has no deadline")

        access_token = await IntegrationsService.get_access_token(user_id)

        prefs = await UserRepository.get_preferences(user_id) or {}
        reminders = _reminder_minutes(prefs.get("reminder_offsets_days"))

        # Replace any existing event so reminders/timing stay in sync.
        old_event_id = app.get("calendar_event_id")
        if old_event_id:
            await asyncio.to_thread(google_client.calendar_delete_event, access_token, old_event_id)

        start = deadline
        end = deadline + timedelta(hours=1)
        summary = f"Deadline: {app.get('university', '')} — {app.get('program', '')}".strip(" —")
        description = (
            f"Application deadline for {app.get('program', '')} at "
            f"{app.get('university', '')} ({app.get('department', '')}). Tracked by Grad Paddy."
        )

        event = await asyncio.to_thread(
            google_client.calendar_insert_event,
            access_token,
            summary=summary,
            description=description,
            start_iso=start.isoformat(),
            end_iso=end.isoformat(),
            reminder_minutes=reminders,
        )
        event_id = event.get("id")
        return await TrackerRepository.set_calendar_event_id(user_id, application_id, event_id)

    @staticmethod
    async def remove_deadline_event(user_id: str, application_id: str) -> dict:
        """Delete the linked Calendar event and clear the stored id."""
        app = await TrackerRepository.get_application(user_id, application_id)
        if app is None:
            raise ValueError("Application record not found")
        event_id = app.get("calendar_event_id")
        if event_id:
            access_token = await IntegrationsService.get_access_token(user_id)
            await asyncio.to_thread(google_client.calendar_delete_event, access_token, event_id)
        return await TrackerRepository.set_calendar_event_id(user_id, application_id, None)
