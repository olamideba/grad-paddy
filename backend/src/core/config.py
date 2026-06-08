from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    GOOGLE_CLOUD_PROJECT: str = Field(default="")
    GOOGLE_CLOUD_LOCATION: str = Field(default="global")
    GOOGLE_GENAI_USE_VERTEXAI: bool = Field(default=True)
    GOOGLE_APPLICATION_CREDENTIALS: Path | None = Field(default=None)

    # Firebase Storage bucket (e.g. "<project>.appspot.com"). Required for CV uploads.
    STORAGE_BUCKET: str = Field(default="")

    # Google OAuth (Gmail send + Calendar). Reuses the project's OAuth client.
    GOOGLE_OAUTH_CLIENT_ID: str = Field(default="")
    GOOGLE_OAUTH_CLIENT_SECRET: str = Field(default="")
    GOOGLE_OAUTH_REDIRECT_URI: str = Field(default="")
    # Where to send the user after the OAuth callback completes.
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    AG_UI_APP_NAME: str = Field(default="grad_paddy")
    AG_UI_USER_ID: str = Field(default="demo_user")
    AG_UI_SESSION_TIMEOUT_SECONDS: int = Field(default=3600)
    ADK_ENABLE_JSON_SCHEMA_FOR_FUNC_DECL: bool = Field(default=True)
    ADK_LOG_PROMPT_CONTENT: bool = Field(default=True)

    # HITL Settings
    SENSITIVE_TOOLS: list[str] = Field(default=[
        "add_shortlist_faculty",
        "update_shortlist_faculty",
        "delete_shortlist_faculty",
        "create_application",
        "update_application",
        "delete_application",
        "create_draft",
        "update_draft_content",
        "upsert_preferences",
    ])

    # Firestore
    FIRESTORE_DATABASE_ID: str = Field(default="grad-paddy-db")

    # Elastic Agent Builder MCP
    ELASTIC_MCP_URL: str = Field(default="")
    ELASTIC_API_KEY: str = Field(default="")
    ELASTIC_MCP_TIMEOUT_SECONDS: int = Field(default=30)
    ELASTIC_MCP_SSE_READ_TIMEOUT_SECONDS: int = Field(default=300)
    ELASTIC_MCP_TOOL_FILTER: str = Field(
        default=(
            "platform.core.index_explorer,"
            "platform.core.list_indices,"
            "platform.core.get_index_mapping,"
            "platform.core.search,"
            "platform.core.generate_esql,"
            "platform.core.execute_esql,"
            "platform.core.get_document_by_id,"
            "platform.core.create_visualization"
        )
    )
    ELASTIC_MCP_EXTRA_TOOL_FILTER: str = Field(default="")

    # Collection names
    COLLECTION_USERS: str = Field(default="users")
    COLLECTION_SESSIONS: str = Field(default="sessions")
    COLLECTION_MESSAGES: str = Field(default="messages")
    COLLECTION_HITL: str = Field(default="hitl")
    COLLECTION_SHORTLIST: str = Field(default="shortlist")
    COLLECTION_TRACKER: str = Field(default="tracker")
    COLLECTION_DRAFTS: str = Field(default="drafts")
    COLLECTION_GROUPS: str = Field(default="groups")
    COLLECTION_CVS: str = Field(default="cvs")
    COLLECTION_INTEGRATIONS: str = Field(default="integrations")
    COLLECTION_OAUTH_STATES: str = Field(default="oauth_states")
    COLLECTION_EMAILS: str = Field(default="emails")

    # Named document keys (single documents, not collections)
    DOC_PROFILE: str = Field(default="profile")
    DOC_PREFERENCES: str = Field(default="preferences")
    DOC_GOOGLE_INTEGRATION: str = Field(default="google")


@lru_cache
def get_settings() -> Settings:
    return Settings()
