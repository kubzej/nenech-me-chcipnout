from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.kytky import KytkaCreateRequest, KytkaListItem
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["kytky"])

_SELECT = (
    "id,container_id,care_profile_id,display_name,status,acquired_on,notes,"
    "created_at,updated_at,"
    "containers(name,zones(name,locations(name))),"
    "care_profiles(name,scientific_name)"
)


@router.get("/kytky", response_model=list[KytkaListItem])
async def list_kytky(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[KytkaListItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/kytky",
            headers=headers,
            params={
                "select": _SELECT,
                "workspace_id": f"eq.{workspace['id']}",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [_to_list_item(row) for row in response.json()]


@router.post("/kytky", response_model=KytkaListItem)
async def create_kytka(
    payload: KytkaCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> KytkaListItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _insert_one(client, "/kytky", headers, insert_payload)
        row = await _read_one(client, current_user, row["id"])

    return _to_list_item(row)


@router.patch("/kytky/{kytka_id}", response_model=KytkaListItem)
async def update_kytka(
    kytka_id: UUID,
    payload: KytkaCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> KytkaListItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/kytky",
            headers=headers,
            params={"id": f"eq.{kytka_id}", "workspace_id": f"eq.{workspace['id']}"},
            json=update_payload,
        )
        raise_supabase_error(response)

        rows = response.json()
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Kytka not found"
            )

        row = await _read_one(client, current_user, rows[0]["id"])

    return _to_list_item(row)


@router.delete("/kytky/{kytka_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kytka(
    kytka_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.delete(
            "/kytky",
            headers=headers,
            params={"id": f"eq.{kytka_id}", "workspace_id": f"eq.{workspace['id']}"},
        )
        raise_supabase_error(response)


async def _read_one(
    client: httpx.AsyncClient, current_user: CurrentUser, kytka_id: object
) -> dict[str, object]:
    response = await client.get(
        "/kytky",
        headers=supabase_user_headers(current_user.access_token),
        params={"select": _SELECT, "id": f"eq.{kytka_id}", "limit": "1"},
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase returned no kytka readback",
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


def _insert_headers(current_user: CurrentUser) -> dict[str, str]:
    return {
        **supabase_user_headers(current_user.access_token),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def _insert_one(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    payload: dict[str, object],
) -> dict[str, object]:
    response = await client.post(path, headers=headers, json=payload)
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase insert returned no rows for {path}",
        )

    return rows[0]


def _to_list_item(row: dict[str, object]) -> KytkaListItem:
    container = _nested_dict(row.get("containers"))
    zone = _nested_dict(container.get("zones"))
    location = _nested_dict(zone.get("locations"))
    care_profile = _nested_dict(row.get("care_profiles"))

    return KytkaListItem(
        id=row["id"],
        container_id=row["container_id"],
        care_profile_id=row.get("care_profile_id"),
        display_name=str(row["display_name"]),
        status=str(row["status"]),
        acquired_on=row.get("acquired_on"),
        notes=_optional_str(row.get("notes")),
        container_name=_optional_str(container.get("name")),
        zone_name=_optional_str(zone.get("name")),
        location_name=_optional_str(location.get("name")),
        care_profile_name=_optional_str(care_profile.get("name")),
        scientific_name=_optional_str(care_profile.get("scientific_name")),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _nested_dict(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None
