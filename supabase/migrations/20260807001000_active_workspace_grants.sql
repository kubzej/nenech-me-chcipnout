-- Minimal grants needed for the current active-workspace read flow via PostgREST.
-- RLS policies still decide which rows each authenticated user can read.

grant usage on schema public to authenticated;

grant select on table public.workspace_members to authenticated;
grant select on table public.workspaces to authenticated;

grant execute on function public.is_workspace_member(uuid) to authenticated;
