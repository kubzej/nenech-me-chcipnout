export type NotificationPreferencesItem = {
  workspace_id: string;
  user_id: string;
  master_enabled: boolean;
  daily_plan_enabled: boolean;
  morning_time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferencesUpdate = {
  master_enabled?: boolean;
  daily_plan_enabled?: boolean;
  morning_time?: string;
};

export type VapidKeyResponse = {
  public_key: string;
};
