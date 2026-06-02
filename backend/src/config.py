from __future__ import annotations
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    GOOGLE_CLOUD_PROJECT: str = Field(default="grad-paddy", description="Google Cloud Project name")
    GOOGLE_CLOUD_LOCATION: str = Field(default="us-central1")
    GOOGLE_GENAI_USE_VERTEXAI: bool = Field(default=True)
    GOOGLE_API_KEY: str = Field(..., description="Google API key")

    # Elastic Search
    ES_URL: str = Field(default="https://my-elasticsearch-project-b387b6.es.us-central1.gcp.elastic.cloud:443")
    ES_API_KEY: str = Field(..., description="Elastic Search API Key")
    PROGRAM_ES_INDEX: str = Field(default="grad-programs")
    FACULTY_ES_INDEX: str = Field(default="faculty-profiles")

    EMBEDDING_BACKEND: str = Field(default="local")
    ONNX_MODEL_PATH: str = Field(default="models/onnx/model.onnx")
    ONNX_TOKENIZER_PATH: str = Field(default="models/")

    GEMINI_ENABLED: bool = Field(default=True)            
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash") 

    DOWNLOAD_DELAY: int = Field(default=2)
    CONCURRENT_REQUESTS: int = Field(default=4)
    LOG_LEVEL: str = Field(default="INFO") 


@lru_cache
def get_settings() -> Settings:
    """Return a cached instance of app settings"""
    return Settings()