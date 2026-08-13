from asyncio import gather
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx

from app.core.supabase_rest import raise_supabase_error, supabase_rest_url
from app.services.kytka_status import escalate_to_monitoring
from app.services.weather import fetch_forecast_json

# Starting thresholds — expected to be tuned once this has real usage,
# not treated as final (see context.md).
_RAIN_SKIP_MM = 5.0
_RAIN_SKIP_PROBABILITY = 60.0
_RAIN_PARTIAL_MM = 2.0
_RAIN_LOOKAHEAD_DAYS = 5
_RAIN_FULL_DELAY_MAX_DAYS = 3
_RAIN_PARTIAL_DELAY_MAX_DAYS = 2
_DORMANT_MULTIPLIER = 3
_NEGLECT_ESCALATION_MULTIPLIER = 2
_ABSENCE_LOOKAHEAD_DAYS = 3
_HEATWAVE_LOOKAHEAD_DAYS = 5
_HEATWAVE_MIN_STREAK_DAYS = 2
_HEATWAVE_PULL_FORWARD_MAX_DAYS = 3
_INSPECTION_EVENT_TYPES = ("checkin", "pest_observation", "treatment")
_WEATHER_CACHE_HOURS = 3
_FERTILIZING_FALLBACK_HINT = (
    "Nehnoj suchý substrát. Když si nejsi jistý, radši vynech."
)

_TASK_SELECT = (
    "id,task_date,task_type,target_type,kytka_id,container_id,status,priority,"
    "source,title,instructions,explanation,recommended_amount_ml,due_at,"
    "completed_by,completed_at,outcome_note,alerted_at,recommendation_json,"
    "kytky(care_profiles(survival_watering_hint,survival_heat_hint,"
    "survival_frost_hint,survival_fertilizing_hint)),created_at"
)


async def refresh_daily_plan(
    headers: dict[str, str], workspace: dict[str, Any]
) -> dict[str, Any]:
    workspace_id = workspace["id"]
    tz = ZoneInfo(str(workspace.get("timezone") or "Europe/Prague"))
    today = datetime.now(tz).date()

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=20) as client:
        await _rollover_missed(client, headers, workspace_id, today)

        (
            kytky,
            last_events,
            absences,
            member_count,
            existing_statuses,
        ) = await gather(
            _fetch_kytky(client, headers, workspace_id),
            _fetch_last_events(client, headers, workspace_id),
            _fetch_upcoming_absences(client, headers, workspace_id, today),
            _fetch_active_member_count(client, headers, workspace_id),
            _fetch_existing_task_statuses(client, headers, workspace_id, today),
        )

        forecasts = await _fetch_and_snapshot_weather(
            client, headers, workspace_id, kytky, today
        )

        profile_less_kytky: list[dict[str, Any]] = []
        light_mismatches: list[dict[str, Any]] = []
        for kytka in kytky:
            if kytka.get("status") == "dead":
                continue
            if kytka.get("care_profile_id") is None:
                profile_less_kytky.append(
                    {"id": kytka["id"], "display_name": kytka.get("display_name")}
                )
                continue

            mismatch = _light_mismatch(kytka)
            if mismatch is not None:
                light_mismatches.append(mismatch)

            await _generate_for_kytka(
                client,
                headers,
                workspace_id,
                kytka,
                last_events,
                absences,
                forecasts,
                today,
                existing_statuses,
            )

        response = await client.get(
            "/care_tasks",
            headers=headers,
            params={
                "select": _TASK_SELECT,
                "workspace_id": f"eq.{workspace_id}",
                "task_date": f"eq.{today.isoformat()}",
                "order": "priority.desc,created_at.asc",
            },
        )
        raise_supabase_error(response)
        tasks = response.json()

        active_today = [
            absence
            for absence in absences
            if date.fromisoformat(absence["starts_on"]) <= today
        ]
        names = await _fetch_profile_names(
            client, headers, [str(absence["user_id"]) for absence in active_today]
        )

    everyone_away = member_count > 0 and _covers_all_members(
        absences, today, member_count
    )
    active_absences = [
        {
            "display_name": names.get(str(absence["user_id"])),
            "ends_on": absence["ends_on"],
        }
        for absence in active_today
    ]

    return {
        "tasks": tasks,
        "profile_less_kytky": profile_less_kytky,
        "everyone_away_today": everyone_away,
        "active_absences": active_absences,
        "light_mismatches": light_mismatches,
    }


