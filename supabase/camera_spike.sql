-- Camera spike setup for Supabase Storage.
-- Apply manually in Supabase SQL editor.
--
-- Bucket:
--   id/name: camera-spike
--   public: false
--
-- If the bucket does not exist yet, create it from the Dashboard:
-- Storage -> New bucket -> camera-spike -> Private.
--
-- Policies below assume objects are stored under:
--   <auth.uid()>/<timestamp>.<extension>

create policy "Users can upload own camera spike photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'camera-spike'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own camera spike photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'camera-spike'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own camera spike photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'camera-spike'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'camera-spike'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own camera spike photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'camera-spike'
  and (storage.foldername(name))[1] = auth.uid()::text
);
