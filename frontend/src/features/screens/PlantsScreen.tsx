import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Text } from "../../components/ui/Text";
import { apiGetAuthed } from "../../lib/api";
import type { KytkaListItem } from "../../types/kytka";
import "./screen.css";

export function PlantsScreen() {
  const [kytky, setKytky] = useState<KytkaListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadKytky() {
      setError(null);
      setIsLoading(true);

      try {
        const data = await apiGetAuthed<KytkaListItem[]>("/api/kytky");
        if (isActive) {
          setKytky(data);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Kytky se nenačetly.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadKytky();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="screen screen--stack" aria-label="Kytky">
      <ScreenHeader title="Kytky" subtitle="Tvoje aktuální oběti" />

      {isLoading ? <SkeletonCard aria-label="Načítám kytky" lines={1} /> : null}
      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {!isLoading && !error && kytky.length === 0 ? (
        <EmptyState
          icon={<Leaf aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Zatím tu není žádná Kytka."
          variant="inline"
        />
      ) : null}

      {kytky.length > 0 ? (
        <div className="kytka-list">
          {kytky.map((kytka) => (
            <article className="kytka-list__item" key={kytka.id}>
              <div>
                <Text variant="title">{kytka.display_name}</Text>
                <Text as="p" variant="body" tone="muted">
                  {kytka.species_label ?? kytka.care_profile_name ?? "bez druhu"}
                </Text>
              </div>
              <Text as="small" variant="caption">
                {[kytka.container_name, kytka.zone_name, kytka.location_name]
                  .filter(Boolean)
                  .join(" / ") || "bez umístění"}
              </Text>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
