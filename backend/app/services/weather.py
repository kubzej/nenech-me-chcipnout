import httpx
from fastapi import HTTPException, status


async def fetch_forecast_json(
    latitude: float, longitude: float, timezone: str
) -> dict[str, object]:
    """Raw Open-Meteo forecast call, shared by the weather route and the
    daily plan generator so both read from exactly one HTTP call shape."""
    async with httpx.AsyncClient(
        base_url="https://api.open-meteo.com", timeout=12
    ) as client:
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

    return response.json()
