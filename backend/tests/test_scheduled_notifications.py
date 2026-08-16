from app.jobs import scheduled


def test_daily_digest_body_formats_single_task() -> None:
    assert (
        scheduled._digest_body([{"task_type": "watering", "title": "Zalít"}])
        == "Čeká na tebe 1 úkol. Kdo jinej to zalije?"
    )


def test_daily_digest_body_formats_multiple_tasks() -> None:
    assert scheduled._digest_body(
        [
            {"task_type": "watering", "title": "Zalít"},
            {"task_type": "checkin", "title": "Zkontrolovat"},
        ]
    ) == "Čeká na tebe 2 úkolů. Kdo jinej je zalije?"
