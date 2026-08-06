-- NenechMeChcipnout initial v1 schema.
-- Source of truth for the first real app data model.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Prague',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key (workspace_id, user_id),
  constraint workspace_members_role_check
    check (role in ('owner', 'member'))
);

create index workspace_members_user_id_idx
on public.workspace_members (user_id);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.disabled_at is null
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
      and wm.disabled_at is null
  );
$$;

create or replace function public.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

create trigger workspaces_add_owner_membership
after insert on public.workspaces
for each row execute function public.add_workspace_owner_membership();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  address_label text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'Europe/Prague',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint locations_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint locations_longitude_check
    check (longitude is null or longitude between -180 and 180)
);

create index locations_workspace_id_idx
on public.locations (workspace_id);

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  environment text not null,
  light_exposure text not null,
  rain_reach text not null,
  wind_exposure text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint zones_environment_check
    check (environment in ('indoor', 'outdoor', 'covered_outdoor')),
  constraint zones_light_exposure_check
    check (
      light_exposure in (
        'full_sun',
        'partial_sun',
        'bright_indirect',
        'shade',
        'mixed',
        'unknown'
      )
    ),
  constraint zones_rain_reach_check
    check (rain_reach in ('full', 'partial', 'none', 'indoor')),
  constraint zones_wind_exposure_check
    check (wind_exposure in ('low', 'medium', 'high', 'unknown'))
);

create index zones_workspace_location_idx
on public.zones (workspace_id, location_id);

create trigger zones_set_updated_at
before update on public.zones
for each row execute function public.set_updated_at();

create table public.containers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  name text not null,
  container_type text not null,
  approx_volume_l numeric(8,2),
  drainage text not null,
  self_watering boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint containers_type_check
    check (container_type in ('pot', 'trough', 'planter', 'hanging', 'bed', 'other')),
  constraint containers_drainage_check
    check (drainage in ('none', 'limited', 'good', 'unknown')),
  constraint containers_volume_check
    check (approx_volume_l is null or approx_volume_l > 0)
);

create index containers_workspace_zone_idx
on public.containers (workspace_id, zone_id);

create trigger containers_set_updated_at
before update on public.containers
for each row execute function public.set_updated_at();

create table public.care_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  scientific_name text,
  source text not null default 'manual',
  source_ref text,
  water_interval_min_days integer,
  water_interval_max_days integer,
  moisture_preference text,
  drought_tolerance text,
  overwatering_risk text,
  default_water_amount_ml integer,
  watering_method text,
  light_need text,
  heat_sensitive_above_c numeric(4,1),
  cold_sensitive_below_c numeric(4,1),
  frost_sensitive boolean not null default true,
  feeding_enabled boolean not null default false,
  feeding_interval_days integer,
  feeding_months integer[],
  check_interval_days integer not null default 7,
  photo_interval_days integer not null default 7,
  pest_check_interval_days integer,
  maintenance_notes text,
  risk_notes text,
  rules_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint care_profiles_source_check
    check (source in ('manual', 'imported', 'system')),
  constraint care_profiles_water_days_check
    check (
      water_interval_min_days is null
      or water_interval_max_days is null
      or water_interval_min_days <= water_interval_max_days
    ),
  constraint care_profiles_moisture_check
    check (
      moisture_preference is null
      or moisture_preference in (
        'dry_between',
        'slightly_moist',
        'moist',
        'wet',
        'unknown'
      )
    ),
  constraint care_profiles_drought_check
    check (
      drought_tolerance is null
      or drought_tolerance in ('low', 'medium', 'high', 'unknown')
    ),
  constraint care_profiles_overwatering_check
    check (
      overwatering_risk is null
      or overwatering_risk in ('low', 'medium', 'high', 'unknown')
    ),
  constraint care_profiles_light_need_check
    check (
      light_need is null
      or light_need in (
        'full_sun',
        'partial_sun',
        'bright_indirect',
        'shade',
        'unknown'
      )
    ),
  constraint care_profiles_amount_check
    check (default_water_amount_ml is null or default_water_amount_ml > 0),
  constraint care_profiles_intervals_check
    check (
      check_interval_days > 0
      and photo_interval_days > 0
      and (feeding_interval_days is null or feeding_interval_days > 0)
      and (pest_check_interval_days is null or pest_check_interval_days > 0)
    ),
  constraint care_profiles_feeding_months_check
    check (
      feeding_months is null
      or feeding_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]
    )
);

create index care_profiles_workspace_id_idx
on public.care_profiles (workspace_id);

create trigger care_profiles_set_updated_at
before update on public.care_profiles
for each row execute function public.set_updated_at();

