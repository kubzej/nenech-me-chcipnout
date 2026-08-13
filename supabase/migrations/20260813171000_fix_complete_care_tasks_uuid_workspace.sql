-- Postgres does not provide min(uuid). Keep the RPC behavior, but fetch the
-- single workspace id after validating that all pending tasks share one.
create or replace function public.complete_care_tasks(
  p_task_ids uuid[],
  p_event_type text,
  p_amount_ml integer default null,
  p_method text default null,
  p_condition text default null,
  p_note text default null,
  p_photo_storage_path text default null,
  p_photo_note text default null,
  p_photo_health_snapshot text default null
)
returns table(task_id uuid, event_id uuid, photo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_task_count integer;
  v_distinct_workspace_count integer;
  v_task_ids_count integer;
  v_event_id uuid;
  v_photo_id uuid;
  v_photo_kytka_id uuid;
  v_photo_event_id uuid;
  v_amount_ml integer;
  rec record;
begin
  if v_user_id is null then
    raise exception 'Missing authenticated user';
  end if;

  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception 'No task ids provided';
  end if;

  select count(distinct x.task_id)
  into v_task_ids_count
  from unnest(p_task_ids) as x(task_id);

  if v_task_ids_count <> cardinality(p_task_ids) then
    raise exception 'Duplicate task ids are not allowed';
  end if;

  if p_event_type not in (
    'watering',
    'fertilizing',
    'checkin',
    'photo_observation',
    'pest_observation',
    'treatment',
    'maintenance'
  ) then
    raise exception 'Unsupported care event type: %', p_event_type;
  end if;

  if p_amount_ml is not null and p_amount_ml <= 0 then
    raise exception 'amount_ml must be positive';
  end if;

  if p_condition is not null and p_condition not in ('ok', 'monitoring', 'sick') then
    raise exception 'Unsupported condition: %', p_condition;
  end if;

  if p_photo_health_snapshot is not null and p_photo_health_snapshot not in (
    'ok',
    'dry',
    'wet',
    'wilting',
    'yellowing',
    'pests',
    'damaged',
    'unknown'
  ) then
    raise exception 'Unsupported photo health snapshot: %', p_photo_health_snapshot;
  end if;

  perform 1
  from public.care_tasks
  where id = any(p_task_ids)
  for update;

  select
    count(*),
    count(distinct workspace_id)
  into v_task_count, v_distinct_workspace_count
  from public.care_tasks
  where id = any(p_task_ids)
    and status = 'pending';

  if v_task_count <> cardinality(p_task_ids) then
    raise exception 'One or more tasks were not found or are no longer pending';
  end if;

  if v_distinct_workspace_count <> 1 then
    raise exception 'Tasks are not accessible';
  end if;

  select distinct workspace_id
  into v_workspace_id
  from public.care_tasks
  where id = any(p_task_ids)
    and status = 'pending';

  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'Tasks are not accessible';
  end if;

  if exists (
    select 1
    from public.care_tasks
    where id = any(p_task_ids)
      and kytka_id is null
  ) then
    raise exception 'All completed tasks must target a Kytka';
  end if;

  if p_photo_storage_path is not null and cardinality(p_task_ids) <> 1 then
    raise exception 'Photo completion supports exactly one task';
  end if;

  drop table if exists pg_temp.completed_task_rows;
  create temporary table completed_task_rows (
    task_id uuid not null,
    event_id uuid not null,
    photo_id uuid
  ) on commit drop;

  if p_event_type in ('watering', 'fertilizing') then
    for rec in
      select
        k.container_id,
        array_agg(t.id) as task_ids,
        nullif(sum(coalesce(t.recommended_amount_ml, 0)), 0) as recommended_amount_ml
      from public.care_tasks t
      join public.kytky k on k.id = t.kytka_id
      where t.id = any(p_task_ids)
      group by k.container_id
    loop
      v_amount_ml := coalesce(p_amount_ml, rec.recommended_amount_ml);

      insert into public.care_events (
        workspace_id,
        event_type,
        target_type,
        kytka_id,
        container_id,
        related_task_id,
        recorded_by,
        amount_ml,
        method,
        condition,
        note
      )
      values (
        v_workspace_id,
        p_event_type,
        'container',
        null,
        rec.container_id,
        rec.task_ids[1],
        v_user_id,
        v_amount_ml,
        p_method,
        p_condition,
        p_note
      )
      returning id into v_event_id;

      update public.care_tasks
      set
        status = 'done',
        completed_by = v_user_id,
        completed_at = now(),
        updated_at = now()
      where id = any(rec.task_ids);

      insert into completed_task_rows (task_id, event_id)
      select unnest(rec.task_ids), v_event_id;
    end loop;
  else
    for rec in
      select id, kytka_id
      from public.care_tasks
      where id = any(p_task_ids)
      order by created_at asc
    loop
      insert into public.care_events (
        workspace_id,
        event_type,
        target_type,
        kytka_id,
        container_id,
        related_task_id,
        recorded_by,
        amount_ml,
        method,
        condition,
        note
      )
      values (
        v_workspace_id,
        p_event_type,
        'kytka',
        rec.kytka_id,
        null,
        rec.id,
        v_user_id,
        p_amount_ml,
        p_method,
        p_condition,
        p_note
      )
      returning id into v_event_id;

      update public.care_tasks
      set
        status = 'done',
        completed_by = v_user_id,
        completed_at = now(),
        updated_at = now()
      where id = rec.id;

      insert into completed_task_rows (task_id, event_id)
      values (rec.id, v_event_id);

      v_photo_kytka_id := rec.kytka_id;
      v_photo_event_id := v_event_id;
    end loop;
  end if;

  if p_photo_storage_path is not null then
    if split_part(p_photo_storage_path, '/', 1) <> v_workspace_id::text
      or split_part(p_photo_storage_path, '/', 2) <> v_photo_kytka_id::text then
      raise exception 'Photo storage path does not match the completed task';
    end if;

    insert into public.plant_photos (
      workspace_id,
      kytka_id,
      uploaded_by,
      storage_bucket,
      storage_path,
      note,
      health_snapshot,
      care_event_id
    )
    values (
      v_workspace_id,
      v_photo_kytka_id,
      v_user_id,
      'plant-photos',
      p_photo_storage_path,
      p_photo_note,
      p_photo_health_snapshot,
      v_photo_event_id
    )
    returning id into v_photo_id;

    update public.kytky
    set primary_photo_id = v_photo_id
    where id = v_photo_kytka_id
      and workspace_id = v_workspace_id
      and primary_photo_id is null;

    update completed_task_rows
    set photo_id = v_photo_id;
  end if;

  return query
  select
    completed.task_id,
    completed.event_id,
    completed.photo_id
  from pg_temp.completed_task_rows completed;
end;
$$;

grant execute on function public.complete_care_tasks(
  uuid[],
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
