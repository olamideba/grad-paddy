from __future__ import annotations

import logging
from typing import Any

from src.core.config import get_settings

logger = logging.getLogger(__name__)


def _parse_tool_filter(raw: str) -> list[str] | None:
    tools = [tool.strip() for tool in raw.split(",") if tool.strip()]
    return tools or None


def build_elastic_mcp_tools() -> list[Any]:
    """Build the Elastic Agent Builder MCP toolset when configured.

    The integration is intentionally optional so local development and tests can
    run without Elastic credentials. In production, set ELASTIC_MCP_URL to the
    Kibana Agent Builder MCP URL and ELASTIC_API_KEY to an encoded Elastic API key.
    """
    settings = get_settings()
    mcp_url = settings.ELASTIC_MCP_URL.strip()
    api_key = settings.ELASTIC_API_KEY.strip()

    if not mcp_url or not api_key:
        return []

    try:
        try:
            from google.adk.tools.mcp_tool import McpToolset
        except ImportError:
            from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

        from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
    except ImportError as exc:
        logger.warning("Elastic MCP tools are disabled because ADK MCP imports failed: %s", exc)
        return []

    return [
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=mcp_url,
                headers={
                    "Authorization": f"ApiKey {api_key}",
                    "Accept": "application/json, text/event-stream",
                    "Content-Type": "application/json",
                },
                timeout=settings.ELASTIC_MCP_TIMEOUT_SECONDS,
                sse_read_timeout=settings.ELASTIC_MCP_SSE_READ_TIMEOUT_SECONDS,
            ),
            tool_filter=_parse_tool_filter(settings.ELASTIC_MCP_TOOL_FILTER),
        )
    ]
