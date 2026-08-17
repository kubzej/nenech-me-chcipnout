import httpx
import pytest

from app.services.deletions import detach_care_events_from_kytka_tasks


@pytest.mark.asyncio
async def test_detach_care_events_from_kytka_tasks_clears_related_task_ids() -> None:
    client = _FakeClient(task_ids=["task-1", "task-2"])

    await detach_care_events_from_kytka_tasks(
        client,
        {"Authorization": "Bearer token"},
        "workspace-1",
        kytka_ids=["kytka-1"],
    )

    assert client.calls == [
        (
            "GET",
            "/care_tasks",
            {
                "select": "id",
                "workspace_id": "eq.workspace-1",
                "kytka_id": "in.(kytka-1)",
            },
            None,
        ),
        (
            "PATCH",
            "/care_events",
            {
                "workspace_id": "eq.workspace-1",
                "related_task_id": "in.(task-1,task-2)",
            },
            {"related_task_id": None},
        ),
    ]


@pytest.mark.asyncio
async def test_detach_care_events_from_container_kytky_finds_kytky_first() -> None:
    client = _FakeClient(kytka_ids=["kytka-1"], task_ids=["task-1"])

    await detach_care_events_from_kytka_tasks(
        client,
        {"Authorization": "Bearer token"},
        "workspace-1",
        container_ids=["container-1"],
    )

    assert client.calls == [
        (
            "GET",
            "/kytky",
            {
                "select": "id",
                "workspace_id": "eq.workspace-1",
                "container_id": "in.(container-1)",
            },
            None,
        ),
        (
            "GET",
            "/care_tasks",
            {
                "select": "id",
                "workspace_id": "eq.workspace-1",
                "kytka_id": "in.(kytka-1)",
            },
            None,
        ),
        (
            "PATCH",
            "/care_events",
            {
                "workspace_id": "eq.workspace-1",
                "related_task_id": "in.(task-1)",
            },
            {"related_task_id": None},
        ),
    ]


class _FakeClient:
    def __init__(
        self,
        *,
        kytka_ids: list[str] | None = None,
        task_ids: list[str] | None = None,
    ) -> None:
        self.kytka_ids = kytka_ids or []
        self.task_ids = task_ids or []
        self.calls: list[
            tuple[str, str, dict[str, str], dict[str, object] | None]
        ] = []

    async def get(
        self,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str],
    ) -> httpx.Response:
        self.calls.append(("GET", path, params, None))
        if path == "/kytky":
            return httpx.Response(
                status_code=200,
                json=[{"id": kytka_id} for kytka_id in self.kytka_ids],
            )
        if path == "/care_tasks":
            return httpx.Response(
                status_code=200,
                json=[{"id": task_id} for task_id in self.task_ids],
            )

        raise AssertionError(f"Unexpected GET {path}")

    async def patch(
        self,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str],
        json: dict[str, object],
    ) -> httpx.Response:
        self.calls.append(("PATCH", path, params, json))
        return httpx.Response(status_code=204)
