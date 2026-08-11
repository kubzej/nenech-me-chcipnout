alter table public.zones
  drop constraint zones_wind_exposure_check;

alter table public.zones
  add constraint zones_wind_exposure_check
    check (wind_exposure in ('low', 'medium', 'high', 'unknown', 'indoor'));
