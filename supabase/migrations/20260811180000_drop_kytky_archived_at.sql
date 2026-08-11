-- Kytky are hard-deleted, not archived (20260807150000_kytky_hard_delete.sql)
-- — archived_at on this table was never read or written by any code path.
-- Dead column from before that decision was made.
alter table public.kytky
drop column if exists archived_at;
