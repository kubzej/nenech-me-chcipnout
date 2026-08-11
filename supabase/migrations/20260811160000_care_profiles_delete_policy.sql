-- care_profiles got select/insert/update RLS policies but no delete one —
-- every other user-deletable table uses a single "for all" policy, this
-- one alone was missing the delete case. DELETE grant already exists
-- (20260810120000_hard_delete_grants.sql), but without a matching RLS
-- policy it silently matches zero rows instead of erroring, so the app
-- saw a "successful" delete that removed nothing.
create policy "care_profiles_member_delete"
on public.care_profiles
for delete
to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id));
