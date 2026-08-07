from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class KytkaListItem(BaseModel):
    id: UUID
    container_id: UUID
    display_name: str
    species_label: str | None
    status: str
    acquired_on: date | None
    notes: str | None
    container_name: str | None
    zone_name: str | None
    location_name: str | None
    care_profile_name: str | None
    scientific_name: str | None
    created_at: datetime
    updated_at: datetime


class KytkaCreateRequest(BaseModel):
    container_id: UUID
    display_name: str = Field(min_length=1, max_length=120)
    species_label: str | None = Field(default=None, max_length=160)
    status: Literal["ok", "monitoring", "sick", "dormant", "dead"] = "ok"
    acquired_on: date | None = None
    notes: str | None = None

    @field_validator("display_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Must not be empty")

        return stripped

    @field_validator("species_label", "notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None
