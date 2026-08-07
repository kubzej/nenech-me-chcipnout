from collections import Counter
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.care_profiles import CareProfileCreateRequest, CareProfileItem
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["care-profiles"])

_SELECT = (
    "id,name,scientific_name,source,source_ref,water_interval_min_days,"
    "water_interval_max_days,moisture_preference,drought_tolerance,"
    "overwatering_risk,default_water_amount_ml,watering_method,light_need,"
    "heat_sensitive_above_c,cold_sensitive_below_c,frost_sensitive,"
    "feeding_enabled,feeding_interval_days,feeding_months,check_interval_days,"
    "photo_interval_days,pest_check_interval_days,maintenance_notes,risk_notes,"
    "created_at,updated_at"
)


@router.get("/care-profiles", response_model=list[CareProfileItem])
async def list_care_profiles(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[CareProfileItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        profiles_response = await client.get(
            "/care_profiles",
            headers=headers,
            params={
                "select": _SELECT,
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.asc",
            },
        )
        raise_supabase_error(profiles_response)

        kytky_response = await client.get(
            "/kytky",
            headers=headers,
            params={
                "select": "care_profile_id",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(kytky_response)

    counts = Counter(
        row["care_profile_id"]
        for row in kytky_response.json()
        if row.get("care_profile_id") is not None
    )

    return [
        _to_item(row, counts.get(str(row["id"]), 0)) for row in profiles_response.json()
    ]


@router.post("/care-profiles", response_model=CareProfileItem)
async def create_care_profile(
    payload: CareProfileCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareProfileItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])
    insert_payload["source"] = "manual"

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.post(
            "/care_profiles", headers=headers, json=insert_payload
        )
        raise_supabase_error(response)

        rows = response.json()
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Supabase insert returned no rows for /care_profiles",
            )

    return _to_item(rows[0], kytky_count=0)


@router.patch("/care-profiles/{profile_id}", response_model=CareProfileItem)
async def update_care_profile(
    profile_id: UUID,
    payload: CareProfileCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareProfileItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/care_profiles",
            headers=headers,
            params={
                "id": f"eq.{profile_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
            json=update_payload,
        )
        raise_supabase_error(response)

        rows = response.json()
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Care profile not found",
            )

        kytky_response = await client.get(
            "/kytky",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": "id",
                "care_profile_id": f"eq.{profile_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(kytky_response)

    return _to_item(rows[0], kytky_count=len(kytky_response.json()))


@router.delete("/care-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_profile(
    profile_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.delete(
            "/care_profiles",
            headers=headers,
            params={
                "id": f"eq.{profile_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(response)


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


def _to_item(row: dict[str, object], kytky_count: int) -> CareProfileItem:
    return CareProfileItem(kytky_count=kytky_count, **row)