async def read_daily_plan(
    headers: dict[str, str], workspace: dict[str, Any]
) -> dict[str, Any]:
    workspace_id = workspace["id"]
    tz = ZoneInfo(str(workspace.get("timezone") or "Europe/Prague"))
    today = datetime.now(tz).date()

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=20) as client:
        kytky, absences, member_count = await gather(
            _fetch_kytky(client, headers, workspace_id),
            _fetch_upcoming_absences(client, headers, workspace_id, today),
            _fetch_active_member_count(client, headers, workspace_id),
        )

        profile_less_kytky: list[dict[str, Any]] = []
        light_mismatches: list[dict[str, Any]] = []
        for kytka in kytky:
            if kytka.get("status") == "dead":
                continue
            if kytka.get("care_profile_id") is None:
                profile_less_kytky.append(
                    {"id": kytka["id"], "display_name": kytka.get("display_name")}
                )
                continue

            mismatch = _light_mismatch(kytka)
            if mismatch is not None:
                light_mismatches.append(mismatch)

        response = await client.get(
            "/care_tasks",
            headers=headers,
            params={
                "select": _TASK_SELECT,
                "workspace_id": f"eq.{workspace_id}",
                "task_date": f"eq.{today.isoformat()}",
                "order": "priority.desc,created_at.asc",
            },
        )
        raise_supabase_error(response)
        tasks = response.json()

        active_today = [
            absence
            for absence in absences
            if date.fromisoformat(absence["starts_on"]) <= today
        ]
        names = await _fetch_profile_names(
            client, headers, [str(absence["user_id"]) for absence in active_today]
        )

    everyone_away = member_count > 0 and _covers_all_members(
        absences, today, member_count
    )
    active_absences = [
        {
            "display_name": names.get(str(absence["user_id"])),
            "ends_on": absence["ends_on"],
        }
        for absence in active_today
    ]

    return {
        "tasks": tasks,
        "profile_less_kytky": profile_less_kytky,
        "everyone_away_today": everyone_away,
        "active_absences": active_absences,
        "light_mismatches": light_mismatches,
    }


_UNRANKED_LIGHT_VALUES = {None, "unknown", "mixed"}


def _light_mismatch(kytka: dict[str, Any]) -> dict[str, Any] | None:
    """A kytka's care profile wants a different light level than the zone
    it's actually standing in offers. Not a task — a standing config nudge,
    recomputed fresh every refresh, same as profile_less_kytky."""
    profile = _nested(kytka.get("care_profiles"))
    light_need = profile.get("light_need")
    if light_need in _UNRANKED_LIGHT_VALUES:
        return None

    container = _nested(kytka.get("containers"))
    zone = _nested(container.get("zones"))
    light_exposure = zone.get("light_exposure")
    if light_exposure in _UNRANKED_LIGHT_VALUES:
        return None

    if light_need == light_exposure:
        return None

    return {
        "display_name": kytka.get("display_name"),
        "zone_name": zone.get("name"),
        "light_need": light_need,
        "light_exposure": light_exposure,
    }


async def _rollover_missed(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    today: date,
) -> None:
    response = await client.patch(
        "/care_tasks",
        headers={**headers, "Content-Type": "application/json"},
        params={
            "workspace_id": f"eq.{workspace_id}",
            "status": "eq.pending",
            "task_date": f"lt.{today.isoformat()}",
        },
        json={"status": "missed"},
    )
    raise_supabase_error(response)


