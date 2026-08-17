-- Completed task links are useful provenance, but they must not make hard
-- deleting a Kytka impossible. Container-scoped watering/fertilizing events
-- can point at a Kytka task while intentionally outliving that one Kytka.
alter table public.care_events
  drop constraint if exists care_events_related_task_id_fkey;

alter table public.care_events
  add constraint care_events_related_task_id_fkey
    foreign key (related_task_id) references public.care_tasks(id)
    on delete set null;
