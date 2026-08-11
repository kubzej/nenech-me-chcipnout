export type PlantPhotoItem = {
  id: string;
  kytka_id: string;
  storage_bucket: string;
  storage_path: string;
  captured_at: string | null;
  note: string | null;
  health_snapshot: string | null;
  care_event_id: string | null;
  created_at: string;
};

export type PlantPhotoCreateRequest = {
  kytka_id: string;
  storage_path: string;
  captured_at?: string | null;
  note?: string | null;
  health_snapshot?: string | null;
  care_event_id?: string | null;
};
