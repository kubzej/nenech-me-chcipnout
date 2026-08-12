from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    display_name: str | None


class MeUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Must not be empty")

        return stripped


class WorkspaceBootstrapRequest(BaseModel):
    workspace_name: str = Field(default="Domácí džungle", min_length=1, max_length=120)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("workspace_name", "display_name")
    @classmethod
    def strip_non_empty(cls, value: str | None) -> str | None:
        if value is None:
            return None

        stripped = value.strip()
        if not stripped:
            raise ValueError("Must not be empty")

        return stripped


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    timezone: str
    role: str
    created_at: datetime


class WorkspaceMemberItem(BaseModel):
    user_id: UUID
    display_name: str | None