async def _fetch_kytky(
    client: httpx.AsyncClient, headers: dict[str, str], workspace_id: object
) -> list[dict[str, Any]]:
    response = await client.get(
        "/kytky",
        headers=headers,
        params={
            "select": (
                "id,display_name,container_id,care_profile_id,status,created_at,"
                "containers(zone_id,zones(name,rain_reach,environment,"
                "light_exposure,location_id,"
                "locations(id,latitude,longitude,timezone))),"
                "care_profiles(water_interval_min_days,water_interval_max_days,"
                "default_water_amount_ml,watering_method,"
                "check_interval_days,pest_check_interval_days,photo_interval_days,"
                "maintenance_interval_days,maintenance_notes,"
                "feeding_enabled,feeding_interval_days,feeding_months,"
                "heat_sensitive_above_c,cold_sensitive_below_c,frost_sensitive,"
                "light_need,survival_watering_hint,survival_heat_hint,"
                "survival_frost_hint,survival_fertilizing_hint)"
            ),
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    raise_supabase_error(response)
    return response.json()


async def _fetch_last_events(
    client: httpx.AsyncClient, headers: dict[str, str], workspace_id: object
) -> dict[str, dict[str, datetime]]:
    """Returns {'kytka:<id>:<event_type>': latest_datetime,
    'container:<id>:<event_type>': latest_datetime}."""
    response = await client.get(
        "/care_events",
        headers=headers,
        params={
            "select": "event_type,kytka_id,container_id,occurred_at",
            "workspace_id": f"eq.{workspace_id}",
        },
    )
    raise_supabase_error(response)

    latest: dict[str, datetime] = {}
    for row in response.json():
        occurred_at = datetime.fromisoformat(row["occurred_at"])
        if row.get("kytka_id"):
            key = f"kytka:{row['kytka_id']}:{row['event_type']}"
        elif row.get("container_id"):
            key = f"container:{row['container_id']}:{row['event_type']}"
        else:
            continue

        if key not in latest or occurred_at > latest[key]:
            latest[key] = occurred_at

    return latest


async def _fetch_existing_task_statuses(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    today: date,
) -> dict[str, str]:
    """generated_key -> status, for tasks already generated today. Used so
    re-running generation never overwrites a task the user already acted
    on (done/skipped) back to pending."""
    response = await client.get(
        "/care_tasks",
        headers=headers,
        params={
            "select": "generated_key,status",
            "workspace_id": f"eq.{workspace_id}",
            "task_date": f"eq.{today.isoformat()}",
        },
    )
    raise_supabase_error(response)
    return {
        row["generated_key"]: row["status"]
        for row in response.json()
        if row.get("generated_key")
    }


async def _fetch_upcoming_absences(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    today: date,
) -> list[dict[str, Any]]:
    response = await client.get(
        "/user_absences",
        headers=headers,
        params={
            "select": "user_id,starts_on,ends_on",
            "workspace_id": f"eq.{workspace_id}",
            "ends_on": f"gte.{today.isoformat()}",
        },
    )
    raise_supabase_error(response)
    return response.json()


async def _fetch_profile_names(
    client: httpx.AsyncClient, headers: dict[str, str], user_ids: list[str]
) -> dict[str, str]:
    if not user_ids:
        return {}

    response = await client.get(
        "/profiles",
        headers=headers,
        params={
            "select": "user_id,display_name",
            "user_id": f"in.({','.join(user_ids)})",
        },
    )
    raise_supabase_error(response)
    return {row["user_id"]: row["display_name"] for row in response.json()}


async def _fetch_active_member_count(
    client: httpx.AsyncClient, headers: dict[str, str], workspace_id: object
) -> int:
    response = await client.get(
        "/workspace_members",
        headers=headers,
        params={
            "select": "user_id",
            "workspace_id": f"eq.{workspace_id}",
            "disabled_at": "is.null",
        },
    )
    raise_supabase_error(response)
    return len(response.json())


def _covers_all_members(
    absences: list[dict[str, Any]], today: date, member_count: int
) -> bool:
    covered_users: set[str] = set()
    for absence in absences:
        starts_on = date.fromisoformat(absence["starts_on"])
        ends_on = date.fromisoformat(absence["ends_on"])
        if starts_on <= today <= ends_on:
            covered_users.add(str(absence["user_id"]))

    return len(covered_users) >= member_count


async def _fetch_and_snapshot_weather(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    kytky: list[dict[str, Any]],
    today: date,
) -> dict[str, list[dict[str, Any]]]:
    """Returns {location_id: [daily forecast dicts]}.

    refresh_daily_plan runs on every Dnes load *and* every cron tick
    (~every 15 min) — calling Open-Meteo on each one blew through its
    daily request quota. Reuse a recent snapshot instead of re-fetching
    every time; weather_daily_snapshots already existed for this, it was
    just never read back.
    """
    locations: dict[str, dict[str, Any]] = {}
    for kytka in kytky:
        container = _nested(kytka.get("containers"))
        zone = _nested(container.get("zones"))
        location = _nested(zone.get("locations"))
        if location.get("id") and location.get("latitude") is not None:
            locations[str(location["id"])] = location

    forecasts: dict[str, list[dict[str, Any]]] = {}
    for location_id, location in locations.items():
        cached = await _fetch_cached_forecast(
            client, headers, workspace_id, location_id, today
        )
        if cached is not None:
            forecasts[location_id] = cached
            continue

        forecast_json = await fetch_forecast_json(
            float(location["latitude"]),
            float(location["longitude"]),
            str(location["timezone"]),
        )
        daily = _parse_daily(forecast_json.get("daily"))
        forecasts[location_id] = daily
        await _upsert_weather_snapshots(
            client, headers, workspace_id, location_id, daily
        )

    return forecasts


async def _fetch_cached_forecast(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    location_id: str,
    today: date,
) -> list[dict[str, Any]] | None:
    response = await client.get(
        "/weather_daily_snapshots",
        headers=headers,
        params={
            "select": "forecast_date,temp_min_c,temp_max_c,precipitation_mm,"
            "precipitation_probability_max,weather_code,fetched_at",
            "workspace_id": f"eq.{workspace_id}",
            "location_id": f"eq.{location_id}",
            "source": "eq.open-meteo",
            "forecast_date": f"gte.{today.isoformat()}",
            "order": "forecast_date.asc",
        },
    )
    raise_supabase_error(response)
    rows = response.json()

    todays_row = next(
        (row for row in rows if row["forecast_date"] == today.isoformat()), None
    )
    if todays_row is None:
        return None

    fetched_at = datetime.fromisoformat(todays_row["fetched_at"])
    if fetched_at < datetime.now(UTC) - timedelta(hours=_WEATHER_CACHE_HOURS):
        return None

    return [
        {
            "date": row["forecast_date"],
            "temp_min_c": row["temp_min_c"],
            "temp_max_c": row["temp_max_c"],
            "precipitation_sum_mm": row["precipitation_mm"],
            "precipitation_probability_max": row["precipitation_probability_max"],
            "weather_code": row["weather_code"],
        }
        for row in rows
    ]


def _parse_daily(daily: object) -> list[dict[str, Any]]:
    if not isinstance(daily, dict):
        return []

    dates = daily.get("time") or []
    result = []
    for index, day in enumerate(dates):
        result.append(
            {
                "date": day,
                "temp_min_c": _at(daily.get("temperature_2m_min"), index),
                "temp_max_c": _at(daily.get("temperature_2m_max"), index),
                "precipitation_sum_mm": _at(daily.get("precipitation_sum"), index),
                "precipitation_probability_max": _at(
                    daily.get("precipitation_probability_max"), index
                ),
                "weather_code": _at(daily.get("weather_code"), index),
            }
        )
    return result


def _at(values: object, index: int) -> Any:
    if not isinstance(values, list) or index >= len(values):
        return None
    return values[index]


async def _upsert_weather_snapshots(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    location_id: str,
    daily: list[dict[str, Any]],
) -> None:
    if not daily:
        return

    rows = [
        {
            "workspace_id": str(workspace_id),
            "location_id": location_id,
            "source": "open-meteo",
            "forecast_date": day["date"],
            "temp_min_c": day["temp_min_c"],
            "temp_max_c": day["temp_max_c"],
            "precipitation_mm": day["precipitation_sum_mm"],
            "precipitation_probability_max": day["precipitation_probability_max"],
            "weather_code": day["weather_code"],
        }
        for day in daily
    ]

    response = await client.post(
        "/weather_daily_snapshots",
        headers={
            **headers,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        params={"on_conflict": "location_id,source,forecast_date"},
        json=rows,
    )
    raise_supabase_error(response)


async def _generate_for_kytka(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    kytka: dict[str, Any],
    last_events: dict[str, datetime],
    absences: list[dict[str, Any]],
    forecasts: dict[str, list[dict[str, Any]]],
    today: date,
    existing_statuses: dict[str, str],
) -> None:
    kytka_id = str(kytka["id"])
    container_id = str(kytka["container_id"])
    kytka_created_on = datetime.fromisoformat(str(kytka["created_at"])).date()
    profile = _nested(kytka.get("care_profiles"))
    container = _nested(kytka.get("containers"))
    zone = _nested(container.get("zones"))
    location = _nested(zone.get("locations"))
    daily_forecast = forecasts.get(str(location.get("id")), [])
    today_forecast = next(
        (d for d in daily_forecast if d["date"] == today.isoformat()), None
    )

    status_value = kytka.get("status")
    is_dormant = status_value == "dormant"
    is_sick_or_monitoring = status_value in ("sick", "monitoring")
    priority = "high" if status_value == "sick" else "normal"
    heat_context = _heat_context(
        zone.get("environment"),
        today_forecast,
        profile.get("heat_sensitive_above_c"),
    )
    heat_pull_context = _heat_pull_forward_context(
        zone.get("environment"),
        daily_forecast,
        today,
        profile.get("heat_sensitive_above_c"),
    )

    departure = _upcoming_departure(absences, today)
    if departure is not None and priority == "normal":
        priority = "high"

    # --- Watering (fertilizing follows the same container-scoped mechanics below) ---
    min_days = profile.get("water_interval_min_days")
    max_days = profile.get("water_interval_max_days")
    watering_days_since = None

    if min_days is not None or max_days is not None:
        effective_min = _apply_dormant(min_days, is_dormant)
        effective_max = _apply_dormant(max_days, is_dormant)

        last_watered = last_events.get(f"container:{container_id}:watering")
        watering_days_since = (
            (today - last_watered.date()).days if last_watered else None
        )
        gating_days_since = (
            watering_days_since
            if watering_days_since is not None
            else (today - kytka_created_on).days
        )

        threshold = effective_min if effective_min is not None else effective_max
        rain_delay_context = _rain_delay_context(
            zone.get("rain_reach"), daily_forecast, today
        )
        rain_delay_days = (
            int(rain_delay_context["delay_days"])
            if rain_delay_context is not None
            else 0
        )

        due_by_interval = (
            threshold is not None and gating_days_since >= threshold + rain_delay_days
        )
        pulled_forward_by_heat = False
        if (
            not due_by_interval
            and threshold is not None
            and heat_pull_context is not None
        ):
            pull_forward_days = int(heat_pull_context["pull_forward_days"])
            pull_forward_threshold = max(1, threshold - pull_forward_days)
            pulled_forward_by_heat = (
                rain_delay_days == 0 and gating_days_since >= pull_forward_threshold
            )

        due = due_by_interval or pulled_forward_by_heat

        pulled_forward = False
        if not due and departure is not None and threshold is not None:
            days_until_due = threshold - gating_days_since
            days_until_departure_ends = (
                date.fromisoformat(departure["ends_on"]) - today
            ).days
            if 0 <= days_until_due <= days_until_departure_ends:
                due = True
                pulled_forward = True

        if due:
            water_amount = profile.get("default_water_amount_ml")
            copy_sections = _watering_copy_sections(watering_days_since, is_dormant)
            heat_note_context = heat_context or (
                heat_pull_context if pulled_forward_by_heat else None
            )
            if heat_note_context is not None:
                copy_sections.append(
                    {
                        "kind": "weather",
                        "text": _heat_watering_note(
                            heat_note_context, pulled_forward_by_heat
                        ),
                    }
                )
            if departure is not None:
                copy_sections.append(
                    {
                        "kind": "departure",
                        "text": _departure_note(
                            departure, today, effective_max, pulled_forward
                        ),
                    }
                )
            recommendation_json = {
                "profile_interval_days": [min_days, max_days],
                "days_since_last_event": watering_days_since,
                "weather_precipitation_mm": (
                    today_forecast.get("precipitation_sum_mm")
                    if today_forecast
                    else None
                ),
                "rain_delay_days": rain_delay_days,
                "kytka_status_modifier": "dormant" if is_dormant else None,
                "pulled_forward_for_departure": pulled_forward,
                "copy_sections": copy_sections,
            }
            if rain_delay_context is not None:
                recommendation_json.update(
                    {
                        "rain_days": rain_delay_context["rain_days"],
                        "rain_starts_on": rain_delay_context["rain_starts_on"],
                        "rain_total_precipitation_mm": rain_delay_context[
                            "total_precipitation_mm"
                        ],
                        "rain_reach": rain_delay_context["rain_reach"],
                    }
                )
            if heat_note_context is not None:
                recommendation_json.update(
                    {
                        "forecast_temp_max_c": heat_note_context[
                            "forecast_temp_max_c"
                        ],
                        "heat_sensitive_above_c": heat_note_context[
                            "heat_sensitive_above_c"
                        ],
                        "pulled_forward_for_heat": pulled_forward_by_heat,
                        "heatwave_days": heat_note_context.get("heatwave_days"),
                        "heatwave_starts_on": heat_note_context.get(
                            "heatwave_starts_on"
                        ),
                        "heat_pull_forward_days": heat_note_context.get(
                            "pull_forward_days"
                        ),
                    }
                )
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="watering",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority=priority,
                title="Zalít",
                instructions=_profile_hint(profile, "survival_watering_hint"),
                explanation=_join_copy_sections(copy_sections),
                recommended_amount_ml=water_amount,
                recommendation_json=recommendation_json,
                existing_statuses=existing_statuses,
            )

        if effective_max is not None and watering_days_since is not None:
            neglected = (
                watering_days_since > effective_max * _NEGLECT_ESCALATION_MULTIPLIER
            )
            if neglected and status_value == "ok":
                await escalate_to_monitoring(headers, workspace_id, UUID(kytka_id))

    # --- Fertilizing ---
    can_fertilize = not is_sick_or_monitoring and not is_dormant
    if (
        can_fertilize
        and profile.get("feeding_enabled")
        and _is_active_feeding_month(profile.get("feeding_months"), today)
    ):
        interval = profile.get("feeding_interval_days")
        if interval:
            last_fed = last_events.get(f"container:{container_id}:fertilizing")
            days_since = (today - last_fed.date()).days if last_fed else None
            gating_days_since = (
                days_since
                if days_since is not None
                else (today - kytka_created_on).days
            )
            if gating_days_since >= interval:
                copy_sections = _fertilizing_copy_sections(days_since)

                await _upsert_task(
                    client,
                    headers,
                    workspace_id,
                    task_type="fertilizing",
                    target_type="kytka",
                    kytka_id=kytka_id,
                    container_id=None,
                    task_date=today,
                    priority=priority,
                    title="Přihnojit",
                    instructions=_profile_hint(
                        profile, "survival_fertilizing_hint"
                    )
                    or _FERTILIZING_FALLBACK_HINT,
                    explanation=_join_copy_sections(copy_sections),
                    recommendation_json={
                        "feeding_interval_days": interval,
                        "days_since_last_event": days_since,
                        "copy_sections": copy_sections,
                    },
                    existing_statuses=existing_statuses,
                )

    # --- Checkin ---
    check_interval = profile.get("check_interval_days")
    if check_interval:
        effective_check = (
            max(1, check_interval // 2) if is_sick_or_monitoring else check_interval
        )
        last_inspection = _latest(
            last_events, [f"kytka:{kytka_id}:{t}" for t in _INSPECTION_EVENT_TYPES]
        )
        days_since = (today - last_inspection.date()).days if last_inspection else None
        gating_days_since = (
            days_since if days_since is not None else (today - kytka_created_on).days
        )
        if gating_days_since >= effective_check:
            copy_sections = _checkin_copy_sections(days_since, is_sick_or_monitoring)
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="checkin",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority=priority,
                title="Zkontrolovat",
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "check_interval_days": effective_check,
                    "days_since_last_event": days_since,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )

    # --- Pest followup ---
    pest_interval = profile.get("pest_check_interval_days")
    last_pest_observation = last_events.get(f"kytka:{kytka_id}:pest_observation")
    if pest_interval and last_pest_observation:
        days_since = (today - last_pest_observation.date()).days
        if days_since >= pest_interval:
            copy_sections = _pest_followup_copy_sections(days_since)
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="pest_followup",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority=priority,
                title="Zkontrolovat škůdce",
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "pest_check_interval_days": pest_interval,
                    "days_since_last_event": days_since,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )

    # --- Photo observation ---
    photo_interval = profile.get("photo_interval_days")
    if photo_interval:
        last_photo = last_events.get(f"kytka:{kytka_id}:photo_observation")
        days_since = (today - last_photo.date()).days if last_photo else None
        gating_days_since = (
            days_since if days_since is not None else (today - kytka_created_on).days
        )
        if gating_days_since >= photo_interval:
            copy_sections = _photo_copy_sections(days_since)
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="photo_observation",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority="low",
                title="Vyfotit",
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "photo_interval_days": photo_interval,
                    "days_since_last_event": days_since,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )

    # --- Maintenance (pruning, repotting, rotating...) ---
    maintenance_interval = profile.get("maintenance_interval_days")
    if maintenance_interval:
        last_maintenance = last_events.get(f"kytka:{kytka_id}:maintenance")
        days_since = (
            (today - last_maintenance.date()).days if last_maintenance else None
        )
        gating_days_since = (
            days_since if days_since is not None else (today - kytka_created_on).days
        )
        if gating_days_since >= maintenance_interval:
            notes = profile.get("maintenance_notes")
            copy_sections = _maintenance_copy_sections(days_since, notes)
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="maintenance",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority="low",
                title="Údržba",
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "maintenance_interval_days": maintenance_interval,
                    "days_since_last_event": days_since,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )

    # --- Weather protection (frost or heat) — only Kytky actually exposed
    # to outdoor weather; an indoor Kytka can't be "brought inside". ---
    environment = zone.get("environment")
    if environment != "indoor" and today_forecast is not None:
        temp_min = today_forecast.get("temp_min_c")
        temp_max = today_forecast.get("temp_max_c")
        cold_threshold = profile.get("cold_sensitive_below_c")
        frost_threshold = cold_threshold if cold_threshold is not None else 0
        heat_threshold = profile.get("heat_sensitive_above_c")

        frost_risk = (
            profile.get("frost_sensitive")
            and temp_min is not None
            and temp_min < frost_threshold
        )
        heat_risk = heat_context is not None

        if frost_risk:
            copy_sections = _weather_protection_copy_sections(
                "frost", temp_min, cold_threshold
            )
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="weather_protection",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority="high",
                title="Ochránit před mrazem",
                instructions=_profile_hint(profile, "survival_frost_hint"),
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "forecast_temp_min_c": temp_min,
                    "cold_sensitive_below_c": cold_threshold,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )
        elif heat_risk:
            copy_sections = _weather_protection_copy_sections(
                "heat", temp_max, heat_threshold
            )
            await _upsert_task(
                client,
                headers,
                workspace_id,
                task_type="weather_protection",
                target_type="kytka",
                kytka_id=kytka_id,
                container_id=None,
                task_date=today,
                priority="high",
                title="Ochránit před horkem",
                instructions=_profile_hint(profile, "survival_heat_hint"),
                explanation=_join_copy_sections(copy_sections),
                recommendation_json={
                    "forecast_temp_max_c": temp_max,
                    "heat_sensitive_above_c": heat_threshold,
                    "copy_sections": copy_sections,
                },
                existing_statuses=existing_statuses,
            )


