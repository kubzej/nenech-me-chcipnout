export type CareProfileItem = {
  id: string;
  name: string;
  scientific_name: string | null;
  source: string;
  source_ref: string | null;
  water_interval_min_days: number | null;
  water_interval_max_days: number | null;
  moisture_preference: string | null;
  drought_tolerance: string | null;
  overwatering_risk: string | null;
  default_water_amount_ml: number | null;
  watering_method: string | null;
  light_need: string | null;
  heat_sensitive_above_c: number | null;
  cold_sensitive_below_c: number | null;
  frost_sensitive: boolean;
  feeding_enabled: boolean;
  feeding_interval_days: number | null;
  feeding_months: number[] | null;
  check_interval_days: number;
  photo_interval_days: number;
  pest_check_interval_days: number | null;
  maintenance_interval_days: number | null;
  maintenance_notes: string | null;
  risk_notes: string | null;
  created_at: string;
  updated_at: string;
  kytky_count: number;
};

export type CareProfileCreateRequest = {
  name: string;
  scientific_name?: string | null;
  water_interval_min_days?: number | null;
  water_interval_max_days?: number | null;
  moisture_preference?:
    | "dry_between"
    | "slightly_moist"
    | "moist"
    | "wet"
    | "unknown"
    | null;
  drought_tolerance?: "low" | "medium" | "high" | "unknown" | null;
  overwatering_risk?: "low" | "medium" | "high" | "unknown" | null;
  default_water_amount_ml?: number | null;
  watering_method?: string | null;
  light_need?:
    | "full_sun"
    | "partial_sun"
    | "bright_indirect"
    | "shade"
    | "unknown"
    | null;
  heat_sensitive_above_c?: number | null;
  cold_sensitive_below_c?: number | null;
  frost_sensitive?: boolean;
  feeding_enabled?: boolean;
  feeding_interval_days?: number | null;
  feeding_months?: number[] | null;
  check_interval_days?: number;
  photo_interval_days?: number;
  pest_check_interval_days?: number | null;
  maintenance_interval_days?: number | null;
  maintenance_notes?: string | null;
  risk_notes?: string | null;
};
