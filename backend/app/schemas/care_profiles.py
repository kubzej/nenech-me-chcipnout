from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class CareProfileItem(BaseModel):
    id: UUID
    name: str
    scientific_name: str | None
    source: str
    source_ref: str | None
    water_interval_min_days: int | None
    water_interval_max_days: int | None
    moisture_preference: str | None
    drought_tolerance: str | None
    overwatering_risk: str | None
    default_water_amount_ml: int | None
    watering_method: str | None
    light_need: str | None
    heat_sensitive_above_c: float | None
    cold_sensitive_below_c: float | None
    frost_sensitive: bool
    feeding_enabled: bool
    feeding_interval_days: int | None
    feeding_months: list[int] | None
    check_interval_days: int
    photo_interval_days: int
    pest_check_interval_days: int | None
    maintenance_interval_days: int | None
    maintenance_notes: str | None
    risk_notes: str | None
    created_at: datetime
    updated_at: datetime
    kytky_count: int


class CareProfileCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    scientific_name: str | None = Field(default=None, max_length=160)
    water_interval_min_days: int | None = Field(default=None, gt=0)
    water_interval_max_days: int | None = Field(default=None, gt=0)
    moisture_preference: (
        Literal["dry_between", "slightly_moist", "moist", "wet", "unknown"] | None
    ) = None
    drought_tolerance: Literal["low", "medium", "high", "unknown"] | None = None
    overwatering_risk: Literal["low", "medium", "high", "unknown"] | None = None
    default_water_amount_ml: int | None = Field(default=None, gt=0)
    watering_method: str | None = Field(default=None, max_length=240)
    light_need: (
        Literal["full_sun", "partial_sun", "bright_indirect", "shade", "unknown"]
        | None
    ) = None
    heat_sensitive_above_c: float | None = None
    cold_sensitive_below_c: float | None = None
    frost_sensitive: bool = True
    feeding_enabled: bool = False
    feeding_interval_days: int | None = Field(default=None, gt=0)
    feeding_months: list[int] | None = None
    check_interval_days: int = Field(default=7, gt=0)
    photo_interval_days: int = Field(default=7, gt=0)
    pest_check_interval_days: int | None = Field(default=None, gt=0)
    maintenance_interval_days: int | None = Field(default=None, gt=0)
    maintenance_notes: str | None = None
    risk_notes: str | None = None

    @field_validator("name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Must not be empty")

        return stripped

    @field_validator(
        "scientific_name", "watering_method", "maintenance_notes", "risk_notes"
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        return stripped or None

    @field_validator("feeding_months")
    @classmethod
    def validate_feeding_months(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None

        if any(month < 1 or month > 12 for month in value):
            raise ValueError("feeding_months must contain values between 1 and 12")

        return value

    @model_validator(mode="after")
    def validate_water_interval_range(self) -> "CareProfileCreateRequest":
        if (
            self.water_interval_min_days is not None
            and self.water_interval_max_days is not None
            and self.water_interval_min_days > self.water_interval_max_days
        ):
            raise ValueError(
                "water_interval_min_days must be <= water_interval_max_days"
            )

        return self
