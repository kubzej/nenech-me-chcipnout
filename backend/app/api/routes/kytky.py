import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.kytky import KytkaListItem
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["kytky"])


@router.get("/kytky", response_model=list[KytkaListItem])
async def list_kytky(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[KytkaListItem]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/kytky",
            headers=headers,
            params={
                "select": (
                    "id,display_name,species_label,status,created_at,updated_at,"
                    "containers(name,zones(name,locations(name))),"
                    "care_profiles(name,scientific_name)"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [_to_list_item(row) for row in response.json()]


def _to_list_item(row: dict[str, object]) -> KytkaListItem:
    container = _nested_dict(row.get("containers"))
    zone = _nested_dict(container.get("zones"))
    location = _nested_dict(zone.get("locations"))
    care_profile = _nested_dict(row.get("care_profiles"))

    return KytkaListItem(
        id=row["id"],
        display_name=str(row["display_name"]),
        species_label=_optional_str(row.get("species_label")),
        status=str(row["status"]),
        container_name=_optional_str(container.get("name")),
        zone_name=_optional_str(zone.get("name")),
        location_name=_optional_str(location.get("name")),
        care_profile_name=_optional_str(care_profile.get("name")),
        scientific_name=_optional_str(care_profile.get("scientific_name")),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _nested_dict(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None
