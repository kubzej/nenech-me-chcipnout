from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class KytkaListItem(BaseModel):
    id: UUID
    display_name: str
    species_label: str | None
    status: str
    container_name: str | None
    zone_name: str | None
    location_name: str | None
    care_profile_name: str | None
    scientific_name: str | None
    created_at: datetime
    updated_at: datetime
