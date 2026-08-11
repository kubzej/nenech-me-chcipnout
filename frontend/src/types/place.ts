export type ContainerListItem = {
  id: string;
  name: string;
  container_type: string;
  approx_volume_l: number | null;
  drainage: string;
  self_watering: boolean;
  notes: string | null;
  zone_id: string;
  zone_name: string;
  environment: string;
  location_id: string;
  location_name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type PlaceContainerOverview = {
  id: string;
  name: string;
  container_type: string;
  approx_volume_l: number | null;
  drainage: string;
  self_watering: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  kytky_count: number;
};

export type PlaceZoneOverview = {
  id: string;
  name: string;
  environment: string;
  light_exposure: string;
  rain_reach: string;
  wind_exposure: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  containers: PlaceContainerOverview[];
};

export type PlaceLocationOverview = {
  id: string;
  name: string;
  address_label: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  zones: PlaceZoneOverview[];
};

export type LocationCreateRequest = {
  name: string;
  address_label?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  notes?: string | null;
};

export type ZoneCreateRequest = {
  location_id: string;
  name: string;
  environment: "indoor" | "outdoor" | "covered_outdoor";
  light_exposure:
    | "full_sun"
    | "partial_sun"
    | "bright_indirect"
    | "shade"
    | "mixed"
    | "unknown";
  rain_reach: "full" | "partial" | "none" | "indoor";
  wind_exposure: "low" | "medium" | "high" | "unknown" | "indoor";
  notes?: string | null;
};

export type ContainerCreateRequest = {
  zone_id: string;
  name: string;
  container_type: "pot" | "trough" | "planter" | "hanging" | "bed" | "other";
  approx_volume_l?: number | null;
  drainage?: "none" | "limited" | "good" | "unknown";
  self_watering?: boolean;
  notes?: string | null;
};