def _apply_dormant(value: int | None, is_dormant: bool) -> int | None:
    if value is None:
        return None
    return value * _DORMANT_MULTIPLIER if is_dormant else value


def _rain_delay_context(
    rain_reach: object,
    daily_forecast: list[dict[str, Any]],
    today: date,
) -> dict[str, float | int | str] | None:
    if rain_reach not in ("full", "partial"):
        return None

    rainy_by_date: dict[date, float] = {}
    horizon = today + timedelta(days=_RAIN_LOOKAHEAD_DAYS - 1)
    for forecast in daily_forecast:
        forecast_date = _forecast_date(forecast.get("date"))
        if forecast_date is None or forecast_date < today or forecast_date > horizon:
            continue
        if _is_effective_rain_day(str(rain_reach), forecast):
            rainy_by_date[forecast_date] = float(
                forecast.get("precipitation_sum_mm") or 0
            )

    if not rainy_by_date:
        return None

    starts_on = today if today in rainy_by_date else today + timedelta(days=1)
    if starts_on not in rainy_by_date:
        return None

    rain_days = 0
    total_precipitation = 0.0
    cursor = starts_on
    while cursor in rainy_by_date:
        rain_days += 1
        total_precipitation += rainy_by_date[cursor]
        cursor += timedelta(days=1)

    max_delay = (
        _RAIN_FULL_DELAY_MAX_DAYS
        if rain_reach == "full"
        else _RAIN_PARTIAL_DELAY_MAX_DAYS
    )
    delay_days = min(max_delay, rain_days)

    return {
        "delay_days": delay_days,
        "rain_days": rain_days,
        "rain_starts_on": starts_on.isoformat(),
        "rain_starts_in_days": (starts_on - today).days,
        "total_precipitation_mm": round(total_precipitation, 1),
        "rain_reach": str(rain_reach),
    }


