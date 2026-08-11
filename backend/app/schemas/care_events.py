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
    "photo_observation",
]

# Logging a checkin/pest_observation can directly set the Kytka's status —
# "Jak na tom je?" (OK / Sledovat / Nemocná), no inferred symptom taxonomy.
# Older rows may still carry the legacy values (dry/wet/wilting/...); those
# are read-only history now, never written by current app code.
CareEventCondition = Literal["ok", "monitoring", "sick"]


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
    recorded_by: UUID
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
