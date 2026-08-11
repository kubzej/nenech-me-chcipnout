import { ChoiceField } from "../ui/ChoiceField";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";
import type { CareEventCondition, CareEventCreateRequest } from "../../types/care-event";

export const DEFAULT_CARE_EVENT_VALUES: Omit<CareEventCreateRequest, "kytka_id"> = {
  event_type: "watering",
  occurred_at: null,
  amount_ml: null,
  method: null,
  condition: null,
  note: null,
};

type CareEventFieldsProps = {
  disabled?: boolean;
  /** Kytka's current status — pre-selects "Jak jí je?" so saving
   * without touching it makes no change. */
  kytkaStatus?: string;
  onChange: (patch: Partial<Omit<CareEventCreateRequest, "kytka_id">>) => void;
  onPhotoChange?: (file: File | null) => void;
  photoFile?: File | null;
  showOccurredAt?: boolean;
  values: Omit<CareEventCreateRequest, "kytka_id">;
};

export function CareEventFields({
  disabled = false,
  kytkaStatus,
  onChange,
  onPhotoChange,
  photoFile,
  showOccurredAt = false,
  values,
}: CareEventFieldsProps) {
  function handleTypeChange(eventType: CareEventCreateRequest["event_type"]) {
    onChange({
      event_type: eventType,
      amount_ml: null,
      method: null,
      condition: null,
      note: null,
    });
  }

  const showMethodAndAmount = WATERING_LIKE_TYPES.includes(values.event_type);
  const showCondition = CONDITION_TYPES.includes(values.event_type);
  const showMethodOnly = values.event_type === "treatment";

  return (
    <>
      <ChoiceField
        disabled={disabled}
        label="Typ"
        onValueChange={handleTypeChange}
        options={EVENT_TYPE_OPTIONS}
        value={values.event_type}
      />
      {showOccurredAt ? (
        <TextField
          disabled={disabled}
          label="Kdy"
          onChange={(event) =>
            onChange({ occurred_at: fromDatetimeLocalValue(event.target.value) })
          }
          type="datetime-local"
          value={toDatetimeLocalValue(values.occurred_at)}
        />
      ) : null}
      {showMethodAndAmount ? (
        <>
          <TextField
            disabled={disabled}
            label="Metoda (nepovinné)"
            onChange={(event) => onChange({ method: event.target.value || null })}
            value={values.method ?? ""}
          />
          <TextField
            disabled={disabled}
            inputMode="numeric"
            label="Množství (ml, nepovinné)"
            onChange={(event) =>
              onChange({ amount_ml: parseOptionalInt(event.target.value) })
            }
            value={values.amount_ml ?? ""}
          />
        </>
      ) : null}
      {showMethodOnly ? (
        <TextField
          disabled={disabled}
          label="Metoda (nepovinné)"
          onChange={(event) => onChange({ method: event.target.value || null })}
          value={values.method ?? ""}
        />
      ) : null}
      {showCondition ? (
        <ChoiceField
          disabled={disabled}
          label="Jak jí je?"
          onValueChange={(value) => onChange({ condition: value })}
          options={PLANT_STATUS_OPTIONS}
          value={
            values.condition ??
            (isPlantStatus(kytkaStatus) ? kytkaStatus : "ok")
          }
        />
      ) : null}
      {showCondition && onPhotoChange ? (
        <label className="text-field">
          <Text as="span" variant="label">
            Foto (nepovinné)
          </Text>
          <input
            accept="image/*"
            disabled={disabled}
            onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          {photoFile ? (
            <Text as="span" variant="caption" tone="muted">
              {photoFile.name}
            </Text>
          ) : null}
        </label>
      ) : null}
      <TextField
        disabled={disabled}
        label="Poznámka (nepovinné)"
        onChange={(event) => onChange({ note: event.target.value || null })}
        value={values.note ?? ""}
      />
    </>
  );
}

function isPlantStatus(value: string | undefined): value is CareEventCondition {
  return value === "ok" || value === "monitoring" || value === "sick";
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const WATERING_LIKE_TYPES: CareEventCreateRequest["event_type"][] = [
  "watering",
  "fertilizing",
];

const CONDITION_TYPES: CareEventCreateRequest["event_type"][] = [
  "checkin",
  "pest_observation",
];

const EVENT_TYPE_OPTIONS = [
  { label: "Zalévání", value: "watering" },
  { label: "Hnojení", value: "fertilizing" },
  { label: "Kontrola", value: "checkin" },
  { label: "Škůdci", value: "pest_observation" },
  { label: "Ošetření", value: "treatment" },
  { label: "Údržba", value: "maintenance" },
] as const;

// "Jak jí je?" — sets kytky.status directly, no inferred rules.
export const PLANT_STATUS_OPTIONS = [
  { label: "OK", value: "ok" },
  { label: "Sledovaná", value: "monitoring" },
  { label: "Nemocná", value: "sick" },
] as const;

// Legacy symptom picklist — still used for the standalone photo's health
// snapshot (a descriptive tag, not a status-setting field), and to label
// old care_events rows logged before this field became "Jak jí je?".
export const PHOTO_HEALTH_OPTIONS = [
  { label: "Nevím", value: "unknown" },
  { label: "OK", value: "ok" },
  { label: "Suchý", value: "dry" },
  { label: "Mokrý", value: "wet" },
  { label: "Vadne", value: "wilting" },
  { label: "Žloutne", value: "yellowing" },
  { label: "Škůdci", value: "pests" },
  { label: "Poškozený", value: "damaged" },
] as const;