def _is_effective_rain_day(rain_reach: str, forecast: dict[str, Any]) -> bool:
    precipitation = forecast.get("precipitation_sum_mm") or 0
    probability = forecast.get("precipitation_probability_max") or 0
    if not isinstance(precipitation, int | float):
        return False
    if not isinstance(probability, int | float):
        probability = 0

    if rain_reach == "full":
        return (
            precipitation >= _RAIN_SKIP_MM
            and probability >= _RAIN_SKIP_PROBABILITY
        )
    if rain_reach == "partial":
        return precipitation >= _RAIN_PARTIAL_MM

    return False


def _heat_context(
    environment: object,
    today_forecast: dict[str, Any] | None,
    heat_threshold: object,
) -> dict[str, float] | None:
    if environment == "indoor" or today_forecast is None or heat_threshold is None:
        return None

    temp_max = today_forecast.get("temp_max_c")
    if not isinstance(temp_max, int | float) or not isinstance(
        heat_threshold, int | float
    ):
        return None
    if temp_max < heat_threshold:
        return None

    return {
        "forecast_temp_max_c": float(temp_max),
        "heat_sensitive_above_c": float(heat_threshold),
    }


def _heat_pull_forward_context(
    environment: object,
    daily_forecast: list[dict[str, Any]],
    today: date,
    heat_threshold: object,
) -> dict[str, float | int | str] | None:
    if environment == "indoor" or heat_threshold is None:
        return None
    if not isinstance(heat_threshold, int | float):
        return None

    hot_by_date: dict[date, float] = {}
    horizon = today + timedelta(days=_HEATWAVE_LOOKAHEAD_DAYS - 1)
    for forecast in daily_forecast:
        forecast_date = _forecast_date(forecast.get("date"))
        if forecast_date is None or forecast_date < today or forecast_date > horizon:
            continue

        temp_max = forecast.get("temp_max_c")
        if isinstance(temp_max, int | float) and temp_max >= heat_threshold:
            hot_by_date[forecast_date] = float(temp_max)

    if not hot_by_date:
        return None

    starts_on = today if today in hot_by_date else today + timedelta(days=1)
    if starts_on not in hot_by_date:
        return None

    streak_days = 0
    forecast_temp_max_c = hot_by_date[starts_on]
    cursor = starts_on
    while cursor in hot_by_date:
        streak_days += 1
        forecast_temp_max_c = max(forecast_temp_max_c, hot_by_date[cursor])
        cursor += timedelta(days=1)

    pull_forward_days = 1
    if streak_days >= _HEATWAVE_MIN_STREAK_DAYS:
        pull_forward_days = min(
            _HEATWAVE_PULL_FORWARD_MAX_DAYS,
            max(1, streak_days - 2),
        )

    return {
        "forecast_temp_max_c": forecast_temp_max_c,
        "heat_sensitive_above_c": float(heat_threshold),
        "heatwave_days": streak_days,
        "heatwave_starts_on": starts_on.isoformat(),
        "heatwave_starts_in_days": (starts_on - today).days,
        "pull_forward_days": pull_forward_days,
    }


