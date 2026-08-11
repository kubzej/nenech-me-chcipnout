from uuid import UUID

import httpx

from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_service_headers,
)
from app.services.push import send_push_notification

_BAD_CONDITIONS = {"wilting", "yellowing", "pests", "damaged"}
_CONDITION_EVENT_TYPES = {"checkin", "pest_observation"}


async def maybe_transition_from_condition(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    event_type: str,
    condition: str | None,
    actor_user_id: object | None = None,
) -> None:
    """Auto-transition a Kytka's status based on a just-logged condition.

    Only ever moves ok<->monitoring. Never touches sick/dormant/dead —
    those stay manual-only, matching the product's "not exclusively
    automatic" status principle.
    """
    if condition is None or event_type not in _CONDITION_EVENT_TYPES:
        return

    if condition in _BAD_CONDITIONS:
        kytka = await _patch_status_if_current(
            headers, workspace_id, kytka_id, "ok", "monitoring"
        )
        if kytka:
            await _notify_sick_plant(workspace_id, kytka["display_name"], actor_user_id)
    elif condition == "ok":
        await _patch_status_if_current(
            headers, workspace_id, kytka_id, "monitoring", "ok"
        )


async def escalate_to_monitoring(
    headers: dict[str, str], workspace_id: object, kytka_id: UUID
) -> None:
    """Escalate a Kytka to monitoring due to prolonged watering neglect."""
    kytka = await _patch_status_if_current(
        headers, workspace_id, kytka_id, "ok", "monitoring"
    )
    if kytka:
        await _notify_sick_plant(
            workspace_id, kytka["display_name"], actor_user_id=None
        )


async def _patch_status_if_current(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    from_status: str,
    to_status: str,
) -> dict[str, object] | None:
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/kytky",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{kytka_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": f"eq.{from_status}",
                "select": "id,display_name",
            },
            json={"status": to_status},
        )
        raise_supabase_error(response)

    rows = response.json()
    return rows[0] if rows else None


async def _notify_sick_plant(
    workspace_id: object, kytka_display_name: str, actor_user_id: object | None
) -> None:
    """Notify workspace members (except whoever just triggered this, if
    known) that a Kytka moved into monitoring. Needs service-role headers
    regardless of who's making the underlying request — a regular user's
    JWT can only see their own push_subscriptions, not their partner's."""
    service_headers = supabase_service_headers()

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        prefs_response = await client.get(
            "/notification_preferences",
            headers=service_headers,
            params={
                "select": "user_id",
                "workspace_id": f"eq.{workspace_id}",
                "master_enabled": "is.true",
                "sick_plant_enabled": "is.true",
            },
        )
        raise_supabase_error(prefs_response)

    for row in prefs_response.json():
        if actor_user_id is not None and str(row["user_id"]) == str(actor_user_id):
            continue
        await send_push_notification(
            service_headers,
            workspace_id,
            row["user_id"],
            title="Sledovaná kytka",
            body=(
                f"{kytka_display_name} potřebuje pozornost — "
                f"přepnul jsem ji na sledování."
            ),
            url="/",
            tag="sick-plant",
        )
