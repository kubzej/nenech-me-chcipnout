from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.care_events import CareEventCondition, CareEventType

CareTaskType = Literal[
    "watering",
    "fertilizing",
    "checkin",
    "photo_observation",
    "pest_followup",
    "weather_protection",
    "maintenance",
]

CareTaskStatus = Literal[
    "pending",
    "done",
    "skipped",
    "not_done",
    "missed",
    "no_response",
    "canceled",
]

CareTaskPriority = Literal["low", "normal", "high", "critical"]

CareTaskCopySectionKind = Literal["info", "action", "method", "weather", "departure"]


class CareTaskCopySection(BaseModel):
    kind: CareTaskCopySectionKind
    text: str


class CareTaskItem(BaseModel):
    id: UUID
    task_date: date
    task_type: str
    target_type: str
    kytka_id: UUID | None
    container_id: UUID | None
    status: str
    priority: str
    source: str
    title: str
    instructions: str | None
    explanation: str | None
    recommended_amount_ml: int | None
    due_at: datetime | None
    completed_by: UUID | None
    completed_at: datetime | None
    outcome_note: str | None
    copy_sections: list[CareTaskCopySection] = Field(default_factory=list)
    created_at: datetime


class CareTaskCompleteRequest(BaseModel):
    event_type: CareEventType
    amount_ml: int | None = Field(default=None, gt=0)
    method: str | None = None
    condition: CareEventCondition | None = None
    note: str | None = None
    photo_storage_path: str | None = None
    photo_note: str | None = None
    photo_health_snapshot: str | None = None


class CareTaskCompleteResponse(BaseModel):
    task: CareTaskItem
    event_id: UUID
    photo_id: UUID | None = None


class CareTaskCompleteGroupRequest(CareTaskCompleteRequest):
    task_ids: list[UUID] = Field(min_length=1)


class CareTaskCompleteGroupItem(BaseModel):
    task: CareTaskItem
    event_id: UUID
    photo_id: UUID | None = None


class CareTaskCompleteGroupResponse(BaseModel):
    items: list[CareTaskCompleteGroupItem]


class CareTaskSkipRequest(BaseModel):
    outcome_note: str | None = None


class ActiveAbsenceItem(BaseModel):
    display_name: str | None
    ends_on: date


class LightMismatchItem(BaseModel):
    display_name: str | None
    zone_name: str | None
    light_need: str
    light_exposure: str


class ProfileLessKytkaItem(BaseModel):
    id: UUID
    display_name: str | None


class DailyPlanResponse(BaseModel):
    tasks: list[CareTaskItem]
    profile_less_kytky: list[ProfileLessKytkaItem]
    everyone_away_today: bool
    active_absences: list[ActiveAbsenceItem]
    light_mismatches: list[LightMismatchItem]
