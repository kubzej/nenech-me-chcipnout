from datetime import UTC, date, datetime
from typing import Any
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
    "completed_by,completed_at,outcome_note,recommendation_json,"
    "kytky(care_profiles(survival_watering_hint,survival_heat_hint,"
    "survival_frost_hint,survival_fertilizing_hint)),created_at"
)

_COPY_SECTION_KINDS = {"info", "action", "method", "weather", "departure"}


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
        tasks=[_to_care_task_item(row) for row in tasks],
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


def _to_care_task_item(row: object) -> CareTaskItem:
    task_row = dict(row) if isinstance(row, dict) else {}
    task_row["copy_sections"] = _copy_sections_for_task(task_row)
    task_row["instructions"] = _instructions_for_task(task_row)
    return CareTaskItem(**task_row)


def _instructions_for_task(row: dict[str, Any]) -> str | None:
    instructions = row.get("instructions")
    if isinstance(instructions, str) and instructions.strip():
        return instructions.strip()

    task_type = row.get("task_type")
    if task_type == "watering":
        return _profile_survival_hint(row, "survival_watering_hint")
    if task_type == "fertilizing":
        return _profile_survival_hint(row, "survival_fertilizing_hint")
    if task_type == "weather_protection":
        recommendation = row.get("recommendation_json")
        if isinstance(recommendation, dict):
            if "forecast_temp_min_c" in recommendation:
                return _profile_survival_hint(row, "survival_frost_hint")
            if "forecast_temp_max_c" in recommendation:
                return _profile_survival_hint(row, "survival_heat_hint")
    return None


def _copy_sections_for_task(row: dict[str, Any]) -> list[dict[str, str]]:
    recommendation = row.get("recommendation_json")
    raw_sections = (
        recommendation.get("copy_sections")
        if isinstance(recommendation, dict)
        else None
    )
    if isinstance(raw_sections, list):
        sections = []
        for raw_section in raw_sections:
            if not isinstance(raw_section, dict):
                continue
            kind = raw_section.get("kind")
            text = raw_section.get("text")
            if kind not in _COPY_SECTION_KINDS or not isinstance(text, str):
                continue
            stripped = text.strip()
            if stripped:
                sections.append({"kind": kind, "text": stripped})
        if sections:
            return sections

    legacy_sections = _legacy_copy_sections(row, recommendation)
    if legacy_sections:
        return legacy_sections

    explanation = row.get("explanation")
    if isinstance(explanation, str) and explanation.strip():
        return [{"kind": "info", "text": explanation.strip()}]
    return []


def _legacy_copy_sections(
    row: dict[str, Any], recommendation: object
) -> list[dict[str, str]]:
    if not isinstance(recommendation, dict):
        return []

    task_type = row.get("task_type")
    if task_type == "watering":
        return _legacy_watering_copy_sections(row, recommendation)
    if task_type == "fertilizing":
        return _legacy_fertilizing_copy_sections(recommendation)
    if task_type == "checkin":
        return _legacy_checkin_copy_sections(row, recommendation)
    if task_type == "pest_followup":
        return _legacy_pest_followup_copy_sections(recommendation)
    if task_type == "photo_observation":
        return _legacy_photo_copy_sections(recommendation)
    if task_type == "maintenance":
        return _legacy_maintenance_copy_sections(row, recommendation)
    if task_type == "weather_protection":
        return _legacy_weather_protection_copy_sections(recommendation)
    return []


