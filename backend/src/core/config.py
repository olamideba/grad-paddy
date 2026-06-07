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

    AG_UI_APP_NAME: str = Field(default="grad_paddy")
    AG_UI_USER_ID: str = Field(default="demo_user")
    AG_UI_SESSION_TIMEOUT_SECONDS: int = Field(default=3600)

    ADK_LOG_PROMPT_CONTENT: bool = Field(default=True)

    # Firestore
    FIRESTORE_DATABASE_ID: str = Field(default="grad-paddy-db")

    # Collection names
    COLLECTION_USERS: str = Field(default="users")
    COLLECTION_SESSIONS: str = Field(default="sessions")
    COLLECTION_MESSAGES: str = Field(default="messages")
    COLLECTION_HITL: str = Field(default="hitl")
    COLLECTION_SHORTLIST: str = Field(default="shortlist")
    COLLECTION_TRACKER: str = Field(default="tracker")
    COLLECTION_DRAFTS: str = Field(default="drafts")
    COLLECTION_GROUPS: str = Field(default="groups")

    # Named document keys (single documents, not collections)
    DOC_PROFILE: str = Field(default="profile")
    DOC_PREFERENCES: str = Field(default="preferences")


@lru_cache
def get_settings() -> Settings:
    return Settings()
