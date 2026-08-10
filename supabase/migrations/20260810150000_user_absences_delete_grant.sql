-- user_absences got UPDATE/INSERT/SELECT in the original grants migration
-- but DELETE was missed when the Absences UI (with a delete action) was
-- built — same class of oversight as the earlier hard_delete_grants
-- migration, just for a table added after that one.
grant delete on table public.user_absences to authenticated;
