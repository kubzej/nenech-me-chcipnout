from uuid import UUID

import httpx

from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
)

_STATUS_EVENT_TYPES = {"checkin", "pest_observation"}
_SETTABLE_STATUSES = {"ok", "monitoring", "sick"}


async def maybe_set_status(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    event_type: str,
    condition: str | None,
) -> None:
    """"Jak na tom je?" on a checkin/pest_observation directly sets the
    Kytka's status — no inferred symptom rules, no precondition on the
    current status (a dormant or already-sick Kytka reacts exactly like
    an ok one). Dormant/archived stay untouched here — always manual via
    Upravit kytku.
    """
    if event_type not in _STATUS_EVENT_TYPES or condition not in _SETTABLE_STATUSES:
        return

    await _set_status_if_changed(headers, workspace_id, kytka_id, condition)


async def escalate_to_monitoring(
    headers: dict[str, str], workspace_id: object, kytka_id: UUID
) -> None:
    """Escalate a Kytka to monitoring due to prolonged watering neglect."""
    await _patch_status_if_current(headers, workspace_id, kytka_id, "ok", "monitoring")


async def _set_status_if_changed(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    new_status: str,
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
                "status": f"neq.{new_status}",
                "select": "id,display_name",
            },
            json={"status": new_status},
        )
        raise_supabase_error(response)

    rows = response.json()
    return rows[0] if rows else None


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