create table public.kytky (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  container_id uuid not null references public.containers(id),
  care_profile_id uuid references public.care_profiles(id),
  display_name text not null,
  species_label text,
  status text not null default 'ok',
  acquired_on date,
  primary_photo_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint kytky_status_check
    check (status in ('ok', 'monitoring', 'sick', 'dormant', 'dead', 'archived'))
);

create index kytky_workspace_container_idx
on public.kytky (workspace_id, container_id);

create index kytky_workspace_care_profile_idx
on public.kytky (workspace_id, care_profile_id);

create index kytky_workspace_status_idx
on public.kytky (workspace_id, status);

create trigger kytky_set_updated_at
before update on public.kytky
for each row execute function public.set_updated_at();

create table public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_date date not null,
  task_type text not null,
  target_type text not null,
  kytka_id uuid references public.kytky(id),
  container_id uuid references public.containers(id),
  status text not null default 'pending',
  priority text not null default 'normal',
  source text not null default 'system',
  title text not null,
  instructions text,
  explanation text,
  recommendation_json jsonb not null default '{}'::jsonb,
  recommended_amount_ml integer,
  due_at timestamptz,
  expires_at timestamptz,
  snoozed_until timestamptz,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  outcome_note text,
  generated_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_tasks_task_type_check
    check (
      task_type in (
        'watering',
        'fertilizing',
        'checkin',
        'photo',
        'pest_followup',
        'weather_protect',
        'maintenance'
      )
    ),
  constraint care_tasks_target_type_check
    check (target_type in ('kytka', 'container')),
  constraint care_tasks_target_check
    check (
      (target_type = 'kytka' and kytka_id is not null and container_id is null)
      or
      (target_type = 'container' and container_id is not null and kytka_id is null)
    ),
  constraint care_tasks_status_check
    check (
      status in (
        'pending',
        'done',
        'skipped',
        'not_done',
        'snoozed',
        'missed',
        'no_response',
        'canceled'
      )
    ),
  constraint care_tasks_priority_check
    check (priority in ('low', 'normal', 'high', 'critical')),
  constraint care_tasks_source_check
    check (source in ('system', 'manual', 'weather', 'followup')),
  constraint care_tasks_amount_check
    check (recommended_amount_ml is null or recommended_amount_ml > 0),
  constraint care_tasks_generated_key_unique
    unique (workspace_id, generated_key)
);

create index care_tasks_workspace_date_status_idx
on public.care_tasks (workspace_id, task_date, status);

create index care_tasks_workspace_due_at_idx
on public.care_tasks (workspace_id, due_at);

create index care_tasks_workspace_kytka_date_idx
on public.care_tasks (workspace_id, kytka_id, task_date desc);

create index care_tasks_workspace_container_date_idx
on public.care_tasks (workspace_id, container_id, task_date desc);

create trigger care_tasks_set_updated_at
before update on public.care_tasks
for each row execute function public.set_updated_at();

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  target_type text not null,
  kytka_id uuid references public.kytky(id),
  container_id uuid references public.containers(id),
  related_task_id uuid references public.care_tasks(id),
  recorded_by uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  amount_ml integer,
  method text,
  condition text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint care_events_event_type_check
    check (
      event_type in (
        'watering',
        'fertilizing',
        'checkin',
        'photo_observation',
        'pest_observation',
        'treatment',
        'maintenance',
        'weather_protection',
        'task_skipped',
        'task_not_done'
      )
    ),
  constraint care_events_target_type_check
    check (target_type in ('kytka', 'container')),
  constraint care_events_target_check
    check (
      (target_type = 'kytka' and kytka_id is not null and container_id is null)
      or
      (target_type = 'container' and container_id is not null and kytka_id is null)
    ),
  constraint care_events_condition_check
    check (
      condition is null
      or condition in (
        'ok',
        'dry',
        'wet',
        'wilting',
        'yellowing',
        'pests',
        'damaged',
        'unknown'
      )
    ),
  constraint care_events_amount_check
    check (amount_ml is null or amount_ml > 0)
);

create index care_events_workspace_occurred_idx
on public.care_events (workspace_id, occurred_at desc);

create index care_events_workspace_kytka_occurred_idx
on public.care_events (workspace_id, kytka_id, occurred_at desc);

create index care_events_workspace_container_occurred_idx
on public.care_events (workspace_id, container_id, occurred_at desc);

create table public.plant_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kytka_id uuid not null references public.kytky(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_bucket text not null,
  storage_path text not null,
  captured_at timestamptz,
  note text,
  health_snapshot text,
  care_event_id uuid references public.care_events(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plant_photos_storage_unique
    unique (storage_bucket, storage_path),
  constraint plant_photos_health_snapshot_check
    check (
      health_snapshot is null
      or health_snapshot in (
        'ok',
        'dry',
        'wet',
        'wilting',
        'yellowing',
        'pests',
        'damaged',
        'unknown'
      )
    )
);

create index plant_photos_workspace_kytka_created_idx
on public.plant_photos (workspace_id, kytka_id, created_at desc);

alter table public.kytky
add constraint kytky_primary_photo_id_fkey
foreign key (primary_photo_id) references public.plant_photos(id)
on delete set null;

create table public.user_absences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  suppress_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_absences_date_check
    check (starts_on <= ends_on)
);

