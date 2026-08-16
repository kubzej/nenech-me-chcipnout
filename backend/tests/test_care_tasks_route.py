from app.api.routes.care_tasks import _copy_sections_for_task, _to_care_task_item


def test_copy_sections_for_task_prefers_structured_recommendation_json() -> None:
    assert _copy_sections_for_task(
        {
            "explanation": "Legacy fallback.",
            "recommendation_json": {
                "copy_sections": [
                    {"kind": "info", "text": "Poslední zálivka před 2 dny."},
                    {"kind": "weather", "text": "Od zítřka má přijít horko."},
                ]
            },
        }
    ) == [
        {"kind": "info", "text": "Poslední zálivka před 2 dny."},
        {"kind": "weather", "text": "Od zítřka má přijít horko."},
    ]


def test_copy_sections_for_task_falls_back_to_explanation() -> None:
    assert _copy_sections_for_task({"explanation": "Zkontrolovat."}) == [
        {"kind": "info", "text": "Zkontrolovat."}
    ]


def test_copy_sections_for_legacy_watering_task_use_structured_fields() -> None:
    assert _copy_sections_for_task(
        {
            "task_type": "watering",
            "task_date": "2026-08-13",
            "recommended_amount_ml": None,
            "explanation": "Old combined text should not be used.",
            "recommendation_json": {
                "days_since_last_event": 2,
                "forecast_temp_max_c": 35.9,
                "heatwave_days": 3,
                "heatwave_starts_on": "2026-08-14",
                "pulled_forward_for_heat": True,
            },
            "kytky": {
                "care_profiles": {
                    "survival_watering_hint": "Zalij až po proschnutí povrchu.",
                }
            },
        }
    ) == [
        {"kind": "info", "text": "Poslední zálivka před 2 dny."},
        {
            "kind": "weather",
            "text": (
                "Od zítřka bude 3 dny horko až 35.9 °C. "
                "Zálivka je proto posunutá dopředu. Zalij ráno nebo večer."
            ),
        },
    ]


def test_to_care_task_item_uses_survival_hint_for_legacy_watering_instruction() -> None:
    task = _to_care_task_item(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "task_date": "2026-08-13",
            "task_type": "watering",
            "target_type": "kytka",
            "kytka_id": "00000000-0000-0000-0000-000000000002",
            "container_id": None,
            "status": "pending",
            "priority": "normal",
            "source": "system",
            "title": "Zalít",
            "instructions": None,
            "explanation": "Old combined text should not be used.",
            "recommended_amount_ml": None,
            "due_at": None,
            "completed_by": None,
            "completed_at": None,
            "outcome_note": None,
            "recommendation_json": {"days_since_last_event": 2},
            "kytky": {
                "care_profiles": {
                    "survival_watering_hint": "Zalij až po proschnutí povrchu.",
                }
            },
            "created_at": "2026-08-13T10:00:00+00:00",
        }
    )

    assert task.instructions == "Zalij až po proschnutí povrchu."
    assert [section.model_dump() for section in task.copy_sections] == [
        {"kind": "info", "text": "Poslední zálivka před 2 dny."}
    ]
