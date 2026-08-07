import os
from typing import Annotated, List, Union
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from pydantic import Field, field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "TravelBuddy API"
    API_V1_STR: str = "/api/v1"

    # CORS
    # NoDecode is required: without it pydantic-settings JSON-decodes env vars for
    # complex types BEFORE field validators run, so the plain comma-separated form
    # (`a,b`) that assemble_cors_origins below exists to handle would crash startup
    # with a JSONDecodeError instead of ever reaching the validator.
    BACKEND_CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        """Accept BOTH `a,b` and `["a","b"]` from the environment.

        This validator now owns all parsing because the field is annotated NoDecode.
        The JSON branch is not optional: before NoDecode, pydantic-settings decoded
        JSON arrays itself and crashed on comma-separated values; adding NoDecode
        fixed that and silently broke the opposite case, so any existing .env using
        the JSON form failed at startup with a bare `list_type` error.
        """
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            text = v.strip()
            if text.startswith("["):
                import json
                return json.loads(text)
            return [item.strip() for item in text.split(",") if item.strip()]
        raise ValueError(v)

    # Database
    POSTGRES_SERVER: str = Field(default="localhost", validation_alias="POSTGRES_SERVER")
    POSTGRES_USER: str = Field(default="postgres", validation_alias="POSTGRES_USER")
    POSTGRES_PASSWORD: str = Field(default="postgres", validation_alias="POSTGRES_PASSWORD")
    POSTGRES_DB: str = Field(default="trip_planner", validation_alias="POSTGRES_DB")
    POSTGRES_PORT: str = Field(default="5432", validation_alias="POSTGRES_PORT")
    DATABASE_URL: str | None = None

    # Security & JWT
    SECRET_KEY: str = Field(default="SUPER_SECRET_KEY_CHANGE_ME_IN_PRODUCTION", validation_alias="SECRET_KEY")
    REFRESH_SECRET_KEY: str = Field(default="SUPER_REFRESH_SECRET_KEY_CHANGE_ME_IN_PRODUCTION", validation_alias="REFRESH_SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # LLM Integrations
    GEMINI_API_KEY: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    OPENAI_API_KEY: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")

    # Tool-grounding external APIs (backend/app/tools/) — see KICKOFF_PROMPT.md Phase 1.
    # Open-Meteo needs no key. Amadeus and OpenTripMap tools degrade to empty results
    # (not fake data) when their keys are unset.
    AMADEUS_API_KEY: str | None = Field(default=None, validation_alias="AMADEUS_API_KEY")
    AMADEUS_API_SECRET: str | None = Field(default=None, validation_alias="AMADEUS_API_SECRET")
    AMADEUS_HOSTNAME: str = Field(default="test.api.amadeus.com", validation_alias="AMADEUS_HOSTNAME")
    OPENTRIPMAP_API_KEY: str | None = Field(default=None, validation_alias="OPENTRIPMAP_API_KEY")

    @property
    def IS_GROQ(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY.startswith("gsk_"))

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None, info) -> str:
        if isinstance(v, str) and v:
            return v
        data = info.data
        import urllib.parse
        encoded_pwd = urllib.parse.quote_plus(data.get('POSTGRES_PASSWORD', ''))
        return f"postgresql://{data.get('POSTGRES_USER')}:{encoded_pwd}@{data.get('POSTGRES_SERVER')}:{data.get('POSTGRES_PORT')}/{data.get('POSTGRES_DB')}"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