def _forecast_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _heat_watering_note(
    heat_context: dict[str, float | int | str], pulled_forward_by_heat: bool
) -> str:
    temp_max = float(heat_context["forecast_temp_max_c"])
    heatwave_days = heat_context.get("heatwave_days")
    heatwave_starts_in_days = heat_context.get("heatwave_starts_in_days")
    if pulled_forward_by_heat:
        if isinstance(heatwave_days, int) and heatwave_days > 1:
            heatwave_length = _format_day_count(heatwave_days)
            if heatwave_starts_in_days == 0:
                return (
                    f"Čeká nás {heatwave_length} horka až {temp_max:g} °C. "
                    "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
                )
            return (
                f"Od zítřka bude {heatwave_length} horko až {temp_max:g} °C. "
                "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
            )
        return (
            f"Dnes má být {temp_max:g} °C. Zálivka je proto posunutá o den "
            "dopředu. Zalij ráno nebo večer."
        )

    return f"Dnes má být {temp_max:g} °C. Zalij ráno nebo večer."


def _watering_copy_sections(
    days_since: int | None,
    is_dormant: bool,
) -> list[dict[str, str]]:
    return [{"kind": "info", "text": _watering_reason(days_since, is_dormant)}]


def _watering_explanation(
    days_since: int | None,
    is_dormant: bool,
) -> str:
    return _join_copy_sections(_watering_copy_sections(days_since, is_dormant))


