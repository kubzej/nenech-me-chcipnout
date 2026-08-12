alter table public.care_profiles
add column if not exists survival_watering_hint text,
add column if not exists survival_heat_hint text,
add column if not exists survival_frost_hint text,
add column if not exists survival_fertilizing_hint text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_profiles_survival_hints_length_check'
      and conrelid = 'public.care_profiles'::regclass
  ) then
    alter table public.care_profiles
    add constraint care_profiles_survival_hints_length_check
    check (
      (
        survival_watering_hint is null
        or char_length(survival_watering_hint) <= 120
      )
      and (survival_heat_hint is null or char_length(survival_heat_hint) <= 120)
      and (survival_frost_hint is null or char_length(survival_frost_hint) <= 120)
      and (
        survival_fertilizing_hint is null
        or char_length(survival_fertilizing_hint) <= 120
      )
    );
  end if;
end;
$$;

-- Initial suggestions for current profiles. Keep these intentionally short:
-- one survival nudge on the Dnes card, not a plant-care manual.
update public.care_profiles
set
  survival_watering_hint = 'Po zalití ji nenechávej stát ve vodě.',
  survival_heat_hint = 'V horku ji drž mimo přímé polední slunce.',
  survival_frost_hint = 'Chraň ji před chladem a průvanem.',
  survival_fertilizing_hint = 'Hnoj jen slabě a ne do suchého substrátu.'
where name = 'Orchidej'
  and scientific_name = 'Phalaenopsis';

update public.care_profiles
set
  survival_watering_hint = 'Nenechávej vodu stát v podmisce.',
  survival_heat_hint = 'V horku ji nedávej k rozpálenému oknu.',
  survival_frost_hint = 'Chraň ji před chladem a průvanem.',
  survival_fertilizing_hint = 'Hnoj jen ve slabší dávce.'
where name = 'Fíkus „ginseng“'
  and scientific_name = 'Ficus microcarpa';

update public.care_profiles
set
  survival_watering_hint = 'Pokud je substrát vlhký, radši přeskoč.',
  survival_heat_hint = 'V horku ji nedávej k rozpálenému oknu.',
  survival_frost_hint = 'Chraň ji před chladem.',
  survival_fertilizing_hint = 'Nehnoj suchý substrát.'
where name = 'Dracéna'
  and scientific_name = 'Dracaena fragrans';

update public.care_profiles
set
  survival_watering_hint = null,
  survival_heat_hint = 'V horku zalij ráno nebo večer.',
  survival_frost_hint = 'Mráz ji může zabít, nenechávej ji venku.',
  survival_fertilizing_hint = 'Nehnoj suchý substrát.'
where name = 'Muškát'
  and scientific_name = 'Pelargonium peltatum';

update public.care_profiles
set
  survival_watering_hint = 'Zalij vydatně, ne jen povrch.',
  survival_heat_hint = 'V horku zkontroluj, že nevyschl celý květináč.',
  survival_frost_hint = 'Nádoba promrzá rychleji než zem.',
  survival_fertilizing_hint = 'Hnoj spíš střídmě.'
where name = 'Bobkovišeň'
  and scientific_name = 'Prunus laurocerasus';
