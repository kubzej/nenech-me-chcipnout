import { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";
import { Text } from "../../components/ui/Text";
import { apiGetAuthed } from "../../lib/api";
import type { LocationWeatherForecast } from "../../types/weather";
import "./location-weather.css";

type LocationWeatherProps = {
  latitude: number | null;
  locationId: string;
  longitude: number | null;
};

export function LocationWeather({
  latitude,
  locationId,
  longitude,
}: LocationWeatherProps) {
  const [forecast, setForecast] = useState<LocationWeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setForecast(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    apiGetAuthed<LocationWeatherForecast>(
      "/api/weather/locations/" + locationId + "/forecast",
    )
      .then((data) => {
        if (isActive) {
          setForecast(data);
        }
      })
      .catch((weatherError) => {
        if (isActive) {
          setError(
            weatherError instanceof Error ? weatherError.message : "Počasí se nenačetlo.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [latitude, locationId, longitude]);

  if (latitude == null || longitude == null) {
    return (
      <Text as="p" variant="caption" className="location-weather">
        Chybí souřadnice.
      </Text>
    );
  }

  if (isLoading) {
    return <div className="location-weather location-weather--skeleton" />;
  }

  if (error) {
    return (
      <Text as="p" variant="caption" className="location-weather">
        Počasí se nenačetlo.
      </Text>
    );
  }

  if (!forecast) {
    return null;
  }

  const today = forecast.daily[0];

  return (
    <div className="location-weather" aria-label="Počasí">
      <CloudSun aria-hidden="true" size={16} strokeWidth={2.2} />
      <Text as="span" variant="caption">
        {formatTemperature(forecast.current?.temperature_2m)}
      </Text>
      {today ? (
        <Text as="span" variant="caption">
          {formatRain(today.precipitation_sum_mm, today.precipitation_probability_max)}
        </Text>
      ) : null}
    </div>
  );
}

function formatTemperature(value: number | null | undefined) {
  return value == null ? "-- °C" : `${Math.round(value)} °C`;
}

function formatRain(
  precipitation: number | null | undefined,
  probability: number | null | undefined,
) {
  if ((precipitation == null || precipitation === 0) && (probability == null || probability === 0)) {
    return "bez deště";
  }

  const precipitationText = precipitation == null ? "-- mm" : `${roundOne(precipitation)} mm`;
  const probabilityText = probability == null ? "-- % šance" : `${Math.round(probability)} % šance`;

  return `${precipitationText}, ${probabilityText}`;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
