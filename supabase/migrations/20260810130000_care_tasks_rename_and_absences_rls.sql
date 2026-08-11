-- Align care_tasks.task_type naming with care_events.event_type — pure
-- naming inconsistency (photo/weather_protect vs photo_observation/
-- weather_protection), not a semantic difference. Safe: care_tasks has
-- zero rows anywhere, no routes/UI ever wrote to it before this feature.
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
      'weather_protection',
      'maintenance'
    )
  );

-- Allow either workspace member to create/manage absence rows for either
-- member ("we're both away" should not require each person to enter it
-- separately). Acceptable trust model for a 2-person household workspace.
drop policy "user_absences_member_select" on public.user_absences;
drop policy "user_absences_own_all" on public.user_absences;

create policy "user_absences_member_all"
on public.user_absences
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
