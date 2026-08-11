from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.care_events import (
    CareEventCreateRequest,
    CareEventItem,
    CareEventType,
)
from app.services.kytka_status import maybe_transition_from_condition
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["care-events"])

_SELECT = (
    "id,event_type,target_type,kytka_id,container_id,occurred_at,"
    "amount_ml,method,condition,note,created_at"
)

_CONTAINER_SCOPED_TYPES: set[CareEventType] = {"watering", "fertilizing"}


@router.post("/care-events", response_model=CareEventItem)
async def create_care_event(
    payload: CareEventCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareEventItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        kytka = await _require_kytka(client, headers, payload.kytka_id, workspace["id"])
        target_type, kytka_id, container_id = _resolve_target(payload.event_type, kytka)

        insert_payload = payload.model_dump(mode="json", exclude={"kytka_id"})
        insert_payload["workspace_id"] = str(workspace["id"])
        insert_payload["target_type"] = target_type
        insert_payload["kytka_id"] = str(kytka_id) if kytka_id else None
        insert_payload["container_id"] = str(container_id) if container_id else None
        insert_payload["recorded_by"] = str(current_user.user_id)
        if insert_payload.get("occurred_at") is None:
            del insert_payload["occurred_at"]

        row = await _insert_one(client, current_user, insert_payload)

    await maybe_transition_from_condition(
        headers,
        workspace["id"],
        payload.kytka_id,
        payload.event_type,
        payload.condition,
        actor_user_id=current_user.user_id,
    )

    return CareEventItem(**row)


@router.get("/kytky/{kytka_id}/events", response_model=list[CareEventItem])
async def list_kytka_events(
    kytka_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> list[CareEventItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        kytka = await _require_kytka(client, headers, kytka_id, workspace["id"])

        response = await client.get(
            "/care_events",
            headers=headers,
            params={
                "select": _SELECT,
                "workspace_id": f"eq.{workspace['id']}",
                "or": (
                    f"(kytka_id.eq.{kytka['id']},"
                    f"container_id.eq.{kytka['container_id']})"
                ),
                "order": "occurred_at.desc",
            },
        )
        raise_supabase_error(response)

    return [CareEventItem(**row) for row in response.json()]


@router.patch("/care-events/{event_id}", response_model=CareEventItem)
async def update_care_event(
    event_id: UUID,
    payload: CareEventCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareEventItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        kytka = await _require_kytka(client, headers, payload.kytka_id, workspace["id"])
        target_type, kytka_id, container_id = _resolve_target(payload.event_type, kytka)

        update_payload = payload.model_dump(mode="json", exclude={"kytka_id"})
        update_payload["target_type"] = target_type
        update_payload["kytka_id"] = str(kytka_id) if kytka_id else None
        update_payload["container_id"] = str(container_id) if container_id else None
        if update_payload.get("occurred_at") is None:
            del update_payload["occurred_at"]

        response = await client.patch(
            "/care_events",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{event_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
            json=update_payload,
        )
        raise_supabase_error(response)

        rows = response.json()
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Care event not found"
            )

    await maybe_transition_from_condition(
        headers,
        workspace["id"],
        payload.kytka_id,
        payload.event_type,
        payload.condition,
        actor_user_id=current_user.user_id,
    )

    return CareEventItem(**rows[0])


@router.delete("/care-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_event(
    event_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.delete(
            "/care_events",
            headers=headers,
            params={
                "id": f"eq.{event_id}",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(response)


def _resolve_target(
    event_type: CareEventType, kytka: dict[str, object]
) -> tuple[str, UUID | None, UUID | None]:
    if event_type in _CONTAINER_SCOPED_TYPES:
        return "container", None, UUID(str(kytka["container_id"]))

    return "kytka", UUID(str(kytka["id"])), None


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
            "select": "id,container_id",
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
    current_user: CurrentUser,
    payload: dict[str, object],
) -> dict[str, object]:
    headers = {
        **supabase_user_headers(current_user.access_token),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    response = await client.post(
        "/care_events",
        headers=headers,
        params={"select": _SELECT},
        json=payload,
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase insert returned no rows for /care_events",
        )

    return rows[0]
