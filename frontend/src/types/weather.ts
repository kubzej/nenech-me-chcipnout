export type WeatherCurrent = {
  time: string;
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  weather_code: number | null;
  wind_speed_10m: number | null;
};

export type WeatherDay = {
  date: string;
  weather_code: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  precipitation_sum_mm: number | null;
  precipitation_probability_max: number | null;
  et0_mm: number | null;
};

export type LocationWeatherForecast = {
  location_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: WeatherCurrent | null;
  daily: WeatherDay[];
  source: string;
  fetched_at: string;
};
