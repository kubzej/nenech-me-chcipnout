-- Tracks whether a push notification has already gone out for this task —
-- needed so the frequent (every ~15-30 min) critical-weather cron check
-- doesn't re-notify about the same still-pending frost/heat task on every
-- tick. Set once, right when the alert is sent; never reset by generation
-- (regeneration only updates columns it explicitly writes).
alter table public.care_tasks
add column if not exists alerted_at timestamptz;
