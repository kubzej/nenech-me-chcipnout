import argparse
import asyncio
import json
import sys
from collections.abc import Awaitable, Callable

from app.jobs import scheduled

JobHandler = Callable[[], Awaitable[dict[str, int]]]

JOB_HANDLERS: dict[str, JobHandler] = {
    "daily-digest": scheduled.run_daily_digest,
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a scheduled nenech-me-chcipnout job"
    )
    parser.add_argument("job", choices=sorted(JOB_HANDLERS))
    args = parser.parse_args()

    handler = JOB_HANDLERS[args.job]

    try:
        result = asyncio.run(handler())
    except Exception as exc:  # noqa: BLE001 - top-level cron entrypoint, must not raise
        print(json.dumps({"job": args.job, "error": str(exc)}))
        sys.exit(1)

    print(json.dumps({"job": args.job, "result": result}))


if __name__ == "__main__":
    main()
