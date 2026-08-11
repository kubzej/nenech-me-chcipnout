-- weather_protection as an event_type never fed back into anything —
-- frost/heat risk is recomputed fresh from the forecast every day, never
-- from history. The task type stays (the proactive frost/heat warning is
-- still useful); completing it now logs as "treatment" instead of its
-- own type with zero automation behind it.
update public.care_events
set event_type = 'treatment'
where event_type = 'weather_protection';

alter table public.care_events
drop constraint care_events_event_type_check;

alter table public.care_events
add constraint care_events_event_type_check
check (
  event_type in (
    'watering',
    'fertilizing',
    'checkin',
    'photo_observation',
    'pest_observation',
    'treatment',
    'maintenance',
    'task_skipped',
    'task_not_done'
  )
);
