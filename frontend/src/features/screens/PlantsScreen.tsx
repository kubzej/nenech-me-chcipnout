import { FormEvent, useCallback, useEffect, useState } from "react";
import { Droplets, Leaf, Plus } from "lucide-react";
import { KytkaDetailScreen } from "./KytkaDetailScreen";
import { PlantAvatar } from "../../components/avatar/PlantAvatar";
import { Button } from "../../components/ui/Button";
import { ChoiceField } from "../../components/ui/ChoiceField";
import { EmptyState } from "../../components/ui/EmptyState";
import { PickerField } from "../../components/ui/PickerField";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Text } from "../../components/ui/Text";
import { TextField } from "../../components/ui/TextField";
import {
  apiDeleteAuthed,
  apiGetAuthed,
  apiPatchAuthed,
  apiPostAuthed,
} from "../../lib/api";
import { isWateredToday } from "../../lib/relativeDays";
import type { CareProfileItem } from "../../types/care-profile";
import type { KytkaCreateRequest, KytkaListItem } from "../../types/kytka";
import type { ContainerListItem } from "../../types/place";
import "./screen.css";

export function PlantsScreen() {
  const [kytky, setKytky] = useState<KytkaListItem[]>([]);
  const [containers, setContainers] = useState<ContainerListItem[]>([]);
  const [careProfiles, setCareProfiles] = useState<CareProfileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [editingKytka, setEditingKytka] = useState<KytkaListItem | null>(null);
  const [containerId, setContainerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [careProfileId, setCareProfileId] = useState("");
  const [kytkaStatus, setKytkaStatus] =
    useState<NonNullable<KytkaCreateRequest["status"]>>("ok");
  const [acquiredOn, setAcquiredOn] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedKytkaId, setSelectedKytkaId] = useState<string | null>(null);
  const [wateringId, setWateringId] = useState<string | null>(null);
  const [justWateredId, setJustWateredId] = useState<string | null>(null);

  const loadData = useCallback(async (options: { showLoading?: boolean } = {}) => {
    setError(null);
    if (options.showLoading ?? true) {
      setIsLoading(true);
    }

    try {
      const [kytkyData, containersData, careProfilesData] = await Promise.all([
        apiGetAuthed<KytkaListItem[]>("/api/kytky"),
        apiGetAuthed<ContainerListItem[]>("/api/places/containers"),
        apiGetAuthed<CareProfileItem[]>("/api/care-profiles"),
      ]);
      setKytky(kytkyData);
      setContainers(containersData);
      setCareProfiles(careProfilesData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kytky se nenačetly.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmitKytka(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!containerId) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const payload: KytkaCreateRequest = {
        acquired_on: acquiredOn || null,
        care_profile_id: careProfileId || null,
        container_id: containerId,
        display_name: displayName,
        notes: notes || null,
        status: kytkaStatus,
      };

      if (editingKytka) {
        await apiPatchAuthed(`/api/kytky/${editingKytka.id}`, payload);
      } else {
        await apiPostAuthed("/api/kytky", payload);
      }
      resetForm();
      await loadData({ showLoading: false });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Kytku se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateSheet() {
    setEditingKytka(null);
    setContainerId(containers[0]?.id ?? "");
    setDisplayName("");
    setCareProfileId("");
    setKytkaStatus("ok");
    setAcquiredOn("");
    setNotes("");
    setIsCreateSheetOpen(true);
  }

  function openEditSheet(kytka: KytkaListItem) {
    setEditingKytka(kytka);
    setContainerId(kytka.container_id);
    setDisplayName(kytka.display_name);
    setCareProfileId(kytka.care_profile_id ?? "");
    setKytkaStatus(kytka.status as NonNullable<KytkaCreateRequest["status"]>);
    setAcquiredOn(kytka.acquired_on ?? "");
    setNotes(kytka.notes ?? "");
  }

  function resetForm() {
    setIsCreateSheetOpen(false);
    setEditingKytka(null);
    setContainerId("");
    setDisplayName("");
    setCareProfileId("");
    setKytkaStatus("ok");
    setAcquiredOn("");
    setNotes("");
  }

  async function handleDeleteKytka(kytka: KytkaListItem) {
    if (
      !window.confirm(
        `Trvale smazat kytku „${kytka.display_name}"? Tohle nejde vzít zpět.`,
      )
    ) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/kytky/${kytka.id}`);
      resetForm();
      setSelectedKytkaId(null);
      await loadData({ showLoading: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Kytku se nepodařilo smazat.",
      );
    }
  }

  async function handleZalito(kytka: KytkaListItem) {
    setError(null);
    setWateringId(kytka.id);

    try {
      await apiPostAuthed("/api/care-events", {
        kytka_id: kytka.id,
        event_type: "watering",
      });
      await loadData({ showLoading: false });
      setJustWateredId(kytka.id);
      setTimeout(() => {
        setJustWateredId((current) => (current === kytka.id ? null : current));
      }, 2000);
    } catch (zalitoError) {
      setError(
        zalitoError instanceof Error
          ? zalitoError.message
          : "Zalití se nepodařilo uložit.",
      );
    } finally {
      setWateringId(null);
    }
  }

  const containerOptions = containers.map((container) => ({
    label: `${container.location_name} · ${container.zone_name} · ${container.name}`,
    value: container.id,
  }));

  const careProfileOptions = [
    { label: "Bez profilu", value: "" },
    ...careProfiles.map((profile) => ({ label: profile.name, value: profile.id })),
  ];

  const selectedKytka = kytky.find((kytka) => kytka.id === selectedKytkaId) ?? null;

  const kytkaEditSheet = (
    <Sheet
      isOpen={isCreateSheetOpen || editingKytka !== null}
      onClose={resetForm}
      title={editingKytka ? `Upravit kytku: ${editingKytka.display_name}` : "Nová kytka"}
    >
      {containers.length === 0 ? (
        <Text as="p" variant="body" tone="muted">
          Nejdřív si v Místech založ aspoň jednu nádobu — kytka se musí zasadit
          někam konkrétně.
        </Text>
      ) : (
        <div className="location-form">
          <form onSubmit={handleSubmitKytka}>
            <TextField
              disabled={isSaving}
              label="Název"
              name="display_name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Muškát z balkonu"
              required
              value={displayName}
            />
            <PickerField
              disabled={isSaving}
              label="Nádoba"
              onValueChange={(value) => setContainerId(value)}
              options={containerOptions}
              value={containerId}
            />
            <PickerField
              disabled={isSaving}
              label="Care profil"
              onValueChange={(value) => setCareProfileId(value)}
              options={careProfileOptions}
              placeholder="Bez profilu"
              value={careProfileId}
            />
            <ChoiceField
              disabled={isSaving}
              label="Stav"
              onValueChange={(value) => setKytkaStatus(value)}
              options={STATUS_OPTIONS}
              value={kytkaStatus}
            />
            <TextField
              disabled={isSaving}
              label="Pořízeno (nepovinné)"
              name="acquired_on"
              onChange={(event) => setAcquiredOn(event.target.value)}
              type="date"
              value={acquiredOn}
            />
            <TextField
              disabled={isSaving}
              label="Poznámka (nepovinné)"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : editingKytka ? "Uložit změny" : "Uložit kytku"}
            </Button>
            {editingKytka ? (
              <Button
                disabled={isSaving}
                onClick={() => handleDeleteKytka(editingKytka)}
                type="button"
                variant="ghost"
              >
                Smazat kytku
              </Button>
            ) : null}
          </form>
        </div>
      )}
    </Sheet>
  );

  if (selectedKytka) {
    const matchingProfile =
      careProfiles.find((profile) => profile.id === selectedKytka.care_profile_id) ?? null;

    return (
      <>
        {kytkaEditSheet}
        <KytkaDetailScreen
          careProfile={matchingProfile}
          kytka={selectedKytka}
          onBack={() => setSelectedKytkaId(null)}
          onDataChanged={() => loadData({ showLoading: false })}
          onEdit={() => openEditSheet(selectedKytka)}
        />
      </>
    );
  }

  return (
    <section
      className="screen screen--stack screen--with-floating-action"
      aria-label="Kytky"
    >
      <ScreenHeader title="Kytky" subtitle="Tvoje aktuální oběti" />

      {isLoading ? <SkeletonCard aria-label="Načítám kytky" lines={1} /> : null}
      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {kytkaEditSheet}

      {!isLoading && !error && kytky.length === 0 ? (
        <EmptyState
          icon={<Leaf aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Zatím žádná oběť."
          variant="inline"
        />
      ) : null}

      {kytky.length > 0 ? (
        <div className="kytka-list">
          {kytky.map((kytka) => (
            <article className="kytka-list__item" key={kytka.id}>
              <button
                className="kytka-list__item-toggle"
                onClick={() => setSelectedKytkaId(kytka.id)}
                type="button"
              >
                <div className="kytka-list__item-row">
                  <PlantAvatar
                    bucket={kytka.primary_photo_bucket}
                    label={kytka.display_name}
                    path={kytka.primary_photo_path}
                    size="sm"
                  />
                  <div>
                    <div className="kytka-list__item-title-row">
                      <Text variant="title">{kytka.display_name}</Text>
                      <span
                        className={`status-badge status-badge--${statusBadgeTone(kytka.status)}`}
                      >
                        {formatStatus(kytka.status)}
                      </span>
                    </div>
                    <Text as="p" variant="body" tone="muted">
                      {kytka.care_profile_name ?? "bez profilu"}
                    </Text>
                    <Text as="small" variant="caption">
                      {[kytka.location_name, kytka.zone_name, kytka.container_name]
                        .filter(Boolean)
                        .join(" / ") || "bez umístění"}
                    </Text>
                  </div>
                </div>
              </button>
              <div className="kytka-list__item-footer">
                <Button
                  disabled={wateringId === kytka.id}
                  icon={<Droplets aria-hidden="true" size={16} />}
                  onClick={() => handleZalito(kytka)}
                  type="button"
                  variant="ghost"
                >
                  {wateringButtonLabel(kytka, wateringId, justWateredId)}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!isCreateSheetOpen && editingKytka === null ? (
        <div className="screen-floating-action">
          <Button icon={<Plus aria-hidden="true" size={20} />} onClick={openCreateSheet}>
            Přidat
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function wateringButtonLabel(
  kytka: KytkaListItem,
  wateringId: string | null,
  justWateredId: string | null,
): string {
  if (wateringId === kytka.id) {
    return "Ukládám...";
  }
  if (justWateredId === kytka.id) {
    return "Zalito!";
  }
  if (isWateredToday(kytka.last_watered_at)) {
    return "Zalito dnes";
  }
  return "Zalít";
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    dead: "mrtvá",
    dormant: "dormantní",
    monitoring: "sledovaná",
    ok: "OK",
    sick: "nemocná",
  };

  return labels[status] ?? status;
}

function statusBadgeTone(status: string): "ok" | "attention" | "danger" {
  if (status === "sick" || status === "dead") {
    return "danger";
  }
  if (status === "monitoring" || status === "dormant") {
    return "attention";
  }
  return "ok";
}

const STATUS_OPTIONS = [
  { label: "OK", value: "ok" },
  { label: "Sledovaná", value: "monitoring" },
  { label: "Nemocná", value: "sick" },
  { label: "Dormantní", value: "dormant" },
  { label: "Mrtvá", value: "dead" },
] as const;
