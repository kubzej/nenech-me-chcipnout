-- The cron job scripts (app/jobs/*) call Supabase REST using the
-- service_role key so they can operate across all workspace members without
-- a per-request user JWT. service_role bypasses RLS, but RLS bypass does
-- NOT imply table-level GRANTs — those are a separate, still-required
-- permission layer. Mirrors the existing authenticated_app_grants table
-- list (minus DELETE, which the cron jobs never need).
grant usage on schema public to service_role;

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
to service_role;
