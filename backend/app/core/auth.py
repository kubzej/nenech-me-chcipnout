from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, decode as jwt_decode

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_client: PyJWKClient | None = None


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    email: str | None
    access_token: str


def get_jwks_client() -> PyJWKClient:
    global _jwks_client

    if not settings.supabase_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured",
        )

    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.supabase_jwks_url)

    return _jwks_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(
            credentials.credentials,
        )
        payload = jwt_decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.supabase_auth_issuer,
        )
        user_id = UUID(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        ) from exc

    return CurrentUser(
        user_id=user_id,
        email=payload.get("email"),
        access_token=credentials.credentials,
    )
