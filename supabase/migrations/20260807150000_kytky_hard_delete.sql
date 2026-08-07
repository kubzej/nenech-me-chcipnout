-- Kytky are hard-deleted (not archived): deleting a plant should genuinely
-- remove it, and its care history along with it.
alter table public.care_tasks
  drop constraint care_tasks_kytka_id_fkey,
  add constraint care_tasks_kytka_id_fkey
    foreign key (kytka_id) references public.kytky(id) on delete cascade;

alter table public.care_events
  drop constraint care_events_kytka_id_fkey,
  add constraint care_events_kytka_id_fkey
    foreign key (kytka_id) references public.kytky(id) on delete cascade;

grant delete on table public.kytky to authenticated;
