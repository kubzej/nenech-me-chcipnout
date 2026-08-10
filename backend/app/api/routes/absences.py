from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.absences import AbsenceCreateRequest, AbsenceItem
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["absences"])

_SELECT = (
    "id,user_id,starts_on,ends_on,reason,suppress_notifications,created_at,updated_at"
)


@router.get("/absences", response_model=list[AbsenceItem])
async def list_absences(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[AbsenceItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/user_absences",
            headers=headers,
            params={
                "select": _SELECT,
                "workspace_id": f"eq.{workspace['id']}",
                "order": "starts_on.desc",
            },
        )
        raise_supabase_error(response)

    return [AbsenceItem(**row) for row in response.json()]


@router.post("/absences", response_model=AbsenceItem)
async def create_absence(
    payload: AbsenceCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> AbsenceItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.post(
            "/user_absences", headers=headers, json=insert_payload
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase insert returned no rows for /user_absences",
        )

    return AbsenceItem(**rows[0])


@router.patch("/absences/{absence_id}", response_model=AbsenceItem)
async def update_absence(
    absence_id: UUID,
    payload: AbsenceCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> AbsenceItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/user_absences",
            headers=headers,
            params={
                "id": f"eq.{absence_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
            json=update_payload,
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Absence not found"
        )

    return AbsenceItem(**rows[0])


@router.delete("/absences/{absence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_absence(
    absence_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.delete(
            "/user_absences",
            headers=headers,
            params={
                "id": f"eq.{absence_id}",
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
