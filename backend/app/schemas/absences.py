from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


class AbsenceItem(BaseModel):
    id: UUID
    user_id: UUID
    starts_on: date
    ends_on: date
    reason: str | None
    suppress_notifications: bool
    created_at: datetime
    updated_at: datetime


class AbsenceCreateRequest(BaseModel):
    user_id: UUID
    starts_on: date
    ends_on: date
    reason: str | None = None
    suppress_notifications: bool = True

    @field_validator("reason")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_date_range(self) -> "AbsenceCreateRequest":
        if self.starts_on > self.ends_on:
            raise ValueError("starts_on must be <= ends_on")

        return self