def _watering_reason(days_since: int | None, is_dormant: bool) -> str:
    dormant_note = " Má klidové období - netřeba víc." if is_dormant else ""
    if days_since is None:
        return f"Zálivka zatím není zaznamenaná.{dormant_note}"
    return f"Poslední zálivka před {_format_days_ago(days_since)}.{dormant_note}"


def _fertilizing_copy_sections(days_since: int | None) -> list[dict[str, str]]:
    if days_since is None:
        return [{"kind": "info", "text": "Hnojení zatím není zaznamenané."}]
    return [
        {
            "kind": "info",
            "text": f"Poslední hnojení před {_format_days_ago(days_since)}.",
        }
    ]


def _checkin_copy_sections(
    days_since: int | None, is_sick_or_monitoring: bool
) -> list[dict[str, str]]:
    if is_sick_or_monitoring:
        sections = [{"kind": "info", "text": "Je pod dohledem."}]
        sections.append(
            {
                "kind": "action",
                "text": "Mrkni, jestli je lepší, stejná, nebo horší.",
            }
        )
        return sections

    if days_since is None:
        reason = "Kontrola stavu zatím není zaznamenaná."
    else:
        reason = f"Poslední kontrola před {_format_days_ago(days_since)}."
    return [
        {"kind": "info", "text": reason},
        {"kind": "action", "text": "Zkontroluj listy, substrát a celkový stav."},
    ]


def _pest_followup_copy_sections(days_since: int) -> list[dict[str, str]]:
    return [
        {
            "kind": "info",
            "text": f"Škůdci zaznamenaní před {_format_days_ago(days_since)}.",
        },
        {"kind": "action", "text": "Zkontroluj, jestli se nešíří nebo nevrátili."},
    ]


def _photo_copy_sections(days_since: int | None) -> list[dict[str, str]]:
    if days_since is None:
        reason = "Fotka do historie zatím není zaznamenaná."
    else:
        reason = f"Poslední fotka před {_format_days_ago(days_since)}."
    return [
        {"kind": "info", "text": reason},
        {"kind": "action", "text": "Vyfoť ji pro porovnání později."},
    ]


def _maintenance_copy_sections(
    days_since: int | None, notes: object
) -> list[dict[str, str]]:
    if days_since is None:
        reason = "Údržba zatím není zaznamenaná."
    else:
        reason = f"Poslední údržba před {_format_days_ago(days_since)}."

    action = notes.strip() if isinstance(notes, str) and notes.strip() else None
    return [
        {"kind": "info", "text": reason},
        {
            "kind": "action",
            "text": action or "Prořež, přesaď nebo otoč podle stavu.",
        },
    ]


