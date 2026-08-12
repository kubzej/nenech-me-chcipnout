import { useState } from "react";
import { ClipboardPaste, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { ChoiceField } from "../ui/ChoiceField";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";
import type { CareProfileCreateRequest } from "../../types/care-profile";
import "./care-profile-fields.css";

export const DEFAULT_CARE_PROFILE_VALUES: CareProfileCreateRequest = {
  name: "",
  scientific_name: null,
  water_interval_min_days: null,
  water_interval_max_days: null,
  moisture_preference: null,
  drought_tolerance: null,
  overwatering_risk: null,
  default_water_amount_ml: null,
  watering_method: null,
  light_need: null,
  heat_sensitive_above_c: null,
  cold_sensitive_below_c: null,
  frost_sensitive: true,
  feeding_enabled: false,
  feeding_interval_days: null,
  feeding_months: null,
  check_interval_days: 7,
  photo_interval_days: 7,
  pest_check_interval_days: null,
  maintenance_interval_days: null,
  maintenance_notes: null,
  risk_notes: null,
  survival_watering_hint: null,
  survival_heat_hint: null,
  survival_frost_hint: null,
  survival_fertilizing_hint: null,
};

type CareProfileFieldsProps = {
  disabled?: boolean;
  onChange: (patch: Partial<CareProfileCreateRequest>) => void;
  values: CareProfileCreateRequest;
};

export function CareProfileFields({
  disabled = false,
  onChange,
  values,
}: CareProfileFieldsProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [jsonPaste, setJsonPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isFilled, setIsFilled] = useState(false);

  async function handleCopyPrompt() {
    const species = values.name.trim() || "<doplň název druhu>";
    const scientificName = values.scientific_name?.trim() || null;
    try {
      await navigator.clipboard.writeText(buildAiPrompt(species, scientificName));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — no
      // recovery needed here, the prompt text is visible in the function
      // above for manual copy if this ever happens.
    }
  }

  function handleUseJson() {
    const { patch, error } = parseAiJson(jsonPaste);
    if (error) {
      setPasteError(error);
      return;
    }

    const { patch: safePatch, warning } = stripOversizedFields(patch);
    onChange(safePatch);
    setIsFilled(true);
    setTimeout(() => setIsFilled(false), 2000);

    if (warning) {
      // Keep the paste box open with the pasted text so the warning has
      // context — closing it would hide which field still needs fixing.
      setPasteError(warning);
      return;
    }

    setPasteError(null);
    setJsonPaste("");
    setIsPasteOpen(false);
  }

  return (
    <>
      <TextField
        disabled={disabled}
        label="Název"
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder="Muškát"
        required
        value={values.name}
      />
      <TextField
        disabled={disabled}
        label="Vědecký název (nepovinné)"
        onChange={(event) =>
          onChange({ scientific_name: event.target.value || null })
        }
        placeholder="Pelargonium"
        value={values.scientific_name ?? ""}
      />
      <div className="care-profile-ai-actions">
        <Button
          icon={<Copy aria-hidden="true" size={16} />}
          onClick={handleCopyPrompt}
          type="button"
          variant="ghost"
        >
          {isCopied ? "Zkopírováno!" : "Prompt"}
        </Button>
        <Button
          icon={<ClipboardPaste aria-hidden="true" size={16} />}
          onClick={() => setIsPasteOpen((current) => !current)}
          type="button"
          variant="ghost"
        >
          {isFilled ? "Vyplněno!" : "Vložit JSON"}
        </Button>
      </div>

      {isPasteOpen ? (
        <label className="text-field">
          <Text as="span" variant="label">
            Odpověď od AI (JSON)
          </Text>
          <textarea
            disabled={disabled}
            onChange={(event) => {
              setJsonPaste(event.target.value);
              setPasteError(null);
            }}
            placeholder="Sem vlož JSON, co ti vrátila AI"
            rows={6}
            value={jsonPaste}
          />
          {pasteError ? (
            <Text as="p" variant="caption" tone="danger">
              {pasteError}
            </Text>
          ) : null}
          <Button disabled={disabled || !jsonPaste.trim()} onClick={handleUseJson} type="button">
            Použít
          </Button>
        </label>
      ) : null}

      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Zalévat od (dní, nepovinné)"
        onChange={(event) =>
          onChange({
            water_interval_min_days: parseOptionalInt(event.target.value),
          })
        }
        value={values.water_interval_min_days ?? ""}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Nejpozději zalít po (dní, nepovinné)"
        onChange={(event) =>
          onChange({
            water_interval_max_days: parseOptionalInt(event.target.value),
          })
        }
        value={values.water_interval_max_days ?? ""}
      />
      <ChoiceField
        disabled={disabled}
        label="Vlhkost substrátu"
        onValueChange={(value) => onChange({ moisture_preference: value })}
        options={MOISTURE_OPTIONS}
        value={values.moisture_preference ?? "unknown"}
      />
      <ChoiceField
        disabled={disabled}
        label="Snáší sucho"
        onValueChange={(value) => onChange({ drought_tolerance: value })}
        options={LEVEL_OPTIONS}
        value={values.drought_tolerance ?? "unknown"}
      />
      <ChoiceField
        disabled={disabled}
        label="Riziko přelití"
        onValueChange={(value) => onChange({ overwatering_risk: value })}
        options={LEVEL_OPTIONS}
        value={values.overwatering_risk ?? "unknown"}
      />
      <TextField
        disabled={disabled}
        label="Způsob zalévání (nepovinné)"
        onChange={(event) =>
          onChange({ watering_method: event.target.value || null })
        }
        placeholder="Zalévat u kořenů, ne na listy"
        value={values.watering_method ?? ""}
      />
      <ChoiceField
        disabled={disabled}
        label="Nároky na světlo"
        onValueChange={(value) => onChange({ light_need: value })}
        options={LIGHT_NEED_OPTIONS}
        value={values.light_need ?? "unknown"}
      />
      <TextField
        disabled={disabled}
        inputMode="decimal"
        label="Vadí horko nad (°C, nepovinné)"
        onChange={(event) =>
          onChange({
            heat_sensitive_above_c: parseOptionalFloat(event.target.value),
          })
        }
        value={values.heat_sensitive_above_c ?? ""}
      />
      <TextField
        disabled={disabled}
        inputMode="decimal"
        label="Vadí zima pod (°C, nepovinné)"
        onChange={(event) =>
          onChange({
            cold_sensitive_below_c: parseOptionalFloat(event.target.value),
          })
        }
        value={values.cold_sensitive_below_c ?? ""}
      />
      <ChoiceField
        disabled={disabled}
        label="Citlivá na mráz"
        onValueChange={(value) => onChange({ frost_sensitive: value === "yes" })}
        options={YES_NO_OPTIONS}
        value={values.frost_sensitive ? "yes" : "no"}
      />
      <ChoiceField
        disabled={disabled}
        label="Hnojit"
        onValueChange={(value) => onChange({ feeding_enabled: value === "yes" })}
        options={YES_NO_OPTIONS}
        value={values.feeding_enabled ? "yes" : "no"}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Interval hnojení (dní, nepovinné)"
        onChange={(event) =>
          onChange({
            feeding_interval_days: parseOptionalInt(event.target.value),
          })
        }
        value={values.feeding_interval_days ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Měsíce hnojení (1-12, oddělené čárkou, nepovinné)"
        onChange={(event) =>
          onChange({ feeding_months: parseMonths(event.target.value) })
        }
        placeholder="3,4,5,6,7,8"
        value={(values.feeding_months ?? []).join(",")}
      />
      <TextField
        disabled={disabled}
        label="Údržba (nepovinné)"
        onChange={(event) =>
          onChange({ maintenance_notes: event.target.value || null })
        }
        value={values.maintenance_notes ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Rizika (nepovinné)"
        onChange={(event) => onChange({ risk_notes: event.target.value || null })}
        value={values.risk_notes ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Survival hint: zálivka (max 120 znaků, nepovinné)"
        onChange={(event) =>
          onChange({ survival_watering_hint: event.target.value || null })
        }
        value={values.survival_watering_hint ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Survival hint: horko (max 120 znaků, nepovinné)"
        onChange={(event) =>
          onChange({ survival_heat_hint: event.target.value || null })
        }
        value={values.survival_heat_hint ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Survival hint: mráz/chlad (max 120 znaků, nepovinné)"
        onChange={(event) =>
          onChange({ survival_frost_hint: event.target.value || null })
        }
        value={values.survival_frost_hint ?? ""}
      />
      <TextField
        disabled={disabled}
        label="Survival hint: hnojení (max 120 znaků, nepovinné)"
        onChange={(event) =>
          onChange({ survival_fertilizing_hint: event.target.value || null })
        }
        value={values.survival_fertilizing_hint ?? ""}
      />

      <Text as="p" tone="muted" variant="caption">
        Appková nastavení — tohle není vlastnost druhu, AI se na to neptá.
        Výchozí hodnoty jsou v pohodě nechat být.
      </Text>
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Množství vody (ml, orientační, záleží na nádobě, nepovinné)"
        onChange={(event) =>
          onChange({
            default_water_amount_ml: parseOptionalInt(event.target.value),
          })
        }
        value={values.default_water_amount_ml ?? ""}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Vizuální kontrola (dní)"
        onChange={(event) =>
          onChange({
            check_interval_days: parseOptionalInt(event.target.value) ?? 7,
          })
        }
        value={values.check_interval_days}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Fotka do historie (dní)"
        onChange={(event) =>
          onChange({
            photo_interval_days: parseOptionalInt(event.target.value) ?? 7,
          })
        }
        value={values.photo_interval_days}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Kontrola škůdců (dní, nepovinné)"
        onChange={(event) =>
          onChange({
            pest_check_interval_days: parseOptionalInt(event.target.value),
          })
        }
        value={values.pest_check_interval_days ?? ""}
      />
      <TextField
        disabled={disabled}
        inputMode="numeric"
        label="Údržba — prořezat/přesadit/otočit (dní, nepovinné)"
        onChange={(event) =>
          onChange({
            maintenance_interval_days: parseOptionalInt(event.target.value),
          })
        }
        value={values.maintenance_interval_days ?? ""}
      />
    </>
  );
}

function buildAiPrompt(species: string, scientificName: string | null) {
  const intro = scientificName
    ? `Jsem majitel pokojové/balkónové rostliny "${species}" (vědecký název: ${scientificName}).`
    : `Jsem majitel pokojové/balkónové rostliny "${species}".`;
  const scientificNameLine = scientificName
    ? ""
    : '  "scientific_name": <vědecký název jako string, max 160 znaků, nebo null>,\n';

  return `${intro} Potřebuju od tebe přesné a spolehlivé hodnoty pro moji
aplikaci na péči o rostliny — appka z nich pak generuje připomínky
zalévání a hnojení, takže nesmyslné/vymyšlené hodnoty mi reálně uškodí
rostlině. Pokud máš možnost prohledávat internet, radši si dohledej
aktuální zahradnické/botanické zdroje k tomuto konkrétnímu druhu, než
abys hodnoty jen odhadoval z paměti. U čehokoliv, čím si nejsi jistý, dej
hodnotu null místo vymyšleného čísla.

Ptám se jen na věci, které jsou skutečně vlastností druhu. Neptám se třeba
na množství vody v ml na jedno zalití (to závisí na velikosti nádoby, ne
na druhu — místo toho popiš praktický způsob v "watering_method", např.
"zalévat, dokud voda nezačne odtékat z drenáže") ani na frekvenci
kontrol/fotek (to je moje vlastní rozhodnutí o appce, ne botanický fakt).

Survival hinty jsou krátké věty pro kartu "Dnes". Piš je civilně, česky,
bez odborných zkratek a max 120 znaků. "survival_watering_hint" smí být jen
věta, která platí při každém zalití a zabrání typické chybě. Počasové rady
nepiš do zálivky — horko patří do "survival_heat_hint", mráz/chlad do
"survival_frost_hint". Pokud není co užitečného krátce říct, vrať null.

Odpověz ČISTĚ jako JSON objekt (bez markdown bloku, bez dalšího textu
kolem) přesně v tomto tvaru:

{
${scientificNameLine}  "water_interval_min_days": <po kolika dnech typicky začít zvažovat běžné zalití, číslo nebo null>,
  "water_interval_max_days": <nejzazší bezpečný interval bez zalití, číslo nebo null>,
  "moisture_preference": <jedno z: "dry_between", "slightly_moist", "moist", "wet", nebo null>,
  "drought_tolerance": <jedno z: "low", "medium", "high", nebo null>,
  "overwatering_risk": <jedno z: "low", "medium", "high", nebo null>,
  "watering_method": <praktický popis jako string, MAX 240 znaků — jedna stručná věta, např. "zalévat, dokud voda nezačne odtékat z drenáže, mezitím nechat svrchní vrstvu proschnout">,
  "light_need": <jedno z: "full_sun", "partial_sun", "bright_indirect", "shade", nebo null>,
  "heat_sensitive_above_c": <°C jako číslo, nebo null>,
  "cold_sensitive_below_c": <°C jako číslo, nebo null>,
  "frost_sensitive": <true nebo false>,
  "feeding_enabled": <true nebo false>,
  "feeding_interval_days": <číslo nebo null>,
  "feeding_months": <pole čísel 1-12, nebo null>,
  "maintenance_notes": <krátká poznámka jako string, nebo null>,
  "risk_notes": <krátká poznámka jako string, nebo null>,
  "survival_watering_hint": <jedna krátká praktická věta pro kartu Dnes, česky, max 120 znaků, nebo null>,
  "survival_heat_hint": <jedna krátká praktická věta pro horko, česky, max 120 znaků, nebo null>,
  "survival_frost_hint": <jedna krátká praktická věta pro mráz/chlad, česky, max 120 znaků, nebo null>,
  "survival_fertilizing_hint": <jedna krátká praktická věta pro hnojení, česky, max 120 znaků, nebo null>
}`;
}

function parseAiJson(raw: string): {
  patch: Partial<CareProfileCreateRequest>;
  error: string | null;
} {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!cleaned) {
    return { patch: {}, error: "Vlož JSON, co ti vrátila AI." };
  }

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return {
      patch: {},
      error: "Nejde přečíst jako JSON — zkontroluj, že jsi vložil celou odpověď.",
    };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { patch: {}, error: "Očekávám JSON objekt s hodnotami." };
  }

  const obj = data as Record<string, unknown>;
  const patch: Partial<CareProfileCreateRequest> = {};

  for (const key of Object.keys(FIELD_PARSERS) as Array<keyof typeof FIELD_PARSERS>) {
    if (!(key in obj)) {
      continue;
    }
    const parsed = FIELD_PARSERS[key]?.(obj[key]);
    if (parsed !== undefined) {
      (patch as Record<string, unknown>)[key] = parsed;
    }
  }

  return { patch, error: null };
}

const AI_FIELD_MAX_LENGTHS: Partial<Record<keyof CareProfileCreateRequest, number>> = {
  scientific_name: 160,
  survival_fertilizing_hint: 120,
  survival_frost_hint: 120,
  survival_heat_hint: 120,
  survival_watering_hint: 120,
  watering_method: 240,
};

const AI_FIELD_LABELS: Partial<Record<keyof CareProfileCreateRequest, string>> = {
  scientific_name: "vědecký název",
  survival_fertilizing_hint: "survival hint hnojení",
  survival_frost_hint: "survival hint mráz/chlad",
  survival_heat_hint: "survival hint horko",
  survival_watering_hint: "survival hint zálivka",
  watering_method: "způsob zalévání",
};

function stripOversizedFields(patch: Partial<CareProfileCreateRequest>): {
  patch: Partial<CareProfileCreateRequest>;
  warning: string | null;
} {
  const next = { ...patch };
  const skipped: string[] = [];

  for (const key of Object.keys(AI_FIELD_MAX_LENGTHS) as Array<
    keyof CareProfileCreateRequest
  >) {
    const max = AI_FIELD_MAX_LENGTHS[key];
    const value = next[key];
    if (max !== undefined && typeof value === "string" && value.length > max) {
      delete next[key];
      skipped.push(`${AI_FIELD_LABELS[key]} (${value.length} znaků, max ${max})`);
    }
  }

  const warning =
    skipped.length > 0
      ? `Tohle bylo v AI odpovědi moc dlouhé, doplň to ručně: ${skipped.join(", ")}.`
      : null;

  return { patch: next, warning };
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim() || null;
  }
  return undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asMonthsArray(value: unknown): number[] | null | undefined {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    const months = value.filter(
      (item): item is number =>
        typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 12,
    );
    return months.length > 0 ? months : null;
  }
  return undefined;
}

function asRequiredNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asEnum<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<{ value: T }>,
): T | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && allowed.some((option) => option.value === value)) {
    return value as T;
  }
  return undefined;
}

