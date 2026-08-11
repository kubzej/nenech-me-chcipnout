-- Care profiles are manually created and reusable. Deleting a profile should
-- unlink it from Kytky that reference it, not fail or cascade-delete plants.
alter table public.kytky
  drop constraint kytky_care_profile_id_fkey,
  add constraint kytky_care_profile_id_fkey
    foreign key (care_profile_id) references public.care_profiles(id)
    on delete set null;

-- species_label is superseded by the assigned care profile's name/
-- scientific_name.
alter table public.kytky
  drop column species_label;
