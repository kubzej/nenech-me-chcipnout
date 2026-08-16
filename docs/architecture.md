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
  Used only by offline/background jobs such as the cron job scripts
  (`app/jobs/*`), which run with no logged-in user and need to act across
  every workspace member.

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
  interval, light/temperature sensitivity, feeding, pest-check/photo cadence,
  and short survival hints for generated task cards).
- `CareEvent` targets either a `Kytka` or a `Container` — watering/fertilizing
  are container-scoped (shared substrate), everything else is Kytka-scoped.
- `CareTask` is always Kytka-scoped, generated daily; completing one or more
  tasks calls the `complete_care_tasks` Postgres RPC so the event write, task
  status update, and optional photo metadata insert happen atomically.
- `PlantPhoto` attaches optionally to a `CareEvent`; the first photo ever
  added for a Kytka becomes its avatar automatically. Browser uploads the
  binary to Storage first; the backend validates the storage path before
  writing metadata and removes Storage objects when photos are deleted.

## Daily plan generation

`backend/app/services/daily_plan.py::refresh_daily_plan` is the recommendation
engine — the function that decides what needs attention today. A separate
`read_daily_plan` path returns the already-generated snapshot without
rollover/weather/task-generation side effects, so normal reloads after actions
are cheap. Refresh is still callable on-demand and from the cron job
(service-role headers, shared across a whole workspace). Idempotent by design:
re-running it the same day never duplicates or resurrects an already-acted-on task
(`generated_key` unique constraint + an explicit "don't touch non-pending
tasks" guard in `_upsert_task`).

Inputs it combines: care profile interval, days since last event, Kytka
status (dormant/sick/monitoring multipliers), live weather forecast
(Open-Meteo, snapshotted to `weather_daily_snapshots` on every run), zone
`rain_reach` and `environment` (indoor Kytky never get outdoor
frost/heat-protection tasks), heat/rain forecast adjustments, and upcoming
absences (pulls a watering task
forward if it would otherwise fall inside a trip, rather than trying to
"water more").

Generated task priorities are intentionally simple: normal care is `normal`,
photo/maintenance reminders are `low`, sick plants, absences, and weather
protection are `high`; `critical` exists in the schema but is not a routine
generation output yet. The Today screen then applies its own presentation
order: priority first, Kytka/container name second, task type only as a
tie-breaker. It does not merge every plant's tasks into one card.

Sick/monitoring follow-up is modeled as normal `checkin` tasks with shorter
cadence. The UI can ask `better / same / worse`, but persistence still uses
the existing `condition = ok|monitoring|sick` status-setting mechanism plus a
human-readable note; there is no separate recovery table or photo-analysis
pipeline. `photo_observation` remains an archival photo reminder.

`/api/kytky` reads list data and the latest watering per container in
parallel. Latest watering comes from the `latest_watering_by_container` RPC,
so the API does not fetch the whole watering history just to render list
buttons like "Zalito dnes".

## Push notifications

- Web Push via `pywebpush` + VAPID. `notification_preferences` /
  `push_subscriptions` carry per-user settings and per-device subscriptions.
- Frontend service worker uses the `injectManifest` `vite-plugin-pwa`
  strategy (not the default `generateSW`) specifically so it can hand-write
  `push`/`notificationclick` listeners (`frontend/src/sw-push.ts`).
- **Daily digest** — the only automatic push notification. It is
  cron-triggered (`app/jobs/runner.py daily-digest`), runs frequently
  (~every 15 min), and self-gates per user against their configured
  `morning_time` and a `last_daily_digest_sent_on` marker, so frequent cron
  ticks never double-send.
- Weather still influences care generation, especially watering, but it does
  not produce standalone weather-protection tasks or standalone pushes.
- Status changes (`monitoring`/`sick`) stay in app state and history; they do
  not send immediate push notifications.

## Deployment topology

- **Netlify** — frontend, auto-deploys from `main`.
- **Railway, web service** — the FastAPI app (`uvicorn`), always running.
- **Railway, `daily-digest` cron service** — same source/image, different
  start command (`python -m app.jobs.runner daily-digest`), its own cron
  schedule. Never put a cron schedule on the web service itself — it starts
  `uvicorn` and never exits.
- **Supabase** — Postgres + Auth + Storage, single project for local dev and
  production alike (no separate staging database).
