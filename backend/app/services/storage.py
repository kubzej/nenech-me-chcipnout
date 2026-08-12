from urllib.parse import quote

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


async def delete_storage_object(
    access_token: str,
    bucket: str,
    storage_path: str,
) -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase storage env is not configured",
        )

    encoded_bucket = quote(bucket, safe="")
    encoded_path = quote(storage_path, safe="/")
    url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{encoded_bucket}/{encoded_path}"
    )

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.delete(
            url,
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {access_token}",
            },
        )

    if response.status_code in (200, 204, 404):
        return

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            "Supabase storage delete failed: "
            f"{response.status_code} {response.text}"
        ),
    )
