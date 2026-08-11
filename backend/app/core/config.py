from functools import cached_property

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    app_cors_origins: str = "http://localhost:5173"
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_claim_email: str | None = None

    @field_validator("vapid_public_key", "vapid_private_key", mode="after")
    @classmethod
    def strip_vapid_keys(cls, value: str | None) -> str | None:
        """Deploy dashboards (Railway et al.) often preserve trailing
        whitespace/newlines when a secret is pasted in — atob() on the
        frontend rejects that with an opaque "did not match the expected
        pattern" error, so strip it here rather than downstream."""
        if value is None:
            return None
        return value.strip() or None

    @cached_property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.app_cors_origins.split(",")
            if origin.strip()
        ]

    @cached_property
    def supabase_auth_issuer(self) -> str | None:
        if not self.supabase_url:
            return None

        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @cached_property
    def supabase_jwks_url(self) -> str | None:
        issuer = self.supabase_auth_issuer
        if not issuer:
            return None

        return f"{issuer}/.well-known/jwks.json"


settings = Settings()
