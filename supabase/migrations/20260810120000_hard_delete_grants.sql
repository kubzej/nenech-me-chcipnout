-- The original grants migration deliberately withheld DELETE ("use
-- archived_at/status transitions"), but every entity the app actually lets
-- users delete (locations, zones, containers, care profiles, care events)
-- is implemented as a real hard delete in both backend and UI — kytky
-- already got its own delete grant for the same reason. Extend that to the
-- rest rather than leaving them silently broken until someone hits delete.
grant delete on table
  public.locations,
  public.zones,
  public.containers,
  public.care_profiles,
  public.care_events
to authenticated;
