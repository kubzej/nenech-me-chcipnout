-- Snooze duplicated the existing skip action: snoozed_until was never read
-- anywhere, so snoozing behaved identically to skipping (task hidden today,
-- daily regeneration decides again tomorrow purely from the care interval).
-- Removing the dead status/column rather than leaving unused surface area.
alter table public.care_tasks
drop column if exists snoozed_until;

alter table public.care_tasks
drop constraint if exists care_tasks_status_check;

alter table public.care_tasks
add constraint care_tasks_status_check
check (
  status in (
    'pending',
    'done',
    'skipped',
    'not_done',
    'missed',
    'no_response',
    'canceled'
  )
);
