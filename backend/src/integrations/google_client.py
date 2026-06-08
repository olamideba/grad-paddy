"""Minimal Google OAuth + Gmail + Calendar client over stdlib urllib.

Deliberately dependency-free (no google-auth-oauthlib / googleapiclient): the
backend already ships google-auth transitively, but the OAuth dance and the two
REST calls we need are small enough to do directly. All functions here are
SYNCHRONOUS and blocking — callers must wrap them in asyncio.to_thread.

Note: this is a SEPARATE grant from Firebase Google login. Login only proves
identity (openid/email, no refresh token); this flow requests gmail.send +
calendar.events with offline access so the backend can act on the user's
behalf later.
"""
from __future__ import annotations

import base64
import json
import urllib.parse
import urllib.request
from email.mime.text import MIMEText

from src.core.config import get_settings

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

# openid + email so we can record which Google account connected.
SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.events",
]


class GoogleAuthError(Exception):
    """Raised when a Google OAuth/API call fails."""


def _post_form(url: str, fields: dict) -> dict:
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    return _send(req)


def _post_json(url: str, payload: dict, access_token: str) -> dict:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {access_token}")
    return _send(req)


def _get(url: str, access_token: str) -> dict:
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {access_token}")
    return _send(req)


def _send(req: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise GoogleAuthError(f"Google API {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise GoogleAuthError(f"Google API request failed: {e}") from e


# ── OAuth ──────────────────────────────────────────────────────────────────────

def build_auth_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",       # request a refresh token
        "prompt": "consent",            # force refresh-token issuance on re-consent
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for tokens. Returns the raw token dict
    (access_token, refresh_token, id_token, expires_in, scope)."""
    settings = get_settings()
    return _post_form(TOKEN_ENDPOINT, {
        "code": code,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    })


def refresh_access_token(refresh_token: str) -> str:
    """Mint a fresh access token from a stored refresh token."""
    settings = get_settings()
    tok = _post_form(TOKEN_ENDPOINT, {
        "refresh_token": refresh_token,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "grant_type": "refresh_token",
    })
    access_token = tok.get("access_token")
    if not access_token:
        raise GoogleAuthError("No access_token in refresh response")
    return access_token


def get_userinfo(access_token: str) -> dict:
    """Return the connected account's profile (incl. email)."""
    return _get(USERINFO_ENDPOINT, access_token)


def revoke(token: str) -> None:
    """Best-effort revoke of a refresh/access token."""
    try:
        _post_form(REVOKE_ENDPOINT, {"token": token})
    except GoogleAuthError:
        # Already revoked / invalid — nothing to do.
        pass


# ── Gmail ────────────────────────────────────────────────────────────────────

def _markdown_to_html(body: str) -> str | None:
    """Render Markdown to HTML. Returns None if no renderer is available."""
    try:
        from markdown_it import MarkdownIt
    except Exception:
        return None
    return MarkdownIt("commonmark", {"breaks": True, "linkify": True}).render(body)


def _markdown_to_plain(body: str) -> str:
    """A clean plain-text fallback: drop markdown bold markers and unescape
    backslash-escaped characters (e.g. '\\[name\\]' -> '[name]')."""
    import re

    text = re.sub(r"\*\*(.+?)\*\*", r"\1", body)
    text = re.sub(r"\\([\\`*_{}\[\]()#+.!\-])", r"\1", text)
    return text


def gmail_send(access_token: str, *, to: str, subject: str, body: str) -> dict:
    """Send an email as the authorized user.

    The body is authored in Markdown. We send multipart/alternative — a rendered
    HTML part so bold, bullets, and links display cleanly in the recipient's
    client, plus a plain-text fallback with the markdown markers removed. If no
    Markdown renderer is available we fall back to a clean plain-text email."""
    body = body or ""
    html = _markdown_to_html(body)
    if html is None:
        msg: MIMEText = MIMEText(_markdown_to_plain(body), "plain", "utf-8")
    else:
        from email.mime.multipart import MIMEMultipart

        multipart = MIMEMultipart("alternative")
        multipart.attach(MIMEText(_markdown_to_plain(body), "plain", "utf-8"))
        multipart.attach(MIMEText(html, "html", "utf-8"))
        msg = multipart  # type: ignore[assignment]
    msg["to"] = to
    msg["subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return _post_json(GMAIL_SEND_ENDPOINT, {"raw": raw}, access_token)


# ── Calendar ─────────────────────────────────────────────────────────────────

def calendar_insert_event(
    access_token: str,
    *,
    summary: str,
    description: str,
    start_iso: str,
    end_iso: str,
    reminder_minutes: list[int],
    time_zone: str = "UTC",
) -> dict:
    """Create a timed event with email + popup reminder overrides."""
    overrides = []
    for minutes in reminder_minutes:
        overrides.append({"method": "email", "minutes": minutes})
        overrides.append({"method": "popup", "minutes": minutes})
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": time_zone},
        "end": {"dateTime": end_iso, "timeZone": time_zone},
        "reminders": {"useDefault": False, "overrides": overrides},
    }
    return _post_json(CALENDAR_EVENTS_ENDPOINT, event, access_token)


def calendar_delete_event(access_token: str, event_id: str) -> None:
    req = urllib.request.Request(
        f"{CALENDAR_EVENTS_ENDPOINT}/{urllib.parse.quote(event_id)}", method="DELETE"
    )
    req.add_header("Authorization", f"Bearer {access_token}")
    try:
        _send(req)
    except GoogleAuthError:
        pass
