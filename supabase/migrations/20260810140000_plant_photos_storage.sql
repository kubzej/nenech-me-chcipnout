-- Storage bucket + object-level RLS for plant photos. Table RLS on
-- public.plant_photos already exists (initial schema); this covers the
-- separate storage.objects policy layer Supabase Storage requires, plus the
-- DELETE grant plant_photos itself was missing (metadata-only delete, per
-- Step B2 — the Storage object is left orphaned, not reaped in v1).
--
-- Path convention: {workspace_id}/{kytka_id}/{uuid}.jpg — the first path
-- segment is the workspace id, checked via storage.foldername(name).

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

create policy "plant_photos_storage_member_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'plant-photos'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'plant-photos'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

grant delete on table public.plant_photos to authenticated;