const FIELD_PARSERS: {
  [K in keyof CareProfileCreateRequest]?: (value: unknown) => CareProfileCreateRequest[K] | undefined;
} = {
  scientific_name: asNullableString,
  water_interval_min_days: asNullableNumber,
  water_interval_max_days: asNullableNumber,
  moisture_preference: (value) => asEnum(value, MOISTURE_OPTIONS),
  drought_tolerance: (value) => asEnum(value, LEVEL_OPTIONS),
  overwatering_risk: (value) => asEnum(value, LEVEL_OPTIONS),
  default_water_amount_ml: asNullableNumber,
  watering_method: asNullableString,
  light_need: (value) => asEnum(value, LIGHT_NEED_OPTIONS),
  heat_sensitive_above_c: asNullableNumber,
  cold_sensitive_below_c: asNullableNumber,
  frost_sensitive: asBoolean,
  feeding_enabled: asBoolean,
  feeding_interval_days: asNullableNumber,
  feeding_months: asMonthsArray,
  check_interval_days: asRequiredNumber,
  photo_interval_days: asRequiredNumber,
  pest_check_interval_days: asNullableNumber,
  maintenance_notes: asNullableString,
  risk_notes: asNullableString,
  survival_watering_hint: asNullableString,
  survival_heat_hint: asNullableString,
  survival_frost_hint: asNullableString,
  survival_fertilizing_hint: asNullableString,
};

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonths(value: string): number[] | null {
  const months = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((month) => Number.isFinite(month) && month >= 1 && month <= 12);

  return months.length > 0 ? months : null;
}

export const MOISTURE_OPTIONS = [
  { label: "Nevím", value: "unknown" },
  { label: "Proschnout mezi", value: "dry_between" },
  { label: "Mírně vlhko", value: "slightly_moist" },
  { label: "Vlhko", value: "moist" },
  { label: "Mokro", value: "wet" },
] as const;

export const LEVEL_OPTIONS = [
  { label: "Nevím", value: "unknown" },
  { label: "Nízké", value: "low" },
  { label: "Střední", value: "medium" },
  { label: "Vysoké", value: "high" },
] as const;

export const LIGHT_NEED_OPTIONS = [
  { label: "Nevím", value: "unknown" },
  { label: "Plné slunce", value: "full_sun" },
  { label: "Poloslunce", value: "partial_sun" },
  { label: "Světlé nepřímé", value: "bright_indirect" },
  { label: "Stín", value: "shade" },
] as const;

const YES_NO_OPTIONS = [
  { label: "Ne", value: "no" },
  { label: "Ano", value: "yes" },
] as const;
