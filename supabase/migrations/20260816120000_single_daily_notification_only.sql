-- Keep push notifications to one scheduled daily digest per user.
-- Weather still influences watering generation, but standalone weather
-- protection tasks and standalone weather/status push toggles are gone.

update public.care_events
set related_task_id = null
where related_task_id in (
  select id
  from public.care_tasks
  where task_type = 'weather_protection'
);

delete from public.care_tasks
where task_type = 'weather_protection';

alter table public.care_tasks
drop constraint care_tasks_task_type_check;

alter table public.care_tasks
add constraint care_tasks_task_type_check
check (
  task_type in (
    'watering',
    'fertilizing',
    'checkin',
    'photo_observation',
    'pest_followup',
    'maintenance'
  )
);

alter table public.care_tasks
drop column if exists alerted_at;

alter table public.notification_preferences
drop column if exists critical_weather_enabled,
drop column if exists sick_plant_enabled;
