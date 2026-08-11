from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.routes.care_events import create_care_event
from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.care_events import CareEventCreateRequest
from app.schemas.care_tasks import (
    ActiveAbsenceItem,
    CareTaskCompleteRequest,
    CareTaskCompleteResponse,
    CareTaskItem,
    CareTaskSkipRequest,
    DailyPlanResponse,
    LightMismatchItem,
)
from app.services.daily_plan import refresh_daily_plan
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

    result = await refresh_daily_plan(headers, workspace)

    return DailyPlanResponse(
        tasks=[CareTaskItem(**row) for row in result["tasks"]],
        profile_less_kytky_count=result["profile_less_kytky_count"],
        everyone_away_today=result["everyone_away_today"],
        active_absences=[
            ActiveAbsenceItem(**row) for row in result["active_absences"]
        ],
        light_mismatches=[
            LightMismatchItem(**row) for row in result["light_mismatches"]
        ],
    )


@router.post("/care-tasks/{task_id}/complete", response_model=CareTaskCompleteResponse)
async def complete_care_task(
    task_id: UUID,
    payload: CareTaskCompleteRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CareTaskCompleteResponse:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    task = await _require_task(headers, task_id, workspace["id"])
    if task["kytka_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task has no Kytka to log an event against",
        )

    event = await create_care_event(
        CareEventCreateRequest(
            kytka_id=task["kytka_id"],
            event_type=payload.event_type,
            amount_ml=payload.amount_ml,
            method=payload.method,
            condition=payload.condition,
            note=payload.note,
        ),
        current_user,
    )

    row = await _patch_task(
        headers,
        task_id,
        workspace["id"],
        {
            "status": "done",
            "completed_by": str(current_user.user_id),
            "completed_at": _now_iso(),
        },
    )
    return CareTaskCompleteResponse(task=CareTaskItem(**row), event_id=event.id)


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


async def _require_task(
    headers: dict[str, str], task_id: UUID, workspace_id: object
) -> dict[str, object]:
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/care_tasks",
            headers=headers,
            params={
                "select": "id,kytka_id",
                "id": f"eq.{task_id}",
                "workspace_id": f"eq.{workspace_id}",
                "limit": "1",
            },
        )
        raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    return rows[0]


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
