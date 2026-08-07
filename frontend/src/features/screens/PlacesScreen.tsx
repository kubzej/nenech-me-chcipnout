import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ChevronRight, MapPin, Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ChoiceField } from '../../components/ui/ChoiceField';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Sheet } from '../../components/ui/Sheet';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { LocationWeather } from '../weather/LocationWeather';
import {
  apiDeleteAuthed,
  apiGetAuthed,
  apiPatchAuthed,
  apiPostAuthed,
} from '../../lib/api';
import type {
  ContainerCreateRequest,
  LocationCreateRequest,
  PlaceContainerOverview,
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
  const [editingLocation, setEditingLocation] =
    useState<PlaceLocationOverview | null>(null);
  const [editingZone, setEditingZone] =
    useState<{ zone: PlaceZoneOverview; locationId: string } | null>(null);
  const [editingContainer, setEditingContainer] = useState<{
    container: PlaceContainerOverview;
    zoneId: string;
  } | null>(null);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

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

  async function handleSubmitLocation(event: FormEvent<HTMLFormElement>) {
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
      if (editingLocation) {
        await apiPatchAuthed(
          `/api/places/locations/${editingLocation.id}`,
          payload,
        );
      } else {
        await apiPostAuthed('/api/places/locations', payload);
      }
      resetLocationForm();
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Místo se nepodařilo uložit.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openEditLocationSheet(location: PlaceLocationOverview) {
    setEditingLocation(location);
    setLocationName(location.name);
    setCoordinates(formatCoordinatesForInput(location.latitude, location.longitude));
    setFormError(null);
  }

  function resetLocationForm() {
    setIsCreateSheetOpen(false);
    setEditingLocation(null);
    setCoordinates('');
    setLocationName('');
    setFormError(null);
  }

  async function handleDeleteLocation(location: PlaceLocationOverview) {
    const zoneCount = location.zones.length;
    const confirmMessage =
      zoneCount > 0
        ? `Smazat místo „${location.name}" a ${zoneCount} zón(y) v něm?`
        : `Smazat místo „${location.name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/places/locations/${location.id}`);
      await loadPlaces({ showLoading: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Místo se nepodařilo smazat.',
      );
    }
  }

  async function handleSubmitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const locationId = editingZone ? editingZone.locationId : activeLocationForZone?.id;
    if (!locationId) {
      return;
    }

    const payload: ZoneCreateRequest = {
      environment: zoneEnvironment,
      light_exposure: zoneLightExposure,
      location_id: locationId,
      name: zoneName,
      rain_reach: zoneRainReach,
      wind_exposure: zoneWindExposure,
    };

    setError(null);
    setIsCreating(true);

    try {
      if (editingZone) {
        await apiPatchAuthed(`/api/places/zones/${editingZone.zone.id}`, payload);
      } else {
        await apiPostAuthed('/api/places/zones', payload);
      }
      resetZoneForm();
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Zónu se nepodařilo uložit.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function toggleZone(zoneId: string) {
    setExpandedZoneId((current) => (current === zoneId ? null : zoneId));
  }

  function openZoneSheet(location: PlaceLocationOverview) {
    setActiveLocationForZone(location);
    setZoneName('');
    setZoneEnvironment('outdoor');
    setZoneLightExposure('unknown');
    setZoneRainReach('partial');
    setZoneWindExposure('unknown');
  }

  function openEditZoneSheet(zone: PlaceZoneOverview, locationId: string) {
    setEditingZone({ zone, locationId });
    setZoneName(zone.name);
    setZoneEnvironment(zone.environment as ZoneCreateRequest['environment']);
    setZoneLightExposure(zone.light_exposure as ZoneCreateRequest['light_exposure']);
    setZoneRainReach(zone.rain_reach as ZoneCreateRequest['rain_reach']);
    setZoneWindExposure(zone.wind_exposure as ZoneCreateRequest['wind_exposure']);
  }

  function resetZoneForm() {
    setActiveLocationForZone(null);
    setEditingZone(null);
    setZoneName('');
    setZoneEnvironment('outdoor');
    setZoneLightExposure('unknown');
    setZoneRainReach('partial');
    setZoneWindExposure('unknown');
  }

  async function handleDeleteZone(zone: PlaceZoneOverview) {
    const containerCount = zone.containers.length;
    const confirmMessage =
      containerCount > 0
        ? `Smazat zónu „${zone.name}" a ${containerCount} nádob(y) v ní?`
        : `Smazat zónu „${zone.name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/places/zones/${zone.id}`);
      await loadPlaces({ showLoading: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Zónu se nepodařilo smazat.',
      );
    }
  }

  async function handleSubmitContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zoneId = editingContainer ? editingContainer.zoneId : activeZoneForContainer?.id;
    if (!zoneId) {
      return;
    }

    const payload: ContainerCreateRequest = {
      approx_volume_l: parseOptionalNumber(containerVolume),
      container_type: containerType,
      drainage: containerDrainage,
      name: containerName,
      self_watering: containerSelfWatering === 'yes',
      zone_id: zoneId,
    };

    setError(null);
    setIsCreating(true);

    try {
      if (editingContainer) {
        await apiPatchAuthed(
          `/api/places/containers/${editingContainer.container.id}`,
          payload,
        );
      } else {
        await apiPostAuthed('/api/places/containers', payload);
      }
      resetContainerForm();
      await loadPlaces({ showLoading: false });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Nádobu se nepodařilo uložit.',
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

  function openEditContainerSheet(container: PlaceContainerOverview, zoneId: string) {
    setEditingContainer({ container, zoneId });
    setContainerName(container.name);
    setContainerType(container.container_type as ContainerCreateRequest['container_type']);
    setContainerDrainage(
      container.drainage as NonNullable<ContainerCreateRequest['drainage']>,
    );
    setContainerSelfWatering(container.self_watering ? 'yes' : 'no');
    setContainerVolume(
      container.approx_volume_l != null ? String(container.approx_volume_l) : '',
    );
  }

  function resetContainerForm() {
    setActiveZoneForContainer(null);
    setEditingContainer(null);
    setContainerName('');
    setContainerType('pot');
    setContainerDrainage('unknown');
    setContainerSelfWatering('no');
    setContainerVolume('');
  }

  async function handleDeleteContainer(container: PlaceContainerOverview) {
    if (!window.confirm(`Smazat nádobu „${container.name}"?`)) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/places/containers/${container.id}`);
      await loadPlaces({ showLoading: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Nádobu se nepodařilo smazat.',
      );
    }
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
        isOpen={isCreateSheetOpen || editingLocation !== null}
        onClose={resetLocationForm}
        title={
          editingLocation ? `Upravit místo: ${editingLocation.name}` : 'Nové místo'
        }
      >
        <div className="location-form">
          <form onSubmit={handleSubmitLocation}>
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
              {isCreating
                ? 'Ukládám...'
                : editingLocation
                  ? 'Uložit změny'
                  : 'Uložit místo'}
            </Button>
            {editingLocation ? (
              <Button
                disabled={isCreating}
                onClick={() => handleDeleteLocation(editingLocation)}
                type="button"
                variant="ghost"
              >
                Smazat místo
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      <Sheet
        isOpen={activeLocationForZone !== null || editingZone !== null}
        onClose={resetZoneForm}
        title={
          editingZone
            ? `Upravit zónu: ${editingZone.zone.name}`
            : activeLocationForZone
              ? `Nová zóna: ${activeLocationForZone.name}`
              : 'Nová zóna'
        }
      >
        <div className="location-form">
          <form onSubmit={handleSubmitZone}>
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
              {isCreating
                ? 'Ukládám...'
                : editingZone
                  ? 'Uložit změny'
                  : 'Uložit zónu'}
            </Button>
            {editingZone ? (
              <Button
                disabled={isCreating}
                onClick={() => handleDeleteZone(editingZone.zone)}
                type="button"
                variant="ghost"
              >
                Smazat zónu
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      <Sheet
        isOpen={activeZoneForContainer !== null || editingContainer !== null}
        onClose={resetContainerForm}
        title={
          editingContainer
            ? `Upravit nádobu: ${editingContainer.container.name}`
            : activeZoneForContainer
              ? `Nová nádoba: ${activeZoneForContainer.name}`
              : 'Nová nádoba'
        }
      >
        <div className="location-form">
          <form onSubmit={handleSubmitContainer}>
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
              {isCreating
                ? 'Ukládám...'
                : editingContainer
                  ? 'Uložit změny'
                  : 'Uložit nádobu'}
            </Button>
            {editingContainer ? (
              <Button
                disabled={isCreating}
                onClick={() => handleDeleteContainer(editingContainer.container)}
                type="button"
                variant="ghost"
              >
                Smazat nádobu
              </Button>
            ) : null}
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
                <div className="place-tree__header-info">
                  <Text variant="title">{location.name}</Text>
                  <LocationWeather
                    latitude={location.latitude}
                    locationId={location.id}
                    longitude={location.longitude}
                  />
                </div>
                <IconButton
                  icon={<Pencil aria-hidden="true" size={16} />}
                  label="Upravit místo"
                  onClick={() => openEditLocationSheet(location)}
                  size="sm"
                />
              </div>

              {location.zones.length === 0 ? (
                <Text as="p" variant="caption" className="place-tree__empty">
                  Žádná zóna.
                </Text>
              ) : (
                <div className="place-tree__zone-list">
                  {location.zones.map((zone) => {
                    const isExpanded = expandedZoneId === zone.id;

                    return (
                      <div className="place-tree__zone" key={zone.id}>
                        <div className="place-tree__zone-row">
                          <button
                            aria-expanded={isExpanded}
                            className="place-tree__zone-toggle"
                            onClick={() => toggleZone(zone.id)}
                            type="button"
                          >
                            <Text as="span" variant="body">
                              {zone.name}
                            </Text>
                            <span className="place-tree__zone-row-meta">
                              <Text as="span" variant="caption">
                                {formatContainerCount(zone.containers.length)}
                              </Text>
                              <ChevronRight
                                aria-hidden="true"
                                className="place-tree__zone-chevron"
                                size={16}
                              />
                            </span>
                          </button>
                          <IconButton
                            icon={<Pencil aria-hidden="true" size={16} />}
                            label="Upravit zónu"
                            onClick={() => openEditZoneSheet(zone, location.id)}
                            size="sm"
                          />
                        </div>

                        {isExpanded ? (
                          <div className="place-tree__zone-body">
                            {zone.containers.length === 0 ? (
                              <Text as="p" variant="caption" className="place-tree__empty">
                                Žádná nádoba.
                              </Text>
                            ) : (
                              zone.containers.map((container) => (
                                <div className="place-tree__container" key={container.id}>
                                  <Text as="span" variant="body">
                                    {container.name}
                                  </Text>
                                  <IconButton
                                    icon={<Pencil aria-hidden="true" size={16} />}
                                    label="Upravit nádobu"
                                    onClick={() => openEditContainerSheet(container, zone.id)}
                                    size="sm"
                                  />
                                </div>
                              ))
                            )}

                            <button
                              className="place-tree__add-action"
                              onClick={() => openContainerSheet(zone)}
                              type="button"
                            >
                              <Plus aria-hidden="true" size={16} />
                              Přidat nádobu
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="place-tree__add-action"
                onClick={() => openZoneSheet(location)}
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
                Přidat zónu
              </button>
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

function formatContainerCount(count: number) {
  if (count === 0) {
    return 'žádná nádoba';
  }
  if (count === 1) {
    return '1 nádoba';
  }
  if (count >= 2 && count <= 4) {
    return `${count} nádoby`;
  }
  return `${count} nádob`;
}

function formatCoordinatesForInput(
  latitude: number | null,
  longitude: number | null,
) {
  if (latitude == null || longitude == null) {
    return '';
  }

  return `${latitude}, ${longitude}`;
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
