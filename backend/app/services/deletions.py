from collections.abc import Sequence
from uuid import UUID

import httpx

from app.core.supabase_rest import raise_supabase_error


async def detach_care_events_from_kytka_tasks(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    *,
    kytka_ids: Sequence[str | UUID] | None = None,
    container_ids: Sequence[str | UUID] | None = None,
) -> None:
    target_kytka_ids = _string_ids(kytka_ids)
    if container_ids:
        target_kytka_ids.extend(
            await _list_kytka_ids_in_containers(
                client, headers, workspace_id, _string_ids(container_ids)
            )
        )

    target_kytka_ids = sorted(set(target_kytka_ids))
    if not target_kytka_ids:
        return

    task_ids = await _list_care_task_ids_for_kytky(
        client, headers, workspace_id, target_kytka_ids
    )
    if not task_ids:
        return

    update_headers = {
        **headers,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    for batch in _chunks(task_ids):
        response = await client.patch(
            "/care_events",
            headers=update_headers,
            params={
                "workspace_id": f"eq.{workspace_id}",
                "related_task_id": f"in.({','.join(batch)})",
            },
            json={"related_task_id": None},
        )
        raise_supabase_error(response)


async def _list_kytka_ids_in_containers(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    container_ids: list[str],
) -> list[str]:
    if not container_ids:
        return []

    response = await client.get(
        "/kytky",
        headers=headers,
        params={
            "select": "id",
            "workspace_id": f"eq.{workspace_id}",
            "container_id": f"in.({','.join(container_ids)})",
        },
    )
    raise_supabase_error(response)

    return [str(row["id"]) for row in response.json()]


async def _list_care_task_ids_for_kytky(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    kytka_ids: list[str],
) -> list[str]:
    task_ids: list[str] = []
    for batch in _chunks(kytka_ids):
        response = await client.get(
            "/care_tasks",
            headers=headers,
            params={
                "select": "id",
                "workspace_id": f"eq.{workspace_id}",
                "kytka_id": f"in.({','.join(batch)})",
            },
        )
        raise_supabase_error(response)
        task_ids.extend(str(row["id"]) for row in response.json())

    return sorted(set(task_ids))


def _string_ids(ids: Sequence[str | UUID] | None) -> list[str]:
    if ids is None:
        return []

    return [str(item) for item in ids]


def _chunks(items: Sequence[str], size: int = 100) -> list[list[str]]:
    return [list(items[index : index + size]) for index in range(0, len(items), size)]
