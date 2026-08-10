export type KytkaListItem = {
  id: string;
  container_id: string;
  care_profile_id: string | null;
  display_name: string;
  status: string;
  acquired_on: string | null;
  notes: string | null;
  container_name: string | null;
  zone_name: string | null;
  location_name: string | null;
  care_profile_name: string | null;
  scientific_name: string | null;
  last_watered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KytkaCreateRequest = {
  container_id: string;
  care_profile_id?: string | null;
  display_name: string;
  status?: "ok" | "monitoring" | "sick" | "dormant" | "dead";
  acquired_on?: string | null;
  notes?: string | null;
};
