import httpx
from fastapi import HTTPException, status

from app.core.config import settings


def supabase_rest_url() -> str:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured",
        )

    return f"{settings.supabase_url.rstrip('/')}/rest/v1"


def supabase_user_headers(access_token: str) -> dict[str, str]:
    if not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_ANON_KEY is not configured",
        )

    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {access_token}",
    }


def raise_supabase_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Supabase request failed: {response.status_code} {response.text}",
    )
