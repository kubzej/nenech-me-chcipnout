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
status (`ok` / `monitoring` / `sick` / `dormant` / `dead`), optional care
profile link, and an avatar photo. List + detail views, full CRUD.

## Care profily (Care Profiles)

Species-level templates: watering interval (min/max days) + amount/method,
moisture preference, drought tolerance, overwatering risk, light need,
heat/cold/frost sensitivity, feeding cadence + active months, check/photo/pest
intervals, free-text maintenance and risk notes. Manual entry only — external
plant databases (Perenual, Trefle) were evaluated and rejected (paywalled or
empty care data); AI-assisted profile creation from a photo+name is a
deferred future direction, not built.

## Care events (history)

Logged event types: watering, fertilizing, checkin, pest observation,
treatment, maintenance, weather protection. Watering/fertilizing are
container-scoped (one event covers every Kytka sharing that container);
everything else is Kytka-scoped. Logging a `checkin`/`pest_observation` with
a bad `condition` (wilting/yellowing/pests/damaged) auto-transitions the
Kytka to `monitoring`; logging `condition = ok` while monitoring flips it back
to `ok`. `sick` is never automatic — manual escalation only.

## Dnes (daily plan)

The core proactive feature — see architecture.md for the generation engine
itself. From the screen:

- Watering/fertilizing tasks for Kytky sharing a container merge into one
  action ("Zalij Obývák") with a single tap completing all of them.
- A "Zalít vše" / "Přihnojit vše" bulk action appears once there are 2+
  separate watering/fertilizing actions for the day (different containers),
  so a balcony full of separate pots doesn't mean tapping through each one.
- Other task types (checkin, pest follow-up, weather protection,
  photo check-in) stay individual — they genuinely need looking at one plant
  at a time, batching would defeat the point.
- Each card shows the Kytka's own photo (or a placeholder leaf), not just a
  generic task-type icon.
- Absence-aware: a watering that would otherwise fall during a planned trip
  gets pulled forward automatically; if even a fresh watering wouldn't last
  the whole trip, the explanation says so and suggests asking someone to
  check in partway through.
- A soft nudge appears when a Kytka has no care profile (nothing gets
  generated for it), and a banner shows who's currently away and until when.
- Task explanations are written as direct first-person instructions from the
  plant ("Zalij mě, ať nevyschnu."), not raw interval/data dumps — matches
  the app's "worried, slightly scolding plant guardian" voice.

## Photos

- Direct-from-browser upload to Supabase Storage (no backend in the binary
  path), client-side compressed first. Metadata (`plant_photos`) goes through
  the backend like everything else.
- Standalone "📷 Foto" action on the Kytka detail screen, and an optional
  photo attach on the checkin/pest-observation event form.
- Combined timeline on Kytka detail: event-attached photos render inline
  inside that event's row; standalone photos get their own row.
- Tapping any photo opens a larger viewer with **Nastavit jako profilovku**
  (set as avatar) and delete. First photo ever added still becomes the
  avatar automatically as a default.
- Completing a weekly `photo_observation` task creates both a linked
  `care_events` row and a `plant_photos` row in one flow.

## Absence

Either workspace member can create/edit/delete an absence for either person
(not just their own) — covers "we're both away" without entering it twice.
Feeds directly into Dnes's pre-departure watering logic and the away-banner.

## Notifikace (Push notifications)

- Web Push, opt-in per device, with per-type toggles: daily plan digest,
  critical weather, sick/monitored plant.
- iOS-aware: detects Safari-not-installed and shows an instructional state
  ("add to Home Screen first") instead of a broken permission prompt.
- **Daily digest**: one aggregated push per user per day ("Čeká na tebe N
  úkolů"), at a per-user configurable time — not a fixed morning-only slot.
- **Critical weather**: aggregated across a whole workspace, one push per
  opted-in member, not one per plant.
- **Sick/monitoring alert**: fires immediately on the status transition,
  notifies the other member, not the person who caused it.
- An "evening reminder" type, and later a "weekly photo" toggle that had no
  trigger behind it, were both built then deliberately removed (kept the
  notification surface simple, no dead switches) — fully deleted, not just
  hidden, including their DB columns. Revisit properly later if wanted.

## Auth & workspace

Supabase Auth, email/password, manually created users (no public signup).
Single active workspace per install — multi-workspace switching exists in
the data model but has no UI, not needed yet for a 2-person household.
