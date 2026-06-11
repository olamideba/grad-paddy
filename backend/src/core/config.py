from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache
from pathlib import Path



class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
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
    # Names MUST match the tool function names exactly — the HITL callback keys
    # off `tool.name`. Email tools are intentionally excluded: create_email only
    # makes a 'draft' (the email gate is opened separately) and send_email runs
    # post-approval from the canvas.
    SENSITIVE_TOOLS: list[str] = Field(
        default=[
            "update_profile",
            "update_preferences",
            "add_shortlist_faculty",
            "update_shortlist_faculty",
            "update_shortlist_outreach_status",
            "delete_shortlist_faculty",
            "create_application",
            "update_application",
            "add_application_recommender",
            "update_application_recommender_status",
            "delete_application",
            "create_draft",
            "update_draft_content",
            "update_draft_status",
            "delete_draft",
            "ingest_url",
        ]
    )

    # Firestore
    FIRESTORE_DATABASE_ID: str = Field(default="grad-paddy-db")

    # Elastic Agent Builder MCP
    ELASTIC_MCP_URL: str = Field(default="")
    ELASTIC_API_KEY: str = Field(default="")
    ELASTIC_MCP_TIMEOUT_SECONDS: int = Field(default=60)
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
    ELASTIC_MCP_EXTRA_TOOL_FILTER: str = Field(
        default=(
            "find_faculty_by_research,"
            "find_faculty_by_research_and_schools,"
            "find_universities_by_program,"
            "check_program_deadlines_and_application_fees,"
            "find_faculty_by_university,"
        )
    )

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
    COLLECTION_INGESTION_JOBS: str = Field(default="ingestion_jobs")

    # Named document keys (single documents, not collections)
    DOC_PROFILE: str = Field(default="profile")
    DOC_PREFERENCES: str = Field(default="preferences")
    DOC_GOOGLE_INTEGRATION: str = Field(default="google")

    # Elastic Search
    ES_URL: str = Field(default="")
    PROGRAM_ES_INDEX: str = Field(default="grad-programs")
    FACULTY_ES_INDEX: str = Field(default="faculty-profiles")
    MEMORY_ES_INDEX: str = Field(default="user-memories")
    MEMORY_TOP_K: int = Field(default=8)
    # Dedup threshold on the `semantic` query score (~raw cosine for a dense
    # text_embedding model, NOT normalized (1+cos)/2). Calibrated via
    # smoke_memory.py: a paraphrase pair measured 0.905; unrelated facts score
    # far lower. 0.88 sits just below the paraphrase score — catches restatements
    # with margin without collapsing distinct facts. Re-measure if the embedding
    # model / inference endpoint changes.
    MEMORY_SIMILARITY_THRESHOLD: float = Field(default=0.88)
    MEMORY_INFERENCE_ID: str = Field(default="googlevertexai-text_embedding-bwonmglu9c")
    MEMORY_INFERENCE_LOCATION: str = Field(default="us-central1")

    EMBEDDING_MODEL: str = Field(default="text-embedding-004")

    GEMINI_ENABLED: bool = Field(default=True)
    GEMINI_MODEL: str = Field(default="gemini-3.1-flash-lite")

    DOWNLOAD_DELAY: int = Field(default=2)
    CONCURRENT_REQUESTS: int = Field(default=4)
    LOG_LEVEL: str = Field(default="INFO")
    OPENALEX_API_KEY: str = Field(default="")


@lru_cache
def get_settings() -> Settings:
    return Settings()
