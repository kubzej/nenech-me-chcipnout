export type AbsenceItem = {
  id: string;
  user_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  suppress_notifications: boolean;
  created_at: string;
  updated_at: string;
};

export type AbsenceCreateRequest = {
  user_id: string;
  starts_on: string;
  ends_on: string;
  reason?: string | null;
  suppress_notifications?: boolean;
};
