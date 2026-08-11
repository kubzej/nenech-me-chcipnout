from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.push import (
    NotificationPreferencesItem,
    NotificationPreferencesUpdate,
    PushSubscriptionRequest,
    PushUnsubscribeRequest,
    TestNotificationRequest,
    VapidKeyResponse,
)
from app.services.push import send_push_notification
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api/push", tags=["push"])

_PREFS_SELECT = (
    "workspace_id,user_id,master_enabled,daily_plan_enabled,"
    "critical_weather_enabled,sick_plant_enabled,"
    "weekly_photo_enabled,morning_time,timezone,"
    "created_at,updated_at"
)


@router.get("/vapid-key", response_model=VapidKeyResponse)
async def get_vapid_key() -> VapidKeyResponse:
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured",
        )

    return VapidKeyResponse(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    payload: PushSubscriptionRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    insert_payload = {
        "workspace_id": str(workspace["id"]),
        "user_id": str(current_user.user_id),
        "endpoint": payload.endpoint,
        "p256dh": payload.keys.p256dh,
        "auth": payload.keys.auth,
        "user_agent": payload.user_agent,
        "device_label": payload.device_label,
        "failure_count": 0,
        "disabled_at": None,
    }

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.post(
            "/push_subscriptions",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            params={"on_conflict": "endpoint"},
            json=insert_payload,
        )
        raise_supabase_error(response)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    payload: PushUnsubscribeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/push_subscriptions",
            headers={**headers, "Content-Type": "application/json"},
            params={
                "endpoint": f"eq.{payload.endpoint}",
                "user_id": f"eq.{current_user.user_id}",
            },
            json={"disabled_at": _now_iso()},
        )
        raise_supabase_error(response)


@router.get("/settings", response_model=NotificationPreferencesItem)
async def get_settings_route(
    current_user: CurrentUser = Depends(get_current_user),
) -> NotificationPreferencesItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _ensure_preferences_row(client, headers, workspace, current_user)

    return NotificationPreferencesItem(**row)


@router.patch("/settings", response_model=NotificationPreferencesItem)
async def update_settings_route(
    payload: NotificationPreferencesUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> NotificationPreferencesItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)
    update_payload = payload.model_dump(mode="json", exclude_unset=True)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        await _ensure_preferences_row(client, headers, workspace, current_user)

        response = await client.patch(
            "/notification_preferences",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "workspace_id": f"eq.{workspace['id']}",
                "user_id": f"eq.{current_user.user_id}",
                "select": _PREFS_SELECT,
            },
            json=update_payload,
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found"
        )

    return NotificationPreferencesItem(**rows[0])


@router.post("/test")
async def send_test_notification(
    payload: TestNotificationRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, int]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    sent = await send_push_notification(
        headers,
        workspace["id"],
        current_user.user_id,
        title=payload.title,
        body=payload.body,
        url="/",
        tag="test",
    )
    return {"sent": sent}


async def _ensure_preferences_row(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace: dict[str, object],
    current_user: CurrentUser,
) -> dict[str, object]:
    response = await client.get(
        "/notification_preferences",
        headers=headers,
        params={
            "select": _PREFS_SELECT,
            "workspace_id": f"eq.{workspace['id']}",
            "user_id": f"eq.{current_user.user_id}",
            "limit": "1",
        },
    )
    raise_supabase_error(response)
    rows = response.json()
    if rows:
        return rows[0]

    insert_response = await client.post(
        "/notification_preferences",
        headers={
            **headers,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        params={"select": _PREFS_SELECT},
        json={
            "workspace_id": str(workspace["id"]),
            "user_id": str(current_user.user_id),
        },
    )
    raise_supabase_error(insert_response)
    rows = insert_response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase insert returned no rows for /notification_preferences",
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


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