def _legacy_watering_copy_sections(
    row: dict[str, Any], recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    sections = [{"kind": "info", "text": _legacy_watering_reason(recommendation)}]
    weather_text = _legacy_watering_weather_text(row, recommendation)
    if weather_text is not None:
        sections.append({"kind": "weather", "text": weather_text})
    return sections


def _legacy_watering_reason(recommendation: dict[str, Any]) -> str:
    days_since = recommendation.get("days_since_last_event")
    dormant_note = (
        " Má klidové období - netřeba víc."
        if recommendation.get("kytka_status_modifier") == "dormant"
        else ""
    )
    if isinstance(days_since, int):
        return f"Poslední zálivka před {_format_days_ago(days_since)}.{dormant_note}"
    return f"Zálivka zatím není zaznamenaná.{dormant_note}"


def _legacy_fertilizing_copy_sections(
    recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    days_since = recommendation.get("days_since_last_event")
    if isinstance(days_since, int):
        text = f"Poslední hnojení před {_format_days_ago(days_since)}."
    else:
        text = "Hnojení zatím není zaznamenané."
    return [{"kind": "info", "text": text}]


def _legacy_checkin_copy_sections(
    row: dict[str, Any], recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    days_since = recommendation.get("days_since_last_event")
    is_high_priority = row.get("priority") in ("high", "critical")
    if is_high_priority:
        return [
            {"kind": "info", "text": "Je pod dohledem."},
            {
                "kind": "action",
                "text": "Mrkni, jestli je lepší, stejná, nebo horší.",
            },
        ]

    if isinstance(days_since, int):
        reason = f"Poslední kontrola před {_format_days_ago(days_since)}."
    else:
        reason = "Kontrola stavu zatím není zaznamenaná."
    return [
        {"kind": "info", "text": reason},
        {"kind": "action", "text": "Zkontroluj listy, substrát a celkový stav."},
    ]


def _legacy_pest_followup_copy_sections(
    recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    days_since = recommendation.get("days_since_last_event")
    if not isinstance(days_since, int):
        return [{"kind": "action", "text": "Zkontroluj, jestli se škůdci nešíří."}]
    return [
        {
            "kind": "info",
            "text": f"Škůdci zaznamenaní před {_format_days_ago(days_since)}.",
        },
        {"kind": "action", "text": "Zkontroluj, jestli se nešíří nebo nevrátili."},
    ]


def _legacy_photo_copy_sections(recommendation: dict[str, Any]) -> list[dict[str, str]]:
    days_since = recommendation.get("days_since_last_event")
    if isinstance(days_since, int):
        reason = f"Poslední fotka před {_format_days_ago(days_since)}."
    else:
        reason = "Fotka do historie zatím není zaznamenaná."
    return [
        {"kind": "info", "text": reason},
        {"kind": "action", "text": "Vyfoť ji pro porovnání později."},
    ]


def _legacy_maintenance_copy_sections(
    row: dict[str, Any], recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    days_since = recommendation.get("days_since_last_event")
    if isinstance(days_since, int):
        reason = f"Poslední údržba před {_format_days_ago(days_since)}."
    else:
        reason = "Údržba zatím není zaznamenaná."

    explanation = row.get("explanation")
    action = (
        explanation.strip()
        if isinstance(explanation, str) and explanation.strip()
        else "Prořež, přesaď nebo otoč podle stavu."
    )
    return [{"kind": "info", "text": reason}, {"kind": "action", "text": action}]


def _legacy_weather_protection_copy_sections(
    recommendation: dict[str, Any]
) -> list[dict[str, str]]:
    temp_min = recommendation.get("forecast_temp_min_c")
    temp_max = recommendation.get("forecast_temp_max_c")
    if isinstance(temp_min, int | float):
        sections = [{"kind": "weather", "text": f"Dnes bude {float(temp_min):g} °C."}]
        threshold = recommendation.get("cold_sensitive_below_c")
        if isinstance(threshold, int | float):
            sections.append(
                {
                    "kind": "info",
                    "text": (
                        f"Práh citlivosti profilu je {float(threshold):g} °C "
                        "pro mráz/chlad."
                    ),
                }
            )
        sections.append(
            {"kind": "action", "text": "Dej ji dovnitř, nebo ji aspoň přikryj."}
        )
        return sections

    if isinstance(temp_max, int | float):
        sections = [{"kind": "weather", "text": f"Dnes bude {float(temp_max):g} °C."}]
        threshold = recommendation.get("heat_sensitive_above_c")
        if isinstance(threshold, int | float):
            sections.append(
                {
                    "kind": "info",
                    "text": (
                        f"Práh citlivosti profilu je {float(threshold):g} °C "
                        "pro horko."
                    ),
                }
            )
        sections.append(
            {"kind": "action", "text": "Dej ji do stínu a zkontroluj zálivku."}
        )
        return sections

    return []


def _profile_survival_hint(row: dict[str, Any], key: str) -> str | None:
    kytka = row.get("kytky")
    care_profile = (
        kytka.get("care_profiles") if isinstance(kytka, dict) else None
    )
    hint = (
        care_profile.get(key)
        if isinstance(care_profile, dict)
        else None
    )
    if isinstance(hint, str) and hint.strip():
        return hint.strip()
    return None


def _legacy_watering_weather_text(
    row: dict[str, Any], recommendation: dict[str, Any]
) -> str | None:
    temp_max = recommendation.get("forecast_temp_max_c")
    if not isinstance(temp_max, int | float):
        return None

    pulled_forward = recommendation.get("pulled_forward_for_heat") is True
    heatwave_days = recommendation.get("heatwave_days")
    if pulled_forward:
        if isinstance(heatwave_days, int) and heatwave_days > 1:
            starts_in_days = _days_until_heatwave(row, recommendation)
            heatwave_length = _format_day_count(heatwave_days)
            if starts_in_days == 0:
                return (
                    f"Čeká nás {heatwave_length} horka až {temp_max:g} °C. "
                    "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
                )
            if starts_in_days == 1:
                return (
                    f"Od zítřka bude {heatwave_length} horko až {temp_max:g} °C. "
                    "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
                )
            return (
                f"Blíží se {heatwave_length} horka až {temp_max:g} °C. "
                "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
            )
        return (
            f"Dnes má být {temp_max:g} °C. Zálivka je proto posunutá o den "
            "dopředu. Zalij ráno nebo večer."
        )

    return f"Dnes má být {temp_max:g} °C. Zalij ráno nebo večer."


def _days_until_heatwave(
    row: dict[str, Any], recommendation: dict[str, Any]
) -> int | None:
    task_date_value = row.get("task_date")
    starts_on_value = recommendation.get("heatwave_starts_on")
    if isinstance(task_date_value, date):
        task_date = task_date_value
    elif isinstance(task_date_value, str):
        try:
            task_date = date.fromisoformat(task_date_value)
        except ValueError:
            return None
    else:
        return None

    if not isinstance(starts_on_value, str):
        return None
    try:
        starts_on = date.fromisoformat(starts_on_value)
    except ValueError:
        return None
    return (starts_on - task_date).days


def _format_day_count(days: int) -> str:
    if days == 1:
        return "1 den"
    if 2 <= days <= 4:
        return f"{days} dny"
    return f"{days} dní"


def _format_days_ago(days: int) -> str:
    if days == 1:
        return "1 dnem"
    return f"{days} dny"




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
    tasks_by_id = {str(task["id"]): _to_care_task_item(task) for task in tasks}

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
    return _to_care_task_item(row)


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
