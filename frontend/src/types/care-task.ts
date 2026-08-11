export type CareTaskType =
  | "watering"
  | "fertilizing"
  | "checkin"
  | "photo_observation"
  | "pest_followup"
  | "weather_protection"
  | "maintenance";

export type CareTaskStatus =
  | "pending"
  | "done"
  | "skipped"
  | "not_done"
  | "missed"
  | "no_response"
  | "canceled";

export type CareTaskPriority = "low" | "normal" | "high" | "critical";

export type CareTaskItem = {
  id: string;
  task_date: string;
  task_type: string;
  target_type: string;
  kytka_id: string | null;
  container_id: string | null;
  status: string;
  priority: string;
  source: string;
  title: string;
  instructions: string | null;
  explanation: string | null;
  recommended_amount_ml: number | null;
  due_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  outcome_note: string | null;
  created_at: string;
};

export type ActiveAbsenceItem = {
  display_name: string | null;
  ends_on: string;
};

export type LightMismatchItem = {
  display_name: string | null;
  zone_name: string | null;
  light_need: string;
  light_exposure: string;
};

export type ProfileLessKytkaItem = {
  id: string;
  display_name: string | null;
};

export type DailyPlanResponse = {
  tasks: CareTaskItem[];
  profile_less_kytky: ProfileLessKytkaItem[];
  everyone_away_today: boolean;
  active_absences: ActiveAbsenceItem[];
  light_mismatches: LightMismatchItem[];
};

export type CareTaskCompleteRequest = {
  event_type: string;
  amount_ml?: number | null;
  method?: string | null;
  condition?: string | null;
  note?: string | null;
};

export type CareTaskSkipRequest = {
  outcome_note?: string | null;
};

export type CareTaskCompleteResponse = {
  task: CareTaskItem;
  event_id: string;
};
