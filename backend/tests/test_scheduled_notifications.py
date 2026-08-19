from app.jobs import scheduled


def test_daily_digest_body_formats_single_task() -> None:
    assert (
        scheduled._digest_body([{"task_type": "watering", "title": "Zalít"}])
        == "Čeká na tebe 1 úkol."
    )


def test_daily_digest_body_formats_multiple_tasks() -> None:
    assert scheduled._digest_body(
        [
            {"task_type": "watering", "title": "Zalít"},
            {"task_type": "checkin", "title": "Zkontrolovat"},
        ]
    ) == "Čekají na tebe 2 úkoly."


def test_daily_digest_body_formats_four_tasks() -> None:
    assert scheduled._digest_body(
        [
            {"task_type": "watering", "title": "Zalít"},
            {"task_type": "checkin", "title": "Zkontrolovat"},
            {"task_type": "photo_observation", "title": "Vyfotit"},
            {"task_type": "maintenance", "title": "Údržba"},
        ]
    ) == "Čekají na tebe 4 úkoly."


def test_daily_digest_body_formats_five_tasks() -> None:
    assert scheduled._digest_body(
        [
            {"task_type": "watering", "title": "Zalít"},
            {"task_type": "checkin", "title": "Zkontrolovat"},
            {"task_type": "photo_observation", "title": "Vyfotit"},
            {"task_type": "maintenance", "title": "Údržba"},
            {"task_type": "fertilizing", "title": "Přihnojit"},
        ]
    ) == "Čeká na tebe 5 úkolů."
