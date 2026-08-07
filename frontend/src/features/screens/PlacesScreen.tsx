import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ChoiceField } from '../../components/ui/ChoiceField';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Sheet } from '../../components/ui/Sheet';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { LocationWeather } from '../weather/LocationWeather';
import { apiGetAuthed, apiPostAuthed } from '../../lib/api';
import type {
  ContainerCreateRequest,
  LocationCreateRequest,
  PlaceLocationOverview,
  PlaceZoneOverview,
  ZoneCreateRequest,
} from '../../types/place';
import './screen.css';

export function PlacesScreen() {
  const [locations, setLocations] = useState<PlaceLocationOverview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLocationForZone, setActiveLocationForZone] =
    useState<PlaceLocationOverview | null>(null);
  const [coordinates, setCoordinates] = useState('');
  const [locationName, setLocationName] = useState('');
  const [zoneEnvironment, setZoneEnvironment] =
    useState<ZoneCreateRequest['environment']>('outdoor');
  const [zoneLightExposure, setZoneLightExposure] =
    useState<ZoneCreateRequest['light_exposure']>('unknown');
  const [zoneName, setZoneName] = useState('');
  const [zoneRainReach, setZoneRainReach] =
    useState<ZoneCreateRequest['rain_reach']>('partial');
  const [zoneWindExposure, setZoneWindExposure] =
    useState<ZoneCreateRequest['wind_exposure']>('unknown');
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [activeZoneForContainer, setActiveZoneForContainer] =
    useState<PlaceZoneOverview | null>(null);
  const [containerName, setContainerName] = useState('');
  const [containerType, setContainerType] =
    useState<ContainerCreateRequest['container_type']>('pot');
  const [containerDrainage, setContainerDrainage] =
    useState<NonNullable<ContainerCreateRequest['drainage']>>('unknown');
  const [containerSelfWatering, setContainerSelfWatering] =
    useState<'yes' | 'no'>('no');
  const [containerVolume, setContainerVolume] = useState('');

  const loadPlaces = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      setError(null);
      if (options.showLoading ?? true) {
        setIsLoading(true);
      }

      try {
        const data = await apiGetAuthed<PlaceLocationOverview[]>(
          '/api/places/overview',
        );
        setLocations(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Místa se nenačetla.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  async function handleCreateLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedCoordinates = parseCoordinates(coordinates);
    if (!parsedCoordinates) {
      setFormError('Vlož souřadnice ve formátu 12.345678, 98.765432.');
      return;
    }

    const payload: LocationCreateRequest = {
      address_label: null,
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      name: locationName,
      timezone: 'Europe/Prague',
    };

    setError(null);
    setFormError(null);
    setIsCreating(true);

    try {
      await apiPostAuthed('/api/places/locations', payload);
      setCoordinates('');
      setLocationName('');
      setIsCreateSheetOpen(false);
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Místo se nevytvořilo.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLocationForZone) {
      return;
    }

    const payload: ZoneCreateRequest = {
      environment: zoneEnvironment,
      light_exposure: zoneLightExposure,
      location_id: activeLocationForZone.id,
      name: zoneName,
      rain_reach: zoneRainReach,
      wind_exposure: zoneWindExposure,
    };

    setError(null);
    setIsCreating(true);

    try {
      await apiPostAuthed('/api/places/zones', payload);
      resetZoneForm();
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Zóna se nevytvořila.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openZoneSheet(location: PlaceLocationOverview) {
    setActiveLocationForZone(location);
    setZoneName('');
    setZoneEnvironment('outdoor');
    setZoneLightExposure('unknown');
    setZoneRainReach('partial');
    setZoneWindExposure('unknown');
  }

  function resetZoneForm() {
    setActiveLocationForZone(null);
    setZoneName('');
    setZoneEnvironment('outdoor');
    setZoneLightExposure('unknown');
    setZoneRainReach('partial');
    setZoneWindExposure('unknown');
  }

  async function handleCreateContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeZoneForContainer) {
      return;
    }

    const payload: ContainerCreateRequest = {
      approx_volume_l: parseOptionalNumber(containerVolume),
      container_type: containerType,
      drainage: containerDrainage,
      name: containerName,
      self_watering: containerSelfWatering === 'yes',
      zone_id: activeZoneForContainer.id,
    };

    setError(null);
    setIsCreating(true);

    try {
      await apiPostAuthed('/api/places/containers', payload);
      resetContainerForm();
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Nádoba se nevytvořila.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openContainerSheet(zone: PlaceZoneOverview) {
    setActiveZoneForContainer(zone);
    setContainerName('');
    setContainerType('pot');
    setContainerDrainage('unknown');
    setContainerSelfWatering('no');
    setContainerVolume('');
  }

  function resetContainerForm() {
    setActiveZoneForContainer(null);
    setContainerName('');
    setContainerType('pot');
    setContainerDrainage('unknown');
    setContainerSelfWatering('no');
    setContainerVolume('');
  }

  return (
    <section
      className="screen screen--stack screen--with-floating-action"
      aria-label="Místa"
    >
      <ScreenHeader title="Místa" subtitle="Kde se ty chudinky trápí" />

      {isLoading ? <SkeletonCard aria-label="Načítám místa" lines={1} /> : null}
      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      <Sheet
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        title="Nové místo"
      >
        <div className="location-form">
          <form onSubmit={handleCreateLocation}>
            <TextField
              disabled={isCreating}
              label="Název místa"
              name="location_name"
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Domov"
              required
              value={locationName}
            />
            <TextField
              disabled={isCreating}
              inputMode="decimal"
              label="Souřadnice"
              name="coordinates"
              onChange={(event) => {
                setCoordinates(event.target.value);
                setFormError(null);
              }}
              placeholder="12.345678, 98.765432"
              required
              value={coordinates}
            />
            {formError ? (
              <Text
                as="p"
                variant="caption"
                tone="danger"
                className="location-form__error"
              >
                {formError}
              </Text>
            ) : null}
            <Button disabled={isCreating} type="submit">
              {isCreating ? 'Ukládám...' : 'Uložit místo'}
            </Button>
          </form>
        </div>
      </Sheet>

      <Sheet
        isOpen={activeLocationForZone !== null}
        onClose={resetZoneForm}
        title={
          activeLocationForZone
            ? `Nová zóna: ${activeLocationForZone.name}`
            : 'Nová zóna'
        }
      >
        <div className="location-form">
          <form onSubmit={handleCreateZone}>
            <TextField
              disabled={isCreating}
              label="Název zóny"
              name="zone_name"
              onChange={(event) => setZoneName(event.target.value)}
              placeholder="Balkon"
              required
              value={zoneName}
            />
            <ChoiceField
              disabled={isCreating}
              label="Prostředí"
              onValueChange={(value) => setZoneEnvironment(value)}
              options={ENVIRONMENT_OPTIONS}
              value={zoneEnvironment}
            />
            <ChoiceField
              disabled={isCreating}
              label="Světlo"
              onValueChange={(value) => setZoneLightExposure(value)}
              options={LIGHT_EXPOSURE_OPTIONS}
              value={zoneLightExposure}
            />
            <ChoiceField
              disabled={isCreating}
              label="Déšť"
              onValueChange={(value) => setZoneRainReach(value)}
              options={RAIN_REACH_OPTIONS}
              value={zoneRainReach}
            />
            <ChoiceField
              disabled={isCreating}
              label="Vítr"
              onValueChange={(value) => setZoneWindExposure(value)}
              options={WIND_EXPOSURE_OPTIONS}
              value={zoneWindExposure}
            />
            <Button disabled={isCreating} type="submit">
              {isCreating ? 'Ukládám...' : 'Uložit zónu'}
            </Button>
          </form>
        </div>
      </Sheet>

      <Sheet
        isOpen={activeZoneForContainer !== null}
        onClose={resetContainerForm}
        title={
          activeZoneForContainer
            ? `Nová nádoba: ${activeZoneForContainer.name}`
            : 'Nová nádoba'
        }
      >
        <div className="location-form">
          <form onSubmit={handleCreateContainer}>
            <TextField
              disabled={isCreating}
              label="Název nádoby"
              name="container_name"
              onChange={(event) => setContainerName(event.target.value)}
              placeholder="Velký truhlík"
              required
              value={containerName}
            />
            <ChoiceField
              disabled={isCreating}
              label="Typ"
              onValueChange={(value) => setContainerType(value)}
              options={CONTAINER_TYPE_OPTIONS}
              value={containerType}
            />
            <ChoiceField
              disabled={isCreating}
              label="Drenáž"
              onValueChange={(value) => setContainerDrainage(value)}
              options={CONTAINER_DRAINAGE_OPTIONS}
              value={containerDrainage}
            />
            <ChoiceField
              disabled={isCreating}
              label="Samozavlažovací"
              onValueChange={(value) => setContainerSelfWatering(value)}
              options={SELF_WATERING_OPTIONS}
              value={containerSelfWatering}
            />
            <TextField
              disabled={isCreating}
              inputMode="decimal"
              label="Objem (l, nepovinné)"
              name="container_volume"
              onChange={(event) => setContainerVolume(event.target.value)}
              placeholder="10"
              value={containerVolume}
            />
            <Button disabled={isCreating} type="submit">
              {isCreating ? 'Ukládám...' : 'Uložit nádobu'}
            </Button>
          </form>
        </div>
      </Sheet>

      {!isLoading && !error && locations.length === 0 ? (
        <EmptyState
          icon={<MapPin aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Zatím tu není žádné místo."
          variant="inline"
        />
      ) : null}

      {locations.length > 0 ? (
        <div className="place-tree">
          {locations.map((location) => (
            <article className="place-tree__location" key={location.id}>
              <div className="place-tree__header">
                <div>
                  <Text variant="title">{location.name}</Text>
                  <Text as="small" variant="caption">
                    {formatLocationCoordinates(
                      location.latitude,
                      location.longitude,
                    )}
                  </Text>
                  <LocationWeather
                    latitude={location.latitude}
                    locationId={location.id}
                    longitude={location.longitude}
                  />
                </div>
              </div>

              {location.zones.length === 0 ? (
                <Text as="p" variant="caption" className="place-tree__empty">
                  Žádná zóna.
                </Text>
              ) : null}

              <button
                className="place-tree__add-action"
                onClick={() => openZoneSheet(location)}
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
                Přidat zónu
              </button>

              {location.zones.map((zone) => (
                <section className="place-tree__zone" key={zone.id}>
                  <Text variant="title">{zone.name}</Text>

                  {zone.containers.length === 0 ? (
                    <Text as="p" variant="caption" className="place-tree__empty">
                      Žádná nádoba.
                    </Text>
                  ) : null}

                  {zone.containers.map((container) => (
                    <div className="place-tree__container" key={container.id}>
                      <Text as="span" variant="body">
                        {container.name}
                      </Text>
                    </div>
                  ))}

                  <button
                    className="place-tree__add-action"
                    onClick={() => openContainerSheet(zone)}
                    type="button"
                  >
                    <Plus aria-hidden="true" size={16} />
                    Přidat nádobu
                  </button>
                </section>
              ))}
            </article>
          ))}
        </div>
      ) : null}

      {!isCreateSheetOpen ? (
        <div className="screen-floating-action">
          <Button
            icon={<Plus aria-hidden="true" size={20} />}
            onClick={() => setIsCreateSheetOpen(true)}
          >
            Přidat
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatLocationCoordinates(
  latitude: number | null,
  longitude: number | null,
) {
  if (latitude == null || longitude == null) {
    return 'bez souřadnic';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function parseCoordinates(value: string) {
  const matches = value.trim().match(/(-?\d+(?:[.,]\d+)?)/g);
  if (!matches || matches.length < 2) {
    return null;
  }

  const latitude = Number(matches[0].replace(',', '.'));
  const longitude = Number(matches[1].replace(',', '.'));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const ENVIRONMENT_OPTIONS = [
  { label: 'Venku', value: 'outdoor' },
  { label: 'Krytý venek', value: 'covered_outdoor' },
  { label: 'Doma', value: 'indoor' },
] as const;

const LIGHT_EXPOSURE_OPTIONS = [
  { label: 'Nevím', value: 'unknown' },
  { label: 'Plné slunce', value: 'full_sun' },
  { label: 'Poloslunce', value: 'partial_sun' },
  { label: 'Světlé nepřímé', value: 'bright_indirect' },
  { label: 'Stín', value: 'shade' },
  { label: 'Mix', value: 'mixed' },
] as const;

const RAIN_REACH_OPTIONS = [
  { label: 'Částečně', value: 'partial' },
  { label: 'Plně', value: 'full' },
  { label: 'Vůbec', value: 'none' },
  { label: 'Doma', value: 'indoor' },
] as const;

const WIND_EXPOSURE_OPTIONS = [
  { label: 'Nevím', value: 'unknown' },
  { label: 'Nízký', value: 'low' },
  { label: 'Střední', value: 'medium' },
  { label: 'Vysoký', value: 'high' },
  { label: 'Doma', value: 'indoor' },
] as const;

const CONTAINER_TYPE_OPTIONS = [
  { label: 'Květináč', value: 'pot' },
  { label: 'Truhlík', value: 'trough' },
  { label: 'Nádoba', value: 'planter' },
  { label: 'Závěsný', value: 'hanging' },
  { label: 'Záhon', value: 'bed' },
  { label: 'Jiné', value: 'other' },
] as const;

const CONTAINER_DRAINAGE_OPTIONS = [
  { label: 'Nevím', value: 'unknown' },
  { label: 'Žádná', value: 'none' },
  { label: 'Omezená', value: 'limited' },
  { label: 'Dobrá', value: 'good' },
] as const;

const SELF_WATERING_OPTIONS = [
  { label: 'Ne', value: 'no' },
  { label: 'Ano', value: 'yes' },
] as const;
