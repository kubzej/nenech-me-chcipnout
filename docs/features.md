# Features

What the app actually does today, by area. For _how_ it's built, see
[architecture.md](architecture.md).

## Místa (Places)

Location → Zone → Container hierarchy. Locations carry coordinates (for
weather) and timezone; zones carry environment (indoor/outdoor/covered),
light/wind exposure, and `rain_reach` (does rain actually reach this zone);
containers carry type/size/drainage. Full CRUD, hard delete (not soft/archive)
for everything a user can delete from the UI.

## Kytky (Plants)

A `Kytka` is the care target — one plant or a grouped planting (e.g. mixed
herbs in one trough count as separate Kytky sharing a container). Each has a
status (`ok` / `monitoring` / `sick` / `dormant`; `dead` may exist only as
legacy data), optional care profile link, and an avatar photo. List + detail
views, full CRUD.

## Care profily (Care Profiles)

Species-level templates: watering cadence (`Zalévat od` = when to start
normal watering; `Nejpozději` = upper safety bound) + amount/method,
moisture preference, drought tolerance, overwatering risk, light need,
heat/cold/frost sensitivity, feeding cadence + active months, check/photo/pest
intervals, short survival hints for Today cards, free-text maintenance and
risk notes. Manual entry plus a copy/paste AI prompt helper for species facts —
external
plant databases (Perenual, Trefle) were evaluated and rejected (paywalled or
empty care data).

## Care events (history)

Logged event types: watering, fertilizing, checkin, pest observation,
treatment, maintenance, photo observation. Weather-protection tasks are
completed as treatment events, because the history should record what was
actually done. Watering/fertilizing are
container-scoped (one event covers every Kytka sharing that container);
everything else is Kytka-scoped. Logging a `checkin`/`pest_observation` with
`condition = ok|monitoring|sick` directly sets the Kytka status to that value.
The timeline displays this explicitly as `Nastaven stav: ...`. Deleting or
editing an old event does not recompute current status retroactively; adjust
the Kytka manually if you are correcting history.

## Dnes (daily plan)

The core proactive feature — see architecture.md for the generation engine
itself. From the screen:

- Watering/fertilizing tasks for Kytky sharing a container merge into one
  action ("Zalij Obývák") with a single tap completing all of them through one
  atomic backend call.
- A "Zalít vše" / "Přihnojit vše" bulk action appears once there are 2+
  separate watering/fertilizing actions for the day (different containers),
  so a balcony full of separate pots doesn't mean tapping through each one.
- Other task types (checkin, pest follow-up, weather protection, photo history
  reminders) stay individual — they genuinely need looking at one plant at a
  time, batching would defeat the point.
- Cards are ordered by priority first, then by Kytka/container name, then by
  task type as a tie-breaker. The UI does not merge all tasks for one plant
  into one card; it just keeps related cards near each other.
- Each card shows the Kytka's own photo (or a placeholder leaf), not just a
  generic task-type icon.
- Cards can show one short survival hint from the care profile when there is
  a practical risk worth surfacing.
- Sick/monitoring check-ins use a simpler recovery question:
  `Oproti minule: Lepší / Stejná / Horší`, with an optional photo. Worse
  keeps/sets `sick`; same keeps the current watched state; better moves the
  plant to `monitoring` rather than declaring it OK immediately.
- Absence-aware: a watering that would otherwise fall during a planned trip
  gets pulled forward automatically; if even a fresh watering wouldn't last
  the whole trip, the explanation says so and suggests asking someone to
  check in partway through.
- Weather-aware: rain can delay outdoor watering; forecast heat can pull
  watering forward and notes recommend morning/evening instead of midday.
- Fertilizing is deliberately conservative: no fertilizing task is generated
  for `sick`, `monitoring`, or `dormant` Kytky, and fertilizing cards include a
  short "do not fertilize dry substrate / skip if unsure" guardrail when the
  profile has no better species-specific hint.
- A soft nudge appears when a Kytka has no care profile (nothing gets
  generated for it), and a banner shows who's currently away and until when.
- Task explanations are human-readable instructions/reasons, not raw
  interval/data dumps — matches the app's worried, slightly scolding plant
  guardian voice.

## Photos

- Direct-from-browser upload to Supabase Storage (no backend in the binary
  path), client-side compressed first. Metadata (`plant_photos`) goes through
  the backend like everything else. Delete removes both metadata and the
  Storage object; failed metadata writes try to clean up the just-uploaded
  object.
- Standalone "Foto" action on the Kytka detail screen, and an optional
  photo attach on the checkin/pest-observation event form.
- Combined timeline on Kytka detail: event-attached photos render inline
  inside that event's row; standalone photos get their own row.
- Tapping any photo opens a larger viewer with **Nastavit jako profilovku**
  (set as avatar) and delete. First photo ever added still becomes the
  avatar automatically as a default.
- A `photo_observation` task is intentionally just a "photo to history"
  reminder, not the sick-plant recovery flow. Sick/monitoring recovery happens
  through check-in, with photo as an optional attachment.
- Completing a `photo_observation` task creates the linked `care_events` row,
  marks the task done, and stores `plant_photos` metadata in the same database
  RPC after the browser has uploaded the compressed image to Storage.

## Absence

Either workspace member can create/edit/delete an absence for either person
(not just their own) — covers "we're both away" without entering it twice.
Feeds directly into Dnes's pre-departure watering logic and the away-banner.

## Notifikace (Push notifications)

- Web Push, opt-in per device.
- iOS-aware: detects Safari-not-installed and shows an instructional state
  ("add to Home Screen first") instead of a broken permission prompt.
- **Daily digest**: one aggregated push per user per day ("Čeká na tebe N
  úkolů"), at a per-user configurable time — not a fixed morning-only slot.
- Weather can affect generated care tasks, especially watering, but does not
  create standalone weather notifications.
- Sick/monitoring status changes are recorded in the app, but do not create
  immediate push notifications.
- An "evening reminder" type, and later a "weekly photo" toggle that had no
  trigger behind it, were both built then deliberately removed (kept the
  notification surface simple, no dead switches) — fully deleted, not just
  hidden, including their DB columns. Revisit properly later if wanted.

## Auth & workspace

Supabase Auth, email/password, manually created users (no public signup).
Single active workspace per install — multi-workspace switching exists in
the data model but has no UI, not needed yet for a 2-person household.
