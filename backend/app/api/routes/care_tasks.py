from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.care_tasks import (
    ActiveAbsenceItem,
    CareTaskCompleteGroupItem,
    CareTaskCompleteGroupRequest,
    CareTaskCompleteGroupResponse,
    CareTaskCompleteRequest,
    CareTaskCompleteResponse,
    CareTaskItem,
    CareTaskSkipRequest,
    DailyPlanResponse,
    LightMismatchItem,
    ProfileLessKytkaItem,
)
from app.services.daily_plan import read_daily_plan, refresh_daily_plan
from app.services.kytka_status import maybe_set_status
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["care-tasks"])

_SELECT = (
    "id,task_date,task_type,target_type,kytka_id,container_id,status,priority,"
    "source,title,instructions,explanation,recommended_amount_ml,due_at,"
    "completed_by,completed_at,outcome_note,created_at"
)


@router.get("/care-tasks/today", response_model=DailyPlanResponse)
async def get_today_plan(
    current_user: CurrentUser = Depends(get_current_user),
) -> DailyPlanResponse:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    result = await read_daily_plan(headers, workspace)

    return _to_daily_plan_response(result)


@router.post("/care-tasks/today/refresh", response_model=DailyPlanResponse)
async def refresh_today_plan(
    current_user: CurrentUser = Depends(get_current_user),
) -> DailyPlanResponse:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    result = await refresh_daily_plan(headers, workspace)

    return _to_daily_plan_response(result)


def _to_daily_plan_response(result: dict[str, object]) -> DailyPlanResponse:
    tasks = result["tasks"]
    profile_less_kytky = result["profile_less_kytky"]
    active_absences = result["active_absences"]
    light_mismatches = result["light_mismatches"]

    return DailyPlanResponse(
        tasks=[CareTaskItem(**row) for row in tasks],
        profile_less_kytky=[
            ProfileLessKytkaItem(**row) for row in profile_less_kytky
        ],
        everyone_away_today=bool(result["everyone_away_today"]),
        active_absences=[
            ActiveAbsenceItem(**row) for row in active_absences
        ],
        light_mismatches=[
            LightMismatchItem(**row) for row in light_mismatches
        ],
    )


@router.post("/care-tasks/{task_id}/complete", response_model=CareTaskCompleteResponse)
async def complete_care_task(
    task_id: UUID,
    payload: CareTaskCompleteRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareTaskCompleteResponse:
    group = await _complete_care_tasks(
        CareTaskCompleteGroupRequest(task_ids=[task_id], **payload.model_dump()),
        current_user,
    )
    if not group.items:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No task completion returned",
        )

    first = group.items[0]
    return CareTaskCompleteResponse(
        task=first.task,
        event_id=first.event_id,
        photo_id=first.photo_id,
    )


@router.post("/care-tasks/complete", response_model=CareTaskCompleteGroupResponse)
async def complete_care_tasks(
    payload: CareTaskCompleteGroupRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareTaskCompleteGroupResponse:
    return await _complete_care_tasks(payload, current_user)


async def _complete_care_tasks(
    payload: CareTaskCompleteGroupRequest,
    current_user: CurrentUser,
) -> CareTaskCompleteGroupResponse:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)
    rpc_payload = {
        "p_task_ids": [str(task_id) for task_id in payload.task_ids],
        "p_event_type": payload.event_type,
        "p_amount_ml": payload.amount_ml,
        "p_method": payload.method,
        "p_condition": payload.condition,
        "p_note": payload.note,
        "p_photo_storage_path": payload.photo_storage_path,
        "p_photo_note": payload.photo_note,
        "p_photo_health_snapshot": payload.photo_health_snapshot,
    }

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.post(
            "/rpc/complete_care_tasks",
            headers={**headers, "Content-Type": "application/json"},
            json=rpc_payload,
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase RPC returned no completed tasks",
        )

    completed_task_ids = [UUID(str(row["task_id"])) for row in rows]
    tasks = await _read_tasks(headers, completed_task_ids, workspace["id"])
    tasks_by_id = {str(task["id"]): CareTaskItem(**task) for task in tasks}

    if payload.event_type in ("checkin", "pest_observation"):
        for task in tasks:
            if task["kytka_id"] is None:
                continue
            await maybe_set_status(
                headers,
                workspace["id"],
                UUID(str(task["kytka_id"])),
                payload.event_type,
                payload.condition,
                actor_user_id=current_user.user_id,
            )

    return CareTaskCompleteGroupResponse(
        items=[
            CareTaskCompleteGroupItem(
                task=tasks_by_id[str(row["task_id"])],
                event_id=UUID(str(row["event_id"])),
                photo_id=(
                    UUID(str(row["photo_id"]))
                    if row.get("photo_id") is not None
                    else None
                ),
            )
            for row in rows
            if str(row["task_id"]) in tasks_by_id
        ]
    )


async def _read_tasks(
    headers: dict[str, str], task_ids: list[UUID], workspace_id: object
) -> list[dict[str, object]]:
    if not task_ids:
        return []

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/care_tasks",
            headers=headers,
            params={
                "select": _SELECT,
                "id": f"in.({','.join(str(task_id) for task_id in task_ids)})",
                "workspace_id": f"eq.{workspace_id}",
            },
        )
        raise_supabase_error(response)

    return response.json()


@router.post("/care-tasks/{task_id}/skip", response_model=CareTaskItem)
async def skip_care_task(
    task_id: UUID,
    payload: CareTaskSkipRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareTaskItem:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    row = await _patch_task(
        headers,
        task_id,
        workspace["id"],
        {
            "status": "skipped",
            "completed_by": str(current_user.user_id),
            "completed_at": _now_iso(),
            "outcome_note": payload.outcome_note,
        },
    )
    return CareTaskItem(**row)


async def _require_workspace(current_user: CurrentUser) -> dict[str, object]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return workspace


async def _patch_task(
    headers: dict[str, str],
    task_id: UUID,
    workspace_id: object,
    payload: dict[str, object],
) -> dict[str, object]:
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.patch(
            "/care_tasks",
            headers={
                **headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{task_id}",
                "workspace_id": f"eq.{workspace_id}",
                "select": _SELECT,
            },
            json=payload,
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    return rows[0]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
