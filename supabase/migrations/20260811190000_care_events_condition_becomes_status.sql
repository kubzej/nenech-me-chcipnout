-- "Stav rostliny" is no longer an 8-value symptom picklist — it's now
-- "Jak na tom je?" (OK / Sledovat / Nemocná), directly setting kytky.status.
-- Widening only: old rows keep their legacy values (dry/wet/wilting/...)
-- as read-only history; current app code never writes them again.
alter table public.care_events
drop constraint care_events_condition_check;

alter table public.care_events
add constraint care_events_condition_check
check (
  condition is null
  or condition in (
    'ok',
    'dry',
    'wet',
    'wilting',
    'yellowing',
    'pests',
    'damaged',
    'unknown',
    'monitoring',
    'sick'
  )
);
