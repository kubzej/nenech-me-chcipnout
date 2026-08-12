from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.plant_photos import PlantPhotoCreateRequest, PlantPhotoItem
from app.services.storage import delete_storage_object
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["plant-photos"])

_SELECT = (
    "id,kytka_id,storage_bucket,storage_path,captured_at,note,"
    "health_snapshot,care_event_id,created_at"
)
_BUCKET = "plant-photos"


@router.post("/plant-photos", response_model=PlantPhotoItem)
async def create_plant_photo(
    payload: PlantPhotoCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> PlantPhotoItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        kytka = await _require_kytka(client, headers, payload.kytka_id, workspace["id"])
        _validate_storage_path(payload.storage_path, workspace["id"], payload.kytka_id)
        if payload.care_event_id is not None:
            await _require_care_event(
                client,
                headers,
                payload.care_event_id,
                payload.kytka_id,
                workspace["id"],
            )

        insert_payload = payload.model_dump(mode="json")
        insert_payload["workspace_id"] = str(workspace["id"])
        insert_payload["storage_bucket"] = _BUCKET
        insert_payload["uploaded_by"] = str(current_user.user_id)

        row = await _insert_one(client, headers, insert_payload)

        if kytka.get("primary_photo_id") is None:
            await _maybe_set_primary_photo(
                client, headers, workspace["id"], payload.kytka_id, row["id"]
            )

    return PlantPhotoItem(**row)


@router.get("/kytky/{kytka_id}/photos", response_model=list[PlantPhotoItem])
async def list_kytka_photos(
    kytka_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> list[PlantPhotoItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        await _require_kytka(client, headers, kytka_id, workspace["id"])

        response = await client.get(
            "/plant_photos",
            headers=headers,
            params={
                "select": _SELECT,
                "workspace_id": f"eq.{workspace['id']}",
                "kytka_id": f"eq.{kytka_id}",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [PlantPhotoItem(**row) for row in response.json()]


@router.delete("/plant-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plant_photo(
    photo_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        photo = await _require_photo(client, headers, photo_id, workspace["id"])
        await delete_storage_object(
            current_user.access_token,
            str(photo["storage_bucket"]),
            str(photo["storage_path"]),
        )
        response = await client.delete(
            "/plant_photos",
            headers=headers,
            params={
                "id": f"eq.{photo_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(response)


async def _maybe_set_primary_photo(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    photo_id: object,
) -> None:
    """First photo for a Kytka becomes its avatar. Conditional on
    primary_photo_id still being null so a later, slower upload can't clobber
    an avatar an earlier one already set."""
    response = await client.patch(
        "/kytky",
        headers={**headers, "Content-Type": "application/json"},
        params={
            "id": f"eq.{kytka_id}",
            "workspace_id": f"eq.{workspace_id}",
            "primary_photo_id": "is.null",
        },
        json={"primary_photo_id": str(photo_id)},
    )
    raise_supabase_error(response)


async def _require_kytka(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    kytka_id: UUID,
    workspace_id: object,
) -> dict[str, object]:
    response = await client.get(
        "/kytky",
        headers=headers,
        params={
            "select": "id,primary_photo_id",
            "id": f"eq.{kytka_id}",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kytka not found"
        )

    return rows[0]


def _validate_storage_path(
    storage_path: str,
    workspace_id: object,
    kytka_id: UUID,
) -> None:
    parts = storage_path.split("/")
    if (
        len(parts) < 3
        or parts[0] != str(workspace_id)
        or parts[1] != str(kytka_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo storage path does not match the workspace and Kytka",
        )


async def _require_care_event(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    care_event_id: UUID,
    kytka_id: UUID,
    workspace_id: object,
) -> dict[str, object]:
    response = await client.get(
        "/care_events",
        headers=headers,
        params={
            "select": "id",
            "id": f"eq.{care_event_id}",
            "kytka_id": f"eq.{kytka_id}",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Care event does not belong to this Kytka",
        )

    return rows[0]


async def _require_photo(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    photo_id: UUID,
    workspace_id: object,
) -> dict[str, object]:
    response = await client.get(
        "/plant_photos",
        headers=headers,
        params={
            "select": "id,storage_bucket,storage_path",
            "id": f"eq.{photo_id}",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    return rows[0]


async def _require_workspace(current_user: CurrentUser) -> dict[str, object]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return workspace


async def _insert_one(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    payload: dict[str, object],
) -> dict[str, object]:
    response = await client.post(
        "/plant_photos",
        headers={
            **headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        params={"select": _SELECT},
        json=payload,
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase insert returned no rows for /plant_photos",
        )

    return rows[0]
