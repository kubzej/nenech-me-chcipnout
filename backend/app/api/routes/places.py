from collections import Counter
from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.supabase_rest import (
    raise_supabase_error,
    supabase_rest_url,
    supabase_user_headers,
)
from app.schemas.places import (
    ContainerCreateRequest,
    ContainerListItem,
    LocationCreateRequest,
    LocationItem,
    PlaceContainerOverview,
    PlaceLocationOverview,
    PlaceZoneOverview,
    ZoneCreateRequest,
    ZoneItem,
)
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["places"])


@router.get("/places/overview", response_model=list[PlaceLocationOverview])
async def places_overview(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[PlaceLocationOverview]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        locations_response = await client.get(
            "/locations",
            headers=headers,
            params={
                "select": (
                    "id,name,address_label,latitude,longitude,timezone,notes,"
                    "created_at,updated_at"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.asc",
            },
        )
        raise_supabase_error(locations_response)

        zones_response = await client.get(
            "/zones",
            headers=headers,
            params={
                "select": (
                    "id,location_id,name,environment,light_exposure,rain_reach,"
                    "wind_exposure,notes,created_at,updated_at"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.asc",
            },
        )
        raise_supabase_error(zones_response)

        containers_response = await client.get(
            "/containers",
            headers=headers,
            params={
                "select": (
                    "id,zone_id,name,container_type,approx_volume_l,drainage,"
                    "self_watering,notes,created_at,updated_at"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.asc",
            },
        )
        raise_supabase_error(containers_response)

        kytky_response = await client.get(
            "/kytky",
            headers=headers,
            params={
                "select": "container_id",
                "workspace_id": f"eq.{workspace['id']}",
            },
        )
        raise_supabase_error(kytky_response)

    kytky_counts = Counter(
        str(row["container_id"]) for row in kytky_response.json()
    )

    return _to_places_overview(
        locations_response.json(),
        zones_response.json(),
        containers_response.json(),
        kytky_counts,
    )


@router.get("/places/locations", response_model=list[LocationItem])
async def list_locations(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[LocationItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/locations",
            headers=headers,
            params={
                "select": (
                    "id,name,address_label,latitude,longitude,timezone,notes,"
                    "created_at,updated_at"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [_to_location_item(row) for row in response.json()]


@router.post("/places/locations", response_model=LocationItem)
async def create_location(
    payload: LocationCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> LocationItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _insert_one(client, "/locations", headers, insert_payload)

    return _to_location_item(row)


@router.patch("/places/locations/{location_id}", response_model=LocationItem)
async def update_location(
    location_id: UUID,
    payload: LocationCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> LocationItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _update_one(
            client, "/locations", headers, location_id, workspace["id"], update_payload
        )

    return _to_location_item(row)


@router.delete(
    "/places/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_location(
    location_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    read_headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        zones_response = await client.get(
            "/zones",
            headers=read_headers,
            params={
                "select": "id",
                "location_id": f"eq.{location_id}",
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
            },
        )
        raise_supabase_error(zones_response)
        zone_ids = [str(row["id"]) for row in zones_response.json()]

        container_ids: list[str] = []
        if zone_ids:
            containers_response = await client.get(
                "/containers",
                headers=read_headers,
                params={
                    "select": "id",
                    "zone_id": f"in.({','.join(zone_ids)})",
                    "workspace_id": f"eq.{workspace['id']}",
                    "archived_at": "is.null",
                },
            )
            raise_supabase_error(containers_response)
            container_ids = [str(row["id"]) for row in containers_response.json()]

        await _delete_kytky_in_containers(
            client, headers, container_ids, workspace["id"]
        )
        await _archive_rows(
            client, "/containers", headers, container_ids, workspace["id"]
        )
        await _archive_rows(client, "/zones", headers, zone_ids, workspace["id"])
        await _archive_rows(
            client, "/locations", headers, [str(location_id)], workspace["id"]
        )


@router.get("/places/zones", response_model=list[ZoneItem])
async def list_zones(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[ZoneItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/zones",
            headers=headers,
            params={
                "select": (
                    "id,name,environment,light_exposure,rain_reach,wind_exposure,"
                    "notes,created_at,updated_at,locations(id,name)"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [_to_zone_item(row) for row in response.json()]


@router.post("/places/zones", response_model=ZoneItem)
async def create_zone(
    payload: ZoneCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ZoneItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _insert_one(client, "/zones", headers, insert_payload)
        location_response = await client.get(
            "/locations",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": "id,name",
                "id": f"eq.{row['location_id']}",
                "limit": "1",
            },
        )
        raise_supabase_error(location_response)

    locations = location_response.json()
    row["locations"] = locations[0] if locations else {}
    return _to_zone_item(row)


@router.patch("/places/zones/{zone_id}", response_model=ZoneItem)
async def update_zone(
    zone_id: UUID,
    payload: ZoneCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ZoneItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _update_one(
            client, "/zones", headers, zone_id, workspace["id"], update_payload
        )
        location_response = await client.get(
            "/locations",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": "id,name",
                "id": f"eq.{row['location_id']}",
                "limit": "1",
            },
        )
        raise_supabase_error(location_response)

    locations = location_response.json()
    row["locations"] = locations[0] if locations else {}
    return _to_zone_item(row)


@router.delete("/places/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    read_headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        containers_response = await client.get(
            "/containers",
            headers=read_headers,
            params={
                "select": "id",
                "zone_id": f"eq.{zone_id}",
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
            },
        )
        raise_supabase_error(containers_response)
        container_ids = [str(row["id"]) for row in containers_response.json()]

        await _delete_kytky_in_containers(
            client, headers, container_ids, workspace["id"]
        )
        await _archive_rows(
            client, "/containers", headers, container_ids, workspace["id"]
        )
        await _archive_rows(client, "/zones", headers, [str(zone_id)], workspace["id"])


@router.get("/places/containers", response_model=list[ContainerListItem])
async def list_containers(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[ContainerListItem]:
    workspace = await _require_workspace(current_user)
    headers = supabase_user_headers(current_user.access_token)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/containers",
            headers=headers,
            params={
                "select": (
                    "id,name,container_type,approx_volume_l,drainage,self_watering,"
                    "notes,created_at,updated_at,"
                    "zones(id,name,environment,locations(id,name,timezone))"
                ),
                "workspace_id": f"eq.{workspace['id']}",
                "archived_at": "is.null",
                "order": "created_at.desc",
            },
        )
        raise_supabase_error(response)

    return [_to_container_item(row) for row in response.json()]


@router.post("/places/containers", response_model=ContainerListItem)
async def create_container(
    payload: ContainerCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ContainerListItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    insert_payload = payload.model_dump(mode="json")
    insert_payload["workspace_id"] = str(workspace["id"])

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        row = await _insert_one(client, "/containers", headers, insert_payload)
        container_response = await client.get(
            "/containers",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": (
                    "id,name,container_type,approx_volume_l,drainage,self_watering,"
                    "notes,created_at,updated_at,"
                    "zones(id,name,environment,locations(id,name,timezone))"
                ),
                "id": f"eq.{row['id']}",
                "limit": "1",
            },
        )
        raise_supabase_error(container_response)

    containers = container_response.json()
    if not containers:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase insert returned no container readback",
        )

    return _to_container_item(containers[0])


@router.patch("/places/containers/{container_id}", response_model=ContainerListItem)
async def update_container(
    container_id: UUID,
    payload: ContainerCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ContainerListItem:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)
    update_payload = payload.model_dump(mode="json")

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        await _update_one(
            client,
            "/containers",
            headers,
            container_id,
            workspace["id"],
            update_payload,
        )
        container_response = await client.get(
            "/containers",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": (
                    "id,name,container_type,approx_volume_l,drainage,self_watering,"
                    "notes,created_at,updated_at,"
                    "zones(id,name,environment,locations(id,name,timezone))"
                ),
                "id": f"eq.{container_id}",
                "limit": "1",
            },
        )
        raise_supabase_error(container_response)

    containers = container_response.json()
    if not containers:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase update returned no container readback",
        )

    return _to_container_item(containers[0])


@router.delete(
    "/places/containers/{container_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_container(
    container_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    workspace = await _require_workspace(current_user)
    headers = _insert_headers(current_user)

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        await _delete_kytky_in_containers(
            client, headers, [str(container_id)], workspace["id"]
        )
        await _archive_rows(
            client, "/containers", headers, [str(container_id)], workspace["id"]
        )


async def _require_workspace(current_user: CurrentUser) -> dict[str, object]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return workspace


async def _insert_one(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    payload: dict[str, object],
) -> dict[str, object]:
    response = await client.post(path, headers=headers, json=payload)
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase insert returned no rows for {path}",
        )

    return rows[0]


async def _update_one(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    row_id: UUID,
    workspace_id: object,
    payload: dict[str, object],
) -> dict[str, object]:
    response = await client.patch(
        path,
        headers=headers,
        params={"id": f"eq.{row_id}", "workspace_id": f"eq.{workspace_id}"},
        json=payload,
    )
    raise_supabase_error(response)

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Row not found in {path}",
        )

    return rows[0]


async def _archive_rows(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    ids: list[str],
    workspace_id: object,
) -> None:
    if not ids:
        return

    response = await client.patch(
        path,
        headers=headers,
        params={"id": f"in.({','.join(ids)})", "workspace_id": f"eq.{workspace_id}"},
        json={"archived_at": datetime.now(UTC).isoformat()},
    )
    raise_supabase_error(response)


async def _delete_kytky_in_containers(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    container_ids: list[str],
    workspace_id: object,
) -> None:
    """Containers are archived, not hard-deleted — but a kytka can't
    usefully survive its container disappearing from Places, so deleting a
    container (directly, or via its zone/location) takes its kytky with it.
    care_tasks/care_events/plant_photos cascade off kytky automatically
    (20260807150000_kytky_hard_delete.sql)."""
    if not container_ids:
        return

    response = await client.delete(
        "/kytky",
        headers=headers,
        params={
            "container_id": f"in.({','.join(container_ids)})",
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    raise_supabase_error(response)


def _to_places_overview(
    location_rows: list[dict[str, object]],
    zone_rows: list[dict[str, object]],
    container_rows: list[dict[str, object]],
    kytky_counts: dict[str, int],
) -> list[PlaceLocationOverview]:
    containers_by_zone: dict[str, list[PlaceContainerOverview]] = {}
    for row in container_rows:
        zone_id = str(row["zone_id"])
        containers_by_zone.setdefault(zone_id, []).append(
            PlaceContainerOverview(
                id=row["id"],
                name=str(row["name"]),
                container_type=str(row["container_type"]),
                approx_volume_l=_optional_float(row.get("approx_volume_l")),
                drainage=str(row["drainage"]),
                self_watering=bool(row["self_watering"]),
                notes=_optional_str(row.get("notes")),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                kytky_count=kytky_counts.get(str(row["id"]), 0),
            ),
        )

    zones_by_location: dict[str, list[PlaceZoneOverview]] = {}
    for row in zone_rows:
        location_id = str(row["location_id"])
        zones_by_location.setdefault(location_id, []).append(
            PlaceZoneOverview(
                id=row["id"],
                name=str(row["name"]),
                environment=str(row["environment"]),
                light_exposure=str(row["light_exposure"]),
                rain_reach=str(row["rain_reach"]),
                wind_exposure=str(row["wind_exposure"]),
                notes=_optional_str(row.get("notes")),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                containers=containers_by_zone.get(str(row["id"]), []),
            ),
        )

    return [
        PlaceLocationOverview(
            id=row["id"],
            name=str(row["name"]),
            address_label=_optional_str(row.get("address_label")),
            latitude=_optional_float(row.get("latitude")),
            longitude=_optional_float(row.get("longitude")),
            timezone=str(row["timezone"]),
            notes=_optional_str(row.get("notes")),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            zones=zones_by_location.get(str(row["id"]), []),
        )
        for row in location_rows
    ]


def _insert_headers(current_user: CurrentUser) -> dict[str, str]:
    return {
        **supabase_user_headers(current_user.access_token),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _to_location_item(row: dict[str, object]) -> LocationItem:
    return LocationItem(
        id=row["id"],
        name=str(row["name"]),
        address_label=_optional_str(row.get("address_label")),
        latitude=_optional_float(row.get("latitude")),
        longitude=_optional_float(row.get("longitude")),
        timezone=str(row["timezone"]),
        notes=_optional_str(row.get("notes")),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_zone_item(row: dict[str, object]) -> ZoneItem:
    location = _nested_dict(row.get("locations"))

    return ZoneItem(
        id=row["id"],
        name=str(row["name"]),
        environment=str(row["environment"]),
        light_exposure=str(row["light_exposure"]),
        rain_reach=str(row["rain_reach"]),
        wind_exposure=str(row["wind_exposure"]),
        notes=_optional_str(row.get("notes")),
        location_id=location["id"],
        location_name=str(location["name"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_container_item(row: dict[str, object]) -> ContainerListItem:
    zone = _nested_dict(row.get("zones"))
    location = _nested_dict(zone.get("locations"))

    return ContainerListItem(
        id=row["id"],
        name=str(row["name"]),
        container_type=str(row["container_type"]),
        approx_volume_l=_optional_float(row.get("approx_volume_l")),
        drainage=str(row["drainage"]),
        self_watering=bool(row["self_watering"]),
        notes=_optional_str(row.get("notes")),
        zone_id=zone["id"],
        zone_name=str(zone["name"]),
        environment=str(zone["environment"]),
        location_id=location["id"],
        location_name=str(location["name"]),
        timezone=str(location["timezone"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _nested_dict(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None


def _optional_float(value: object) -> float | None:
    return float(value) if value is not None else None
