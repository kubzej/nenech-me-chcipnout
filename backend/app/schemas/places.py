from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class LocationItem(BaseModel):
    id: UUID
    name: str
    address_label: str | None
    latitude: float | None
    longitude: float | None
    timezone: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ZoneItem(BaseModel):
    id: UUID
    name: str
    environment: str
    light_exposure: str
    rain_reach: str
    wind_exposure: str
    notes: str | None
    location_id: UUID
    location_name: str
    created_at: datetime
    updated_at: datetime


class ContainerListItem(BaseModel):
    id: UUID
    name: str
    container_type: str
    approx_volume_l: float | None
    drainage: str
    self_watering: bool
    notes: str | None
    zone_id: UUID
    zone_name: str
    environment: str
    location_id: UUID
    location_name: str
    timezone: str
    created_at: datetime
    updated_at: datetime


class PlaceContainerOverview(BaseModel):
    id: UUID
    name: str
    container_type: str
    approx_volume_l: float | None
    drainage: str
    self_watering: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
    kytky_count: int


class PlaceZoneOverview(BaseModel):
    id: UUID
    name: str
    environment: str
    light_exposure: str
    rain_reach: str
    wind_exposure: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    containers: list[PlaceContainerOverview]


class PlaceLocationOverview(BaseModel):
    id: UUID
    name: str
    address_label: str | None
    latitude: float | None
    longitude: float | None
    timezone: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    zones: list[PlaceZoneOverview]


class LocationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address_label: str | None = Field(default=None, max_length=240)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str = Field(default="Europe/Prague", min_length=1, max_length=80)
    notes: str | None = None

    @field_validator("name", "timezone")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return _strip_required_text(value)

    @field_validator("address_label", "notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return _strip_optional_text(value)


class ZoneCreateRequest(BaseModel):
    location_id: UUID
    name: str = Field(min_length=1, max_length=120)
    environment: Literal["indoor", "outdoor", "covered_outdoor"]
    light_exposure: Literal[
        "full_sun",
        "partial_sun",
        "bright_indirect",
        "shade",
        "mixed",
        "unknown",
    ] = "unknown"
    rain_reach: Literal["full", "partial", "none", "indoor"] = "partial"
    wind_exposure: Literal["low", "medium", "high", "unknown", "indoor"] = "unknown"
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return _strip_required_text(value)

    @field_validator("notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return _strip_optional_text(value)


class ContainerCreateRequest(BaseModel):
    zone_id: UUID
    name: str = Field(min_length=1, max_length=120)
    container_type: Literal["pot", "trough", "planter", "hanging", "bed", "other"]
    approx_volume_l: float | None = Field(default=None, gt=0)
    drainage: Literal["none", "limited", "good", "unknown"] = "unknown"
    self_watering: bool = False
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return _strip_required_text(value)

    @field_validator("notes")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return _strip_optional_text(value)


def _strip_required_text(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Must not be empty")

    return stripped


def _strip_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    return stripped