def _weather_protection_copy_sections(
    risk: str, forecast_temp_c: object, threshold_c: object
) -> list[dict[str, str]]:
    if risk == "frost":
        weather = f"Dnes bude {float(forecast_temp_c):g} °C."
        action = "Dej ji dovnitř, nebo ji aspoň přikryj."
    else:
        weather = f"Dnes bude {float(forecast_temp_c):g} °C."
        action = "Dej ji do stínu a zkontroluj zálivku."

    sections = [{"kind": "weather", "text": weather}]
    if isinstance(threshold_c, int | float):
        label = "mráz/chlad" if risk == "frost" else "horko"
        sections.append(
            {
                "kind": "info",
                "text": (
                    f"Práh citlivosti profilu je {float(threshold_c):g} °C "
                    f"pro {label}."
                ),
            }
        )
    sections.append({"kind": "action", "text": action})
    return sections


def _join_copy_sections(sections: list[dict[str, str]]) -> str:
    return " ".join(section["text"] for section in sections if section.get("text"))


def _format_day_count(days: int) -> str:
    if days == 1:
        return "1 den"
    if 2 <= days <= 4:
        return f"{days} dny"
    return f"{days} dní"


def _format_days_ago(days: int) -> str:
    if days == 1:
        return "1 dnem"
    return f"{days} dny"


def _is_active_feeding_month(feeding_months: list[int] | None, today: date) -> bool:
    if not feeding_months:
        return True
    return today.month in feeding_months


def _upcoming_departure(
    absences: list[dict[str, Any]], today: date
) -> dict[str, Any] | None:
    """The soonest absence starting within the lookahead window or already in
    progress — i.e. one worth proactively watering ahead of."""
    horizon = today + timedelta(days=_ABSENCE_LOOKAHEAD_DAYS)
    candidates = [
        absence
        for absence in absences
        if date.fromisoformat(absence["starts_on"]) <= horizon
        and date.fromisoformat(absence["ends_on"]) >= today
    ]
    if not candidates:
        return None
    return min(candidates, key=lambda absence: absence["starts_on"])


def _departure_note(
    departure: dict[str, Any],
    today: date,
    effective_max_interval: int | None,
    pulled_forward: bool,
) -> str:
    starts_on = date.fromisoformat(departure["starts_on"])
    ends_on = date.fromisoformat(departure["ends_on"])
    days_until_departure = (starts_on - today).days
    trip_days = (ends_on - starts_on).days + 1

    if pulled_forward:
        if days_until_departure <= 0:
            note = "Dnes odjíždíš. Zalij ji navíc, ať tu ještě je, až se vrátíš."
        else:
            note = (
                f"Za {days_until_departure} dny odjíždíš — zalij ji teď, "
                f"ať tu ještě je, až dorazíš zpátky."
            )
    else:
        note = "Brzy odjíždíš, tak ji zalij pořádně — improvizace jí neodpouští."

    if effective_max_interval is not None and trip_days > effective_max_interval:
        note += (
            " I s čerstvou zálivkou je tahle cesta na ni moc dlouhá — "
            "sežeň někoho, kdo se na ni mrkne v půlce."
        )

    return note


def _latest(events: dict[str, datetime], keys: list[str]) -> datetime | None:
    candidates = [events[key] for key in keys if key in events]
    return max(candidates) if candidates else None


def _nested(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _profile_hint(profile: dict[str, Any], key: str) -> str | None:
    value = profile.get(key)
    if not isinstance(value, str):
        return None

    stripped = value.strip()
    return stripped or None


async def _upsert_task(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    workspace_id: object,
    *,
    task_type: str,
    target_type: str,
    kytka_id: str | None,
    container_id: str | None,
    task_date: date,
    priority: str,
    title: str,
    explanation: str,
    recommendation_json: dict[str, Any],
    existing_statuses: dict[str, str],
    instructions: str | None = None,
    recommended_amount_ml: int | None = None,
) -> None:
    target_id = kytka_id or container_id
    generated_key = f"{task_type}:{target_type}:{target_id}:{task_date.isoformat()}"

    current_status = existing_statuses.get(generated_key)
    if current_status is not None and current_status != "pending":
        # Already acted on (done/skipped/...) this generation run
        # — never resurrect it back to pending.
        return

    row = {
        "workspace_id": str(workspace_id),
        "task_date": task_date.isoformat(),
        "task_type": task_type,
        "target_type": target_type,
        "kytka_id": kytka_id,
        "container_id": container_id,
        "status": "pending",
        "priority": priority,
        "source": "system",
        "title": title,
        "instructions": instructions,
        "explanation": explanation,
        "recommended_amount_ml": recommended_amount_ml,
        "recommendation_json": recommendation_json,
        "generated_key": generated_key,
    }

    if current_status == "pending":
        response = await client.patch(
            "/care_tasks",
            headers={**headers, "Content-Type": "application/json"},
            params={
                "workspace_id": f"eq.{workspace_id}",
                "generated_key": f"eq.{generated_key}",
            },
            json=row,
        )
        raise_supabase_error(response)
        return

    response = await client.post(
        "/care_tasks",
        headers={
            **headers,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        params={"on_conflict": "workspace_id,generated_key"},
        json=row,
    )
    raise_supabase_error(response)
