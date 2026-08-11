export type CareEventType =
  | "watering"
  | "fertilizing"
  | "checkin"
  | "pest_observation"
  | "treatment"
  | "maintenance";

// "Jak na tom je?" — sets kytky.status directly. Older events may still
// carry legacy symptom values (dry/wet/wilting/...); those are read-only
// history now, see PlantPhotoHealthSnapshot for the still-live symptom set.
export type CareEventCondition = "ok" | "monitoring" | "sick";

export type CareEventItem = {
  id: string;
  event_type: string;
  target_type: string;
  kytka_id: string | null;
  container_id: string | null;
  occurred_at: string;
  amount_ml: number | null;
  method: string | null;
  condition: string | null;
  note: string | null;
  recorded_by: string;
  created_at: string;
};

export type CareEventCreateRequest = {
  kytka_id: string;
  event_type: CareEventType;
  occurred_at?: string | null;
  amount_ml?: number | null;
  method?: string | null;
  condition?: CareEventCondition | null;
  note?: string | null;
};
