import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Leaf, Pencil, Plus } from "lucide-react";
import {
  CareProfileFields,
  DEFAULT_CARE_PROFILE_VALUES,
} from "../../components/care-profile/CareProfileFields";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Text } from "../../components/ui/Text";
import {
  apiDeleteAuthed,
  apiGetAuthed,
  apiPatchAuthed,
  apiPostAuthed,
} from "../../lib/api";
import type {
  CareProfileCreateRequest,
  CareProfileItem,
} from "../../types/care-profile";
import "../screens/screen.css";

type CareProfilesSectionProps = {
  onBack: () => void;
};

export function CareProfilesSection({ onBack }: CareProfilesSectionProps) {
  const [profiles, setProfiles] = useState<CareProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CareProfileItem | null>(
    null,
  );
  const [formValues, setFormValues] = useState<CareProfileCreateRequest>(
    DEFAULT_CARE_PROFILE_VALUES,
  );

  const loadProfiles = useCallback(async (options: { showLoading?: boolean } = {}) => {
    setError(null);
    if (options.showLoading ?? true) {
      setIsLoading(true);
    }

    try {
      const data = await apiGetAuthed<CareProfileItem[]>("/api/care-profiles");
      setProfiles(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Care profily se nenačetly.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function openCreateSheet() {
    setEditingProfile(null);
    setFormValues(DEFAULT_CARE_PROFILE_VALUES);
    setIsCreateSheetOpen(true);
  }

  function openEditSheet(profile: CareProfileItem) {
    setEditingProfile(profile);
    setFormValues(toFormValues(profile));
  }

  function resetForm() {
    setIsCreateSheetOpen(false);
    setEditingProfile(null);
    setFormValues(DEFAULT_CARE_PROFILE_VALUES);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (editingProfile) {
        await apiPatchAuthed(`/api/care-profiles/${editingProfile.id}`, formValues);
      } else {
        await apiPostAuthed("/api/care-profiles", formValues);
      }
      resetForm();
      await loadProfiles({ showLoading: false });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Care profil se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(profile: CareProfileItem) {
    const confirmMessage =
      profile.kytky_count > 0
        ? `Smazat profil „${profile.name}"? Používá ho ${formatKytkyCount(profile.kytky_count)} — přijdou o přiřazený profil.`
        : `Smazat profil „${profile.name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/care-profiles/${profile.id}`);
      resetForm();
      await loadProfiles({ showLoading: false });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Care profil se nepodařilo smazat.",
      );
    }
  }

  return (
    <section
      className="screen screen--stack screen--with-floating-action"
      aria-label="Care profily"
    >
      <ScreenHeader
        action={
          <Button
            className="care-profiles-back-button"
            icon={<ArrowLeft aria-hidden="true" size={18} />}
            onClick={onBack}
            variant="ghost"
          >
            Zpět
          </Button>
        }
        title="Care profily"
        subtitle="Jak se o co starat"
      />

      {isLoading ? <SkeletonCard aria-label="Načítám care profily" lines={1} /> : null}
      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {!isLoading && !error && profiles.length === 0 ? (
        <EmptyState
          icon={<Leaf aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Zatím žádný care profil."
          variant="inline"
        />
      ) : null}

      {profiles.length > 0 ? (
        <div className="entity-list">
          {profiles.map((profile) => (
            <article className="entity-card" key={profile.id}>
              <div className="place-tree__header">
                <div>
                  <Text variant="title">{profile.name}</Text>
                  {profile.scientific_name ? (
                    <Text as="p" variant="body" tone="muted">
                      {profile.scientific_name}
                    </Text>
                  ) : null}
                </div>
                <IconButton
                  icon={<Pencil aria-hidden="true" size={16} />}
                  label="Upravit care profil"
                  onClick={() => openEditSheet(profile)}
                  size="sm"
                />
              </div>
              <Text as="small" variant="caption">
                {profile.kytky_count > 0
                  ? `Používá ${formatKytkyCount(profile.kytky_count)}`
                  : "Nepoužitý"}
              </Text>
            </article>
          ))}
        </div>
      ) : null}

      <Sheet
        isOpen={isCreateSheetOpen || editingProfile !== null}
        onClose={resetForm}
        title={
          editingProfile ? `Upravit profil: ${editingProfile.name}` : "Nový care profil"
        }
      >
        <div className="location-form">
          <form onSubmit={handleSubmit}>
            <CareProfileFields
              disabled={isSaving}
              onChange={(patch) =>
                setFormValues((current) => ({ ...current, ...patch }))
              }
              values={formValues}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : editingProfile ? "Uložit změny" : "Uložit profil"}
            </Button>
            {editingProfile ? (
              <Button
                disabled={isSaving}
                onClick={() => handleDelete(editingProfile)}
                type="button"
                variant="ghost"
              >
                Smazat profil
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      {!isCreateSheetOpen && editingProfile === null ? (
        <div className="screen-floating-action">
          <Button icon={<Plus aria-hidden="true" size={20} />} onClick={openCreateSheet}>
            Přidat
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatKytkyCount(count: number) {
  if (count === 1) {
    return "1 kytka";
  }
  if (count >= 2 && count <= 4) {
    return `${count} kytky`;
  }
  return `${count} kytek`;
}

function toFormValues(profile: CareProfileItem): CareProfileCreateRequest {
  return {
    ...profile,
    moisture_preference:
      profile.moisture_preference as CareProfileCreateRequest["moisture_preference"],
    drought_tolerance:
      profile.drought_tolerance as CareProfileCreateRequest["drought_tolerance"],
    overwatering_risk:
      profile.overwatering_risk as CareProfileCreateRequest["overwatering_risk"],
    light_need: profile.light_need as CareProfileCreateRequest["light_need"],
  };
}
