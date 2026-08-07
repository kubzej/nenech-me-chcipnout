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
from app.schemas.weather import LocationWeatherForecast, WeatherCurrent, WeatherDay
from app.services.workspaces import get_first_workspace

router = APIRouter(prefix="/api", tags=["weather"])


@router.get(
    "/weather/locations/{location_id}/forecast",
    response_model=LocationWeatherForecast,
)
async def location_weather_forecast(
    location_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> LocationWeatherForecast:
    workspace = await _require_workspace(current_user)
    location = await _require_location(location_id, workspace["id"], current_user)

    latitude = _required_float(location.get("latitude"), "Location has no latitude")
    longitude = _required_float(location.get("longitude"), "Location has no longitude")
    timezone = str(location["timezone"])

    async with httpx.AsyncClient(base_url="https://api.open-meteo.com", timeout=12) as client:
        response = await client.get(
            "/v1/forecast",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "timezone": timezone,
                "forecast_days": 7,
                "current": ",".join(
                    [
                        "temperature_2m",
                        "relative_humidity_2m",
                        "precipitation",
                        "weather_code",
                        "wind_speed_10m",
                    ],
                ),
                "daily": ",".join(
                    [
                        "weather_code",
                        "temperature_2m_max",
                        "temperature_2m_min",
                        "precipitation_sum",
                        "precipitation_probability_max",
                        "et0_fao_evapotranspiration",
                    ],
                ),
            },
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Open-Meteo request failed: {response.status_code} {response.text}",
        )

    forecast = response.json()
    return LocationWeatherForecast(
        location_id=location["id"],
        location_name=str(location["name"]),
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
        current=_to_current(forecast.get("current")),
        daily=_to_daily(forecast.get("daily")),
        source="Open-Meteo",
        fetched_at=datetime.now(UTC),
    )


async def _require_workspace(current_user: CurrentUser) -> dict[str, object]:
    workspace = await get_first_workspace(current_user)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace found",
        )

    return workspace


async def _require_location(
    location_id: UUID,
    workspace_id: object,
    current_user: CurrentUser,
) -> dict[str, object]:
    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/locations",
            headers=supabase_user_headers(current_user.access_token),
            params={
                "select": "id,name,latitude,longitude,timezone",
                "id": f"eq.{location_id}",
                "workspace_id": f"eq.{workspace_id}",
                "archived_at": "is.null",
                "limit": "1",
            },
        )
        raise_supabase_error(response)

    locations = response.json()
    if not locations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    return locations[0]


def _required_float(value: object, message: str) -> float:
    if value is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return float(value)


def _to_current(value: object) -> WeatherCurrent | None:
    if not isinstance(value, dict):
        return None

    return WeatherCurrent(
        time=str(value["time"]),
        temperature_2m=_optional_float(value.get("temperature_2m")),
        relative_humidity_2m=_optional_float(value.get("relative_humidity_2m")),
        precipitation=_optional_float(value.get("precipitation")),
        weather_code=_optional_int(value.get("weather_code")),
        wind_speed_10m=_optional_float(value.get("wind_speed_10m")),
    )


def _to_daily(value: object) -> list[WeatherDay]:
    if not isinstance(value, dict):
        return []

    dates = _list(value.get("time"))
    weather_codes = _list(value.get("weather_code"))
    temp_max = _list(value.get("temperature_2m_max"))
    temp_min = _list(value.get("temperature_2m_min"))
    precipitation = _list(value.get("precipitation_sum"))
    precipitation_probability = _list(value.get("precipitation_probability_max"))
    evapotranspiration = _list(value.get("et0_fao_evapotranspiration"))

    days: list[WeatherDay] = []
    for index, date in enumerate(dates):
        days.append(
            WeatherDay(
                date=str(date),
                weather_code=_optional_int(_at(weather_codes, index)),
                temp_min_c=_optional_float(_at(temp_min, index)),
                temp_max_c=_optional_float(_at(temp_max, index)),
                precipitation_sum_mm=_optional_float(_at(precipitation, index)),
                precipitation_probability_max=_optional_float(
                    _at(precipitation_probability, index),
                ),
                et0_mm=_optional_float(_at(evapotranspiration, index)),
            ),
        )

    return days


def _list(value: object) -> list[object]:
    return value if isinstance(value, list) else []


def _at(values: list[object], index: int) -> object | None:
    return values[index] if index < len(values) else None


def _optional_float(value: object) -> float | None:
    return float(value) if value is not None else None


def _optional_int(value: object) -> int | None:
    return int(value) if value is not None else None
