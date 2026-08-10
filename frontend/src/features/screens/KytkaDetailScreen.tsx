import { FormEvent, useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CloudSun,
  Droplets,
  Eye,
  Pencil,
  Plus,
  Sprout,
  Stethoscope,
  Sun,
  Thermometer,
  Wrench,
} from "lucide-react";
import {
  LEVEL_OPTIONS,
  LIGHT_NEED_OPTIONS,
  MOISTURE_OPTIONS,
} from "../../components/care-profile/CareProfileFields";
import {
  CareEventFields,
  CONDITION_OPTIONS,
  DEFAULT_CARE_EVENT_VALUES,
} from "../../components/care-event/CareEventFields";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Text } from "../../components/ui/Text";
import {
  apiDeleteAuthed,
  apiGetAuthed,
  apiPatchAuthed,
  apiPostAuthed,
} from "../../lib/api";
import type { CareEventCreateRequest, CareEventItem } from "../../types/care-event";
import type { CareProfileItem } from "../../types/care-profile";
import type { KytkaListItem } from "../../types/kytka";
import "./screen.css";

type KytkaDetailScreenProps = {
  careProfile: CareProfileItem | null;
  kytka: KytkaListItem;
  onBack: () => void;
  onDataChanged: () => void;
  onEdit: () => void;
};

