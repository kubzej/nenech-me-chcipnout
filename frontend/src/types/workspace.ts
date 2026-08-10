export type Workspace = {
  id: string;
  name: string;
  timezone: string;
  role: string;
  created_at: string;
};

export type MeResponse = {
  user_id: string;
  email: string | null;
};

export type WorkspaceMemberItem = {
  user_id: string;
  display_name: string | null;
};

