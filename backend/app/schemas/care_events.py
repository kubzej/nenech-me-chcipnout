from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

CareEventType = Literal[
    "watering",
    "fertilizing",
    "checkin",
    "pest_observation",
    "treatment",
    "maintenance",
    "weather_protection",
    "photo_observation",
]

CareEventCondition = Literal[
    "ok", "dry", "wet", "wilting", "yellowing", "pests", "damaged", "unknown"
]


class CareEventItem(BaseModel):
    id: UUID
    event_type: str
    target_type: str
    kytka_id: UUID | None
    container_id: UUID | None
    occurred_at: datetime
    amount_ml: int | None
    method: str | None
    condition: str | None
    note: str | None
    created_at: datetime


class CareEventCreateRequest(BaseModel):
    kytka_id: UUID
    event_type: CareEventType
    occurred_at: datetime | None = None
    amount_ml: int | None = Field(default=None, gt=0)
    method: str | None = None
    condition: CareEventCondition | None = None
    note: str | None = None

    @field_validator("method", "note")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None
