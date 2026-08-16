from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_service_headers,
)
from app.services.daily_plan import refresh_daily_plan
from app.services.push import send_push_notification

_PREFS_SELECT = (
    "workspace_id,user_id,master_enabled,daily_plan_enabled,"
    "morning_time,timezone,last_daily_digest_sent_on"
)


async def run_daily_digest() -> dict[str, int]:
    """Runs on every cron tick (not gated by any per-user time): generates
    the daily plan for each workspace once, then sends the per-user daily
    digest to whoever is due for it right now."""
    headers = supabase_service_headers()
    summary = {
        "workspaces": 0,
        "checked": 0,
        "prefs_checked": 0,
        "tasks": 0,
        "pending_tasks": 0,
        "due": 0,
        "skipped_empty": 0,
        "attempted": 0,
        "sent": 0,
        "zero_sent": 0,
    }

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=30) as client:
        workspaces = await _fetch_workspaces(client, headers)

        for workspace in workspaces:
            prefs_rows = await _ensure_preferences(client, headers, workspace["id"])
            if not prefs_rows:
                continue

            summary["workspaces"] += 1
            plan = await refresh_daily_plan(headers, workspace)
            pending = [t for t in plan["tasks"] if t["status"] == "pending"]
            summary["tasks"] += len(plan["tasks"])
            summary["pending_tasks"] += len(pending)

            for prefs in prefs_rows:
                summary["checked"] += 1
                summary["prefs_checked"] += 1
                if not (prefs["master_enabled"] and prefs["daily_plan_enabled"]):
                    continue

                now_local = _now_in(prefs["timezone"])
                if not _is_due(
                    now_local, prefs["morning_time"], prefs["last_daily_digest_sent_on"]
                ):
                    continue

                summary["due"] += 1
                if not pending:
                    summary["skipped_empty"] += 1
                    await _mark_sent(
                        client,
                        headers,
                        workspace["id"],
                        prefs["user_id"],
                        "last_daily_digest_sent_on",
                        now_local.date(),
                    )
                    continue

                summary["attempted"] += 1
                sent = await send_push_notification(
                    headers,
                    workspace["id"],
                    prefs["user_id"],
                    title="Dnes",
                    body=_digest_body(pending),
                    url="/",
                    tag="daily-digest",
                )
                summary["sent"] += sent
                if sent == 0:
                    summary["zero_sent"] += 1

                await _mark_sent(
                    client,
                    headers,
                    workspace["id"],
                    prefs["user_id"],
                    "last_daily_digest_sent_on",
                    now_local.date(),
                )

    return summary


async def _fetch_workspaces(
    client: httpx.AsyncClient, headers: dict[str, str]
) -> list[dict[str, Any]]:
    response = await client.get(
        "/workspaces", headers=headers, params={"select": "id,timezone"}
    )
    raise_supabase_error(response)
    return response.json()


async def _ensure_preferences(
    client: httpx.AsyncClient, headers: dict[str, str], workspace_id: object
) -> list[dict[str, Any]]:
    """Every workspace member should get a notification_preferences row even
    if they've never opened the settings screen — otherwise the cron would
    silently never consider them."""
    members_response = await client.get(
        "/workspace_members",
        headers=headers,
        params={
            "select": "user_id",
            "workspace_id": f"eq.{workspace_id}",
            "disabled_at": "is.null",
        },
    )
    raise_supabase_error(members_response)
    member_ids = {row["user_id"] for row in members_response.json()}
    if not member_ids:
        return []

    existing_response = await client.get(
        "/notification_preferences",
        headers=headers,
        params={"select": _PREFS_SELECT, "workspace_id": f"eq.{workspace_id}"},
    )
    raise_supabase_error(existing_response)
    existing = existing_response.json()
    existing_ids = {row["user_id"] for row in existing}

    missing_ids = member_ids - existing_ids
    if missing_ids:
        insert_rows = [
            {"workspace_id": str(workspace_id), "user_id": uid} for uid in missing_ids
        ]
        insert_response = await client.post(
            "/notification_preferences",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={"select": _PREFS_SELECT},
            json=insert_rows,
        )
        raise_supabase_error(insert_response)
        existing.extend(insert_response.json())

    return existing


async def _mark_sent(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    user_id: object,
    column: str,
    sent_on: date,
) -> None:
    response = await client.patch(
        "/notification_preferences",
        headers={**headers, "Content-Type": "application/json"},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "user_id": f"eq.{user_id}",
        },
        json={column: sent_on.isoformat()},
    )
    raise_supabase_error(response)


def _now_in(timezone_name: str | None) -> datetime:
    return datetime.now(ZoneInfo(timezone_name or "Europe/Prague"))


def _is_due(
    now_local: datetime, target_time_str: str, last_sent_str: str | None
) -> bool:
    if last_sent_str and date.fromisoformat(last_sent_str) == now_local.date():
        return False
    return now_local.time() >= time.fromisoformat(target_time_str)


def _digest_body(tasks: list[dict[str, Any]]) -> str:
    count = len(tasks)
    if count == 1:
        return "Čeká na tebe 1 úkol. Kdo jinej to zalije?"
    return f"Čeká na tebe {count} úkolů. Kdo jinej je zalije?"
