from datetime import date, timedelta

from app.services.daily_plan import (
    _heat_context,
    _heat_pull_forward_context,
    _rain_delay_context,
)


def test_heat_context_triggers_at_threshold() -> None:
    assert _heat_context(
        "outdoor",
        {"temp_max_c": 30},
        30,
    ) == {
        "forecast_temp_max_c": 30.0,
        "heat_sensitive_above_c": 30.0,
    }


def test_heat_context_ignores_temperature_below_threshold() -> None:
    assert _heat_context(
        "outdoor",
        {"temp_max_c": 29.9},
        30,
    ) is None


def test_heat_context_ignores_indoor_plants() -> None:
    assert _heat_context(
        "indoor",
        {"temp_max_c": 35},
        30,
    ) is None


def test_heat_pull_forward_context_scales_with_heatwave_length() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {"date": (today + timedelta(days=offset)).isoformat(), "temp_max_c": 30}
        for offset in range(5)
    ]

    assert _heat_pull_forward_context("outdoor", forecast, today, 30) == {
        "forecast_temp_max_c": 30.0,
        "heat_sensitive_above_c": 30.0,
        "heatwave_days": 5,
        "heatwave_starts_on": "2026-08-12",
        "heatwave_starts_in_days": 0,
        "pull_forward_days": 3,
    }


def test_heat_pull_forward_context_keeps_short_heatwave_to_one_day() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {"date": today.isoformat(), "temp_max_c": 30},
        {"date": (today + timedelta(days=1)).isoformat(), "temp_max_c": 31},
        {"date": (today + timedelta(days=2)).isoformat(), "temp_max_c": 29},
    ]

    assert _heat_pull_forward_context("outdoor", forecast, today, 30) == {
        "forecast_temp_max_c": 31.0,
        "heat_sensitive_above_c": 30.0,
        "heatwave_days": 2,
        "heatwave_starts_on": "2026-08-12",
        "heatwave_starts_in_days": 0,
        "pull_forward_days": 1,
    }


def test_heat_pull_forward_context_looks_at_tomorrow() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {"date": today.isoformat(), "temp_max_c": 29},
        {"date": (today + timedelta(days=1)).isoformat(), "temp_max_c": 30},
        {"date": (today + timedelta(days=2)).isoformat(), "temp_max_c": 31},
        {"date": (today + timedelta(days=3)).isoformat(), "temp_max_c": 32},
        {"date": (today + timedelta(days=4)).isoformat(), "temp_max_c": 33},
    ]

    assert _heat_pull_forward_context("outdoor", forecast, today, 30) == {
        "forecast_temp_max_c": 33.0,
        "heat_sensitive_above_c": 30.0,
        "heatwave_days": 4,
        "heatwave_starts_on": "2026-08-13",
        "heatwave_starts_in_days": 1,
        "pull_forward_days": 2,
    }


def test_rain_delay_context_scales_full_rain_streak() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {
            "date": (today + timedelta(days=offset)).isoformat(),
            "precipitation_sum_mm": 6,
            "precipitation_probability_max": 80,
        }
        for offset in range(5)
    ]

    assert _rain_delay_context("full", forecast, today) == {
        "delay_days": 3,
        "rain_days": 5,
        "rain_starts_on": "2026-08-12",
        "rain_starts_in_days": 0,
        "total_precipitation_mm": 30.0,
        "rain_reach": "full",
    }


def test_rain_delay_context_caps_partial_rain_lower() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {
            "date": (today + timedelta(days=offset)).isoformat(),
            "precipitation_sum_mm": 2,
            "precipitation_probability_max": 30,
        }
        for offset in range(4)
    ]

    assert _rain_delay_context("partial", forecast, today) == {
        "delay_days": 2,
        "rain_days": 4,
        "rain_starts_on": "2026-08-12",
        "rain_starts_in_days": 0,
        "total_precipitation_mm": 8.0,
        "rain_reach": "partial",
    }


def test_rain_delay_context_ignores_rain_starting_after_tomorrow() -> None:
    today = date(2026, 8, 12)
    forecast = [
        {
            "date": (today + timedelta(days=2)).isoformat(),
            "precipitation_sum_mm": 10,
            "precipitation_probability_max": 90,
        }
    ]

    assert _rain_delay_context("full", forecast, today) is None
