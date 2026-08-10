from uuid import UUID

import httpx

from app.core.supabase_rest import raise_supabase_error, supabase_rest_url

_BAD_CONDITIONS = {"wilting", "yellowing", "pests", "damaged"}
_CONDITION_EVENT_TYPES = {"checkin", "pest_observation"}


async def maybe_transition_from_condition(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    event_type: str,
    condition: str | None,
) -> None:
    """Auto-transition a Kytka's status based on a just-logged condition.

    Only ever moves ok<->monitoring. Never touches sick/dormant/dead —
    those stay manual-only, matching the product's "not exclusively
    automatic" status principle.
    """
    if condition is None or event_type not in _CONDITION_EVENT_TYPES:
        return

    if condition in _BAD_CONDITIONS:
        await _patch_status_if_current(
            headers, workspace_id, kytka_id, "ok", "monitoring"
        )
    elif condition == "ok":
        await _patch_status_if_current(
            headers, workspace_id, kytka_id, "monitoring", "ok"
        )


async def escalate_to_monitoring(
    headers: dict[str, str], workspace_id: object, kytka_id: UUID
) -> None:
    """Escalate a Kytka to monitoring due to prolonged watering neglect."""
    await _patch_status_if_current(headers, workspace_id, kytka_id, "ok", "monitoring")


async def _patch_status_if_current(
    headers: dict[str, str],
    workspace_id: object,
    kytka_id: UUID,
    from_status: str,
    to_status: str,
) -> None:
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/kytky",
            headers={**headers, "Content-Type": "application/json"},
            params={
                "id": f"eq.{kytka_id}",
                "workspace_id": f"eq.{workspace_id}",
                "status": f"eq.{from_status}",
            },
            json={"status": to_status},
        )
        raise_supabase_error(response)
