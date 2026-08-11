from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WeatherCurrent(BaseModel):
    time: str
    temperature_2m: float | None
    relative_humidity_2m: float | None
    precipitation: float | None
    weather_code: int | None
    wind_speed_10m: float | None


class WeatherDay(BaseModel):
    date: str
    weather_code: int | None
    temp_min_c: float | None
    temp_max_c: float | None
    precipitation_sum_mm: float | None
    precipitation_probability_max: float | None
    et0_mm: float | None


class LocationWeatherForecast(BaseModel):
    location_id: UUID
    location_name: str
    latitude: float
    longitude: float
    timezone: str
    current: WeatherCurrent | None
    daily: list[WeatherDay]
    source: str
    fetched_at: datetime