create index user_absences_workspace_user_dates_idx
on public.user_absences (workspace_id, user_id, starts_on, ends_on);

create trigger user_absences_set_updated_at
before update on public.user_absences
for each row execute function public.set_updated_at();

create table public.notification_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  master_enabled boolean not null default true,
  daily_plan_enabled boolean not null default true,
  evening_reminder_enabled boolean not null default true,
  critical_weather_enabled boolean not null default true,
  sick_plant_enabled boolean not null default true,
  weekly_photo_enabled boolean not null default true,
  morning_time time not null default '08:00',
  evening_time time not null default '19:00',
  timezone text not null default 'Europe/Prague',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  last_seen_at timestamptz,
  failure_count integer not null default 0,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_failure_count_check
    check (failure_count >= 0)
);

create index push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

create index push_subscriptions_workspace_user_idx
on public.push_subscriptions (workspace_id, user_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create table public.weather_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  source text not null default 'open-meteo',
  forecast_date date not null,
  fetched_at timestamptz not null default now(),
  temp_min_c numeric(4,1),
  temp_max_c numeric(4,1),
  precipitation_mm numeric(6,2),
  precipitation_probability_max integer,
  wind_speed_max_kmh numeric(5,1),
  weather_code integer,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint weather_daily_snapshots_unique
    unique (location_id, source, forecast_date),
  constraint weather_daily_snapshots_precipitation_check
    check (precipitation_mm is null or precipitation_mm >= 0),
  constraint weather_daily_snapshots_probability_check
    check (
      precipitation_probability_max is null
      or precipitation_probability_max between 0 and 100
    ),
  constraint weather_daily_snapshots_wind_check
    check (wind_speed_max_kmh is null or wind_speed_max_kmh >= 0)
);

create index weather_daily_snapshots_workspace_location_date_idx
on public.weather_daily_snapshots (workspace_id, location_id, forecast_date);

-- Row Level Security

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.locations enable row level security;
alter table public.zones enable row level security;
alter table public.containers enable row level security;
alter table public.care_profiles enable row level security;
alter table public.kytky enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_events enable row level security;
alter table public.plant_photos enable row level security;
alter table public.user_absences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.weather_daily_snapshots enable row level security;

create policy "profiles_select_own_or_workspace_member"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.workspace_members own_membership
    join public.workspace_members target_membership
      on target_membership.workspace_id = own_membership.workspace_id
    where own_membership.user_id = auth.uid()
      and own_membership.disabled_at is null
      and target_membership.user_id = profiles.user_id
      and target_membership.disabled_at is null
  )
);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

create policy "workspaces_insert_creator"
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

create policy "workspaces_update_owner"
on public.workspaces
for update
to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

create policy "workspace_members_select_member"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_owner"
on public.workspace_members
for insert
to authenticated
with check (public.is_workspace_owner(workspace_id));

create policy "workspace_members_update_owner"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "locations_member_all"
on public.locations
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "zones_member_all"
on public.zones
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "containers_member_all"
on public.containers
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "care_profiles_member_or_system_select"
on public.care_profiles
for select
to authenticated
using (workspace_id is null or public.is_workspace_member(workspace_id));

create policy "care_profiles_member_insert"
on public.care_profiles
for insert
to authenticated
with check (
  workspace_id is not null
  and public.is_workspace_member(workspace_id)
  and (created_by is null or created_by = auth.uid())
);

create policy "care_profiles_member_update"
on public.care_profiles
for update
to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id))
with check (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "kytky_member_all"
on public.kytky
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "care_tasks_member_all"
on public.care_tasks
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "care_events_member_all"
on public.care_events
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and recorded_by = auth.uid()
);

create policy "plant_photos_member_all"
on public.plant_photos
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and uploaded_by = auth.uid()
);

create policy "user_absences_member_select"
on public.user_absences
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "user_absences_own_all"
on public.user_absences
for all
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
)
with check (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

create policy "notification_preferences_member_select"
on public.notification_preferences
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "notification_preferences_own_all"
on public.notification_preferences
for all
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
)
with check (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

create policy "push_subscriptions_own_all"
on public.push_subscriptions
for all
to authenticated
using (
  user_id = auth.uid()
  and (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
  )
);

create policy "weather_daily_snapshots_member_select"
on public.weather_daily_snapshots
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "weather_daily_snapshots_member_insert"
on public.weather_daily_snapshots
for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

create policy "weather_daily_snapshots_member_update"
on public.weather_daily_snapshots
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
