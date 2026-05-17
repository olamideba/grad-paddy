from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache

class Settings(BaseSettings):
    model_config: SettingsConfigDict = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )
    
    GOOGLE_CLOUD_PROJECT: str = Field(default="")
    GOOGLE_CLOUD_LOCATION: str = Field(default="global")
    GOOGLE_GENAI_USE_VERTEXAI: bool = Field(default=True)
    
@lru_cache
def get_settings() -> Settings:
    return Settings() 