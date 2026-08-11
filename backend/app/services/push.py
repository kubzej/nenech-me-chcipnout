import asyncio
import json
from datetime import UTC, datetime
from typing import Any

import httpx
from pywebpush import WebPushException, webpush

from app.core.config import settings
from app.core.supabase_rest import raise_supabase_error, supabase_rest_url

_MAX_FAILURES = 5


async def send_push_notification(
    headers: dict[str, str],
    workspace_id: object,
    user_id: object,
    title: str,
    body: str,
    url: str | None = None,
    tag: str | None = None,
) -> int:
    """Send a push notification to every active device of one user.
    Returns how many devices it actually reached."""
    if not (
        settings.vapid_private_key
        and settings.vapid_public_key
        and settings.vapid_claim_email
    ):
        return 0

    async with httpx.AsyncClient(base_url=supabase_rest_url(), timeout=12) as client:
        response = await client.get(
            "/push_subscriptions",
            headers=headers,
            params={
                "select": "id,endpoint,p256dh,auth,failure_count",
                "workspace_id": f"eq.{workspace_id}",
                "user_id": f"eq.{user_id}",
                "disabled_at": "is.null",
            },
        )
        raise_supabase_error(response)
        subscriptions = response.json()

        if not subscriptions:
            return 0

        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
        vapid_claims_template = {"sub": settings.vapid_claim_email}

        sent = 0
        for sub in subscriptions:
            subscription_info = {
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            }

            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims=dict(vapid_claims_template),
                )
                sent += 1
                await _patch_subscription(
                    client,
                    headers,
                    sub["id"],
                    {"last_seen_at": _now_iso(), "failure_count": 0},
                )
            except WebPushException as exc:
                status_code = (
                    exc.response.status_code if exc.response is not None else None
                )
                if status_code in (404, 410):
                    await _patch_subscription(
                        client, headers, sub["id"], {"disabled_at": _now_iso()}
                    )
                else:
                    next_failures = int(sub.get("failure_count") or 0) + 1
                    patch_body: dict[str, Any] = {"failure_count": next_failures}
                    if next_failures >= _MAX_FAILURES:
                        patch_body["disabled_at"] = _now_iso()
                    await _patch_subscription(client, headers, sub["id"], patch_body)

        return sent


async def _patch_subscription(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    subscription_id: object,
    payload: dict[str, Any],
) -> None:
    response = await client.patch(
        "/push_subscriptions",
        headers={**headers, "Content-Type": "application/json"},
        params={"id": f"eq.{subscription_id}"},
        json=payload,
    )
    raise_supabase_error(response)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