export function KytkaDetailScreen({
  careProfile,
  kytka,
  onBack,
  onDataChanged,
  onEdit,
}: KytkaDetailScreenProps) {
  const [events, setEvents] = useState<CareEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CareEventItem | null>(null);
  const [formValues, setFormValues] = useState<Omit<CareEventCreateRequest, "kytka_id">>(
    DEFAULT_CARE_EVENT_VALUES,
  );

  const loadEvents = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiGetAuthed<CareEventItem[]>(`/api/kytky/${kytka.id}/events`);
      setEvents(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Historie se nenačetla.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [kytka.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  function openCreateEventSheet() {
    setEditingEvent(null);
    setFormValues(DEFAULT_CARE_EVENT_VALUES);
    setIsEventSheetOpen(true);
  }

  function openEditEventSheet(event: CareEventItem) {
    setEditingEvent(event);
    setFormValues({
      event_type: event.event_type as CareEventCreateRequest["event_type"],
      occurred_at: event.occurred_at,
      amount_ml: event.amount_ml,
      method: event.method,
      condition: event.condition as CareEventCreateRequest["condition"],
      note: event.note,
    });
  }

  function resetEventForm() {
    setIsEventSheetOpen(false);
    setEditingEvent(null);
    setFormValues(DEFAULT_CARE_EVENT_VALUES);
  }

  async function handleSubmitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload: CareEventCreateRequest = { kytka_id: kytka.id, ...formValues };

    try {
      if (editingEvent) {
        await apiPatchAuthed(`/api/care-events/${editingEvent.id}`, payload);
      } else {
        await apiPostAuthed("/api/care-events", payload);
      }
      resetEventForm();
      await loadEvents();
      onDataChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Event se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvent(event: CareEventItem) {
    if (!window.confirm(`Smazat tento záznam (${formatEventType(event.event_type)})?`)) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/care-events/${event.id}`);
      resetEventForm();
      await loadEvents();
      onDataChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Event se nepodařilo smazat.",
      );
    }
  }

  const profileLines = careProfile ? buildProfileSummaryLines(careProfile) : [];

  return (
    <section
      className="screen screen--stack screen--with-floating-action"
      aria-label={kytka.display_name}
    >
      <ScreenHeader title={kytka.display_name} />

      <div className="kytka-detail__header-actions">
        <Button
          icon={<ArrowLeft aria-hidden="true" size={18} />}
          onClick={onBack}
          variant="ghost"
        >
          Zpět
        </Button>
        <IconButton
          icon={<Pencil aria-hidden="true" size={18} />}
          label="Upravit kytku"
          onClick={onEdit}
          variant="surface"
        />
      </div>

      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {careProfile ? (
        <div className="entity-card kytka-detail__profile-summary">
          <Text as="p" variant="label">
            Care profil
          </Text>
          <div>
            <Text as="p" variant="title">
              {careProfile.name}
            </Text>
            {careProfile.scientific_name ? (
              <Text
                as="p"
                tone="muted"
                variant="caption"
                className="kytka-detail__scientific-name"
              >
                {careProfile.scientific_name}
              </Text>
            ) : null}
          </div>
          {profileLines.map((line) => {
            const Icon = line.icon;
            return (
              <div className="kytka-detail__profile-line" key={line.key}>
                <Icon aria-hidden="true" size={18} />
                <Text as="p" tone={line.emphasize ? "danger" : "default"} variant="body">
                  {line.text}
                </Text>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="kytka-detail__history">
        <Text as="p" variant="label">
          Historie
        </Text>

        {isLoading ? <SkeletonCard aria-label="Načítám historii" lines={2} /> : null}

        {!isLoading && events.length === 0 ? (
          <EmptyState
            icon={<Droplets aria-hidden="true" size={30} strokeWidth={2.1} />}
            title="Zatím žádná historie."
            variant="inline"
          />
        ) : null}

        {events.length > 0 ? (
          <div className="entity-list">
            {events.map((event) => {
              const EventIcon = EVENT_TYPE_ICONS[event.event_type] ?? Droplets;
              return (
                <button
                  className="entity-card kytka-detail__event-row"
                  key={event.id}
                  onClick={() => openEditEventSheet(event)}
                  type="button"
                >
                  <div className="kytka-detail__event-row-title">
                    <EventIcon aria-hidden="true" size={18} />
                    <Text as="span" variant="title">
                      {formatEventType(event.event_type)}
                    </Text>
                  </div>
                  <Text as="span" tone="muted" variant="caption">
                    {formatEventDateTime(event.occurred_at)}
                  </Text>
                  {formatEventDetail(event) ? (
                    <Text as="span" tone="muted" variant="caption">
                      {formatEventDetail(event)}
                    </Text>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <Sheet
        isOpen={isEventSheetOpen || editingEvent !== null}
        onClose={resetEventForm}
        title={editingEvent ? "Upravit event" : "Přidat event"}
      >
        <div className="location-form">
          <form onSubmit={handleSubmitEvent}>
            <CareEventFields
              disabled={isSaving}
              onChange={(patch) =>
                setFormValues((current) => ({ ...current, ...patch }))
              }
              showOccurredAt={editingEvent !== null}
              values={formValues}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : editingEvent ? "Uložit změny" : "Uložit event"}
            </Button>
            {editingEvent ? (
              <Button
                disabled={isSaving}
                onClick={() => handleDeleteEvent(editingEvent)}
                type="button"
                variant="ghost"
              >
                Smazat
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      {!isEventSheetOpen && editingEvent === null ? (
        <div className="screen-floating-action">
          <Button icon={<Plus aria-hidden="true" size={20} />} onClick={openCreateEventSheet}>
            Přidat event
          </Button>
        </div>
      ) : null}
    </section>
  );
}

type ProfileSummaryLine = {
  emphasize?: boolean;
  icon: LucideIcon;
  key: string;
  text: string;
};

function buildProfileSummaryLines(profile: CareProfileItem): ProfileSummaryLine[] {
  const lines: ProfileSummaryLine[] = [];

  const watering = buildWateringLine(profile);
  if (watering) {
    lines.push({ icon: Droplets, key: "watering", text: watering });
  }

  if (profile.light_need && profile.light_need !== "unknown") {
    lines.push({
      icon: Sun,
      key: "light",
      text: findLabel(LIGHT_NEED_OPTIONS, profile.light_need),
    });
  }

  const temperature = buildTemperatureLine(profile);
  if (temperature) {
    lines.push({ icon: Thermometer, key: "temperature", text: temperature });
  }

  const feeding = buildFeedingLine(profile);
  if (feeding) {
    lines.push({ icon: Sprout, key: "feeding", text: feeding });
  }

  if (profile.maintenance_notes) {
    lines.push({ icon: Wrench, key: "maintenance", text: profile.maintenance_notes });
  }

  if (profile.risk_notes) {
    lines.push({
      emphasize: true,
      icon: AlertTriangle,
      key: "risk",
      text: profile.risk_notes,
    });
  }

  return lines;
}

function buildWateringLine(profile: CareProfileItem): string | null {
  const parts: string[] = [];

  if (profile.water_interval_min_days != null && profile.water_interval_max_days != null) {
    parts.push(`zalévat každých ${profile.water_interval_min_days}–${profile.water_interval_max_days} dní`);
  } else if (profile.water_interval_min_days != null) {
    parts.push(`zalévat alespoň každých ${profile.water_interval_min_days} dní`);
  } else if (profile.water_interval_max_days != null) {
    parts.push(`zalévat nejpozději za ${profile.water_interval_max_days} dní`);
  }

  if (profile.moisture_preference && profile.moisture_preference !== "unknown") {
    parts.push(findLabel(MOISTURE_OPTIONS, profile.moisture_preference).toLowerCase());
  }
  if (profile.drought_tolerance && profile.drought_tolerance !== "unknown") {
    parts.push(`sucho snáší ${findLabel(LEVEL_OPTIONS, profile.drought_tolerance).toLowerCase()}`);
  }
  if (profile.overwatering_risk && profile.overwatering_risk !== "unknown") {
    parts.push(`riziko přelití ${findLabel(LEVEL_OPTIONS, profile.overwatering_risk).toLowerCase()}`);
  }
  if (profile.watering_method) {
    parts.push(profile.watering_method);
  }

  return parts.length > 0 ? capitalize(parts.join(", ")) : null;
}

function buildTemperatureLine(profile: CareProfileItem): string | null {
  if (profile.heat_sensitive_above_c == null && profile.cold_sensitive_below_c == null) {
    return null;
  }

  const parts: string[] = [];
  if (profile.heat_sensitive_above_c != null) {
    parts.push(`vadí horko nad ${profile.heat_sensitive_above_c} °C`);
  }
  if (profile.cold_sensitive_below_c != null) {
    parts.push(`vadí zima pod ${profile.cold_sensitive_below_c} °C`);
  }
  if (profile.frost_sensitive) {
    parts.push("citlivá na mráz");
  }

  return capitalize(parts.join(", "));
}

function buildFeedingLine(profile: CareProfileItem): string | null {
  if (!profile.feeding_enabled) {
    return null;
  }

  const parts: string[] = ["Hnojit"];
  if (profile.feeding_interval_days != null) {
    parts.push(`každých ${profile.feeding_interval_days} dní`);
  }
  if (profile.feeding_months && profile.feeding_months.length > 0) {
    parts.push(`v měsících ${profile.feeding_months.join(", ")}`);
  }

  return parts.join(" ");
}

function findLabel(options: readonly { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  watering: "Zalévání",
  fertilizing: "Hnojení",
  checkin: "Kontrola",
  pest_observation: "Škůdci",
  treatment: "Ošetření",
  maintenance: "Údržba",
  weather_protection: "Ochrana před počasím",
};

const EVENT_TYPE_ICONS: Record<string, LucideIcon> = {
  watering: Droplets,
  fertilizing: Sprout,
  checkin: Eye,
  pest_observation: Bug,
  treatment: Stethoscope,
  maintenance: Wrench,
  weather_protection: CloudSun,
};

function formatEventType(eventType: string) {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatEventDateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventDetail(event: CareEventItem) {
  const parts: string[] = [];
  if (event.condition && event.condition !== "unknown") {
    parts.push(findLabel(CONDITION_OPTIONS, event.condition));
  }
  if (event.method) {
    parts.push(event.method);
  }
  if (event.amount_ml != null) {
    parts.push(`${event.amount_ml} ml`);
  }
  if (event.note) {
    parts.push(event.note);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
