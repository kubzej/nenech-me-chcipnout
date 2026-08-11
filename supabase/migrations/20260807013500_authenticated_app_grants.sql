-- Grant the authenticated app role access to the current private app model.
-- RLS policies remain the real security boundary and decide which rows each
-- signed-in user can read or mutate.
--
-- Scope is intentionally explicit:
-- - current app tables only
-- - select/insert/update only
-- - no delete grants; use archived_at/status transitions in app flows
-- - no default privileges for future tables

grant usage on schema public to authenticated;

grant select, insert, update on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.locations,
  public.zones,
  public.containers,
  public.care_profiles,
  public.kytky,
  public.care_tasks,
  public.care_events,
  public.plant_photos,
  public.user_absences,
  public.notification_preferences,
  public.push_subscriptions,
  public.weather_daily_snapshots
to authenticated;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
