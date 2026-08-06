from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    app_cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None

    @cached_property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.app_cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()

