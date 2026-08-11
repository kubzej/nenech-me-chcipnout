# Architecture

## Runtime split

- `frontend/` — React + Vite PWA. Supabase JS client handles auth/session and
  direct photo uploads to Storage. All other data goes through the backend.
- `backend/` — FastAPI. Every route calls Supabase PostgREST directly via
  `httpx`, forwarding the signed-in user's Supabase JWT so **RLS enforces
  workspace scoping** — there is no ORM/database session layer.
- `supabase/` — Postgres, Auth, Storage. SQL migrations in
  `supabase/migrations/` are the schema source of truth; applied manually in
  the Supabase SQL editor (no auto-migration pipeline).

## Data access pattern

Two request-time header shapes are used with Supabase PostgREST:

- `supabase_user_headers(access_token)` — normal path, used by every route
  that serves a frontend request. RLS policies key off `auth.uid()`, so a
  user can only see/write what their own row-level policies allow.
- `supabase_service_headers()` — service-role key, bypasses RLS entirely.
  Used only in two narrow places: the cron job scripts (`app/jobs/*`, which
  run with no logged-in user and need to act across every workspace member),
  and the push-notification side effect inside `kytka_status.py` (a regular
  user's JWT can only read their own `push_subscriptions`, not their
  partner's, so notifying the other workspace member needs elevated access
  even though it's triggered from an otherwise normal user request).

RLS bypass via service role does **not** imply table grants — Postgres GRANTs
are a separate permission layer. `service_role` has its own grants migration
(`20260811110000_service_role_grants.sql`) mirroring what `authenticated`
already has.

## Domain model

```text
Workspace
 └─ Location (address-level: apartment, cottage)
     └─ Zone (microclimate: balcony, kitchen sill)
         └─ Container (pot, trough)
             └─ Kytka (the actual care target — one plant or a grouped planting)
```

- `Kytka` optionally links to a `CareProfile` (species-level template: watering
  interval, light/temperature sensitivity, feeding, pest-check cadence).
- `CareEvent` targets either a `Kytka` or a `Container` — watering/fertilizing
  are container-scoped (shared substrate), everything else is Kytka-scoped.
- `CareTask` is always Kytka-scoped, generated daily; completing one writes a
  `CareEvent` as a side effect (routes reuse `create_care_event` directly
  rather than duplicating the write logic).
- `PlantPhoto` attaches optionally to a `CareEvent`; the first photo ever
  added for a Kytka becomes its avatar automatically.

## Daily plan generation

`backend/app/services/daily_plan.py::refresh_daily_plan` is the recommendation
engine — the single function that decides what needs attention today. It is
callable both on-demand (opening the Dnes screen calls it with the viewing
user's own headers) and from the cron job (service-role headers, shared
across a whole workspace). Idempotent by design: re-running it the same day
never duplicates or resurrects an already-acted-on task
(`generated_key` unique constraint + an explicit "don't touch non-pending
tasks" guard in `_upsert_task`).

Inputs it combines: care profile interval, days since last event, Kytka
status (dormant/sick/monitoring multipliers), live weather forecast
(Open-Meteo, snapshotted to `weather_daily_snapshots` on every run), zone
`rain_reach` and `environment` (indoor Kytky never get outdoor
frost/heat-protection tasks), and upcoming absences (pulls a watering task
forward if it would otherwise fall inside a trip, rather than trying to
"water more").

## Push notifications

- Web Push via `pywebpush` + VAPID. `notification_preferences` /
  `push_subscriptions` carry per-user settings and per-device subscriptions.
- Frontend service worker uses the `injectManifest` `vite-plugin-pwa`
  strategy (not the default `generateSW`) specifically so it can hand-write
  `push`/`notificationclick` listeners (`frontend/src/sw-push.ts`).
- Two notification shapes, deliberately different mechanisms:
  - **Daily digest** — cron-triggered (`app/jobs/runner.py daily-digest`),
    runs frequently (~every 15 min) and self-gates per user against their
    configured `morning_time` and a `last_daily_digest_sent_on` marker, so
    frequent cron ticks never double-send.
  - **Critical weather** — also cron-triggered, but aggregated: all newly
    at-risk Kytky across a workspace go into *one* push per opted-in member
    ("3 kytky potřebují ochranu před mrazem"), not one push per plant.
    Tracked via `care_tasks.alerted_at` so an unresolved alert isn't repeated
    every tick.
  - **Sick/monitoring status change** — event-triggered, not cron-based.
    Fires immediately from inside the status-transition code
    (`kytka_status.py`), since a status flip is inherently a one-time edge
    event. Excludes whoever caused the transition.

## Deployment topology

- **Netlify** — frontend, auto-deploys from `main`.
- **Railway, web service** — the FastAPI app (`uvicorn`), always running.
- **Railway, `daily-digest` cron service** — same source/image, different
  start command (`python -m app.jobs.runner daily-digest`), its own cron
  schedule. Never put a cron schedule on the web service itself — it starts
  `uvicorn` and never exits.
- **Supabase** — Postgres + Auth + Storage, single project for local dev and
  production alike (no separate staging database).
