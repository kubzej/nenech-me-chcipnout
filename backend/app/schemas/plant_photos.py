from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.care_events import CareEventCondition


class PlantPhotoItem(BaseModel):
    id: UUID
    kytka_id: UUID
    storage_bucket: str
    storage_path: str
    captured_at: datetime | None
    note: str | None
    health_snapshot: str | None
    care_event_id: UUID | None
    created_at: datetime


class PlantPhotoCreateRequest(BaseModel):
    kytka_id: UUID
    storage_path: str
    captured_at: datetime | None = None
    note: str | None = None
    health_snapshot: CareEventCondition | None = None
    care_event_id: UUID | None = None

    @field_validator("storage_path")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Must not be empty")

        return stripped

    @field_validator("note")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None
