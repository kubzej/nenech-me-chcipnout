export type CareEventType =
  | "watering"
  | "fertilizing"
  | "checkin"
  | "pest_observation"
  | "treatment"
  | "maintenance"
  | "weather_protection";

export type CareEventCondition =
  | "ok"
  | "dry"
  | "wet"
  | "wilting"
  | "yellowing"
  | "pests"
  | "damaged"
  | "unknown";

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
