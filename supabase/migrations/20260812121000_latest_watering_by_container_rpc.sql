create or replace function public.latest_watering_by_container(p_workspace_id uuid)
returns table(container_id uuid, last_watered_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    care_events.container_id,
    max(care_events.occurred_at) as last_watered_at
  from public.care_events
  where care_events.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
    and care_events.event_type = 'watering'
    and care_events.container_id is not null
  group by care_events.container_id;
$$;

grant execute on function public.latest_watering_by_container(uuid) to authenticated;
