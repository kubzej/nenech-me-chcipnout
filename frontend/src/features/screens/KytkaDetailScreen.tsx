import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Camera,
  Droplets,
  Eye,
  Image as ImageIcon,
  Pencil,
  Plus,
  Sprout,
  Stethoscope,
  Sun,
  Thermometer,
  Wrench,
} from "lucide-react";
import {
  LEVEL_OPTIONS,
  LIGHT_NEED_OPTIONS,
  MOISTURE_OPTIONS,
} from "../../components/care-profile/CareProfileFields";
import {
  CareEventFields,
  DEFAULT_CARE_EVENT_VALUES,
  PHOTO_HEALTH_OPTIONS,
  PLANT_STATUS_OPTIONS,
} from "../../components/care-event/CareEventFields";
import { PlantAvatar } from "../../components/avatar/PlantAvatar";
import { Button } from "../../components/ui/Button";
import { ChoiceField } from "../../components/ui/ChoiceField";
import { useConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
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
import { deleteUploadedPlantPhoto, uploadPlantPhoto } from "../../lib/photoUpload";
import type { CareEventCreateRequest, CareEventItem } from "../../types/care-event";
import type { CareProfileItem } from "../../types/care-profile";
import type { KytkaListItem } from "../../types/kytka";
import type { PlantPhotoItem } from "../../types/plant-photo";
import type { MeResponse, WorkspaceMemberItem } from "../../types/workspace";
import "./screen.css";

type KytkaDetailScreenProps = {
  careProfile: CareProfileItem | null;
  kytka: KytkaListItem;
  onBack: () => void;
  onDataChanged: () => void;
  onEdit: () => void;
};

export function KytkaDetailScreen({
  careProfile,
  kytka,
  onBack,
  onDataChanged,
  onEdit,
}: KytkaDetailScreenProps) {
  const [events, setEvents] = useState<CareEventItem[]>([]);
  const [photos, setPhotos] = useState<PlantPhotoItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CareEventItem | null>(null);
  const [formValues, setFormValues] = useState<Omit<CareEventCreateRequest, "kytka_id">>(
    DEFAULT_CARE_EVENT_VALUES,
  );
  const [eventPhotoFile, setEventPhotoFile] = useState<File | null>(null);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [standalonePhotoFile, setStandalonePhotoFile] = useState<File | null>(null);
  const [standaloneNote, setStandaloneNote] = useState("");
  const [standaloneHealth, setStandaloneHealth] = useState("unknown");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<PlantPhotoItem | null>(null);
  const [isSettingAvatar, setIsSettingAvatar] = useState(false);
  const [isStatusCheckOpen, setIsStatusCheckOpen] = useState(false);
  const [selectedStatusSymptom, setSelectedStatusSymptom] =
    useState<StatusSymptomId | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadTimeline = useCallback(async (options: { suppressError?: boolean } = {}) => {
    setError(null);
    setIsLoading(true);

    try {
      const [eventsData, photosData, membersData, meData] = await Promise.all([
        apiGetAuthed<CareEventItem[]>(`/api/kytky/${kytka.id}/events`),
        apiGetAuthed<PlantPhotoItem[]>(`/api/kytky/${kytka.id}/photos`),
        apiGetAuthed<WorkspaceMemberItem[]>("/api/workspaces/members"),
        apiGetAuthed<MeResponse>("/api/me"),
      ]);
      setEvents(eventsData);
      setPhotos(photosData);
      setMembers(membersData);
      setMe(meData);
    } catch (loadError) {
      if (!options.suppressError) {
        setError(
          loadError instanceof Error ? loadError.message : "Historie se nenačetla.",
        );
      } else {
        console.warn("Historii se po změně nepodařilo obnovit.", loadError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [kytka.id]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  function openCreateEventSheet() {
    setEditingEvent(null);
    setFormValues(DEFAULT_CARE_EVENT_VALUES);
    setEventPhotoFile(null);
    setIsEventSheetOpen(true);
  }

  function openEditEventSheet(event: CareEventItem) {
    setEditingEvent(event);
    setEventPhotoFile(null);
    setFormValues({
      event_type: event.event_type as CareEventCreateRequest["event_type"],
      occurred_at: event.occurred_at,
      amount_ml: event.amount_ml,
      method: event.method,
      condition: normalizeEditableCondition(event.condition),
      note: event.note,
    });
  }

  function resetEventForm() {
    setIsEventSheetOpen(false);
    setEditingEvent(null);
    setFormValues(DEFAULT_CARE_EVENT_VALUES);
    setEventPhotoFile(null);
  }

  function openStatusCheckSheet() {
    setSelectedStatusSymptom(null);
    setIsStatusCheckOpen(true);
  }

  function resetStatusCheckSheet() {
    setIsStatusCheckOpen(false);
    setSelectedStatusSymptom(null);
  }

  function useStatusSymptom(symptom: StatusSymptom) {
    setSelectedStatusSymptom(symptom.id);
  }

  function prepareStatusEvent() {
    if (!selectedStatusSymptom) {
      return;
    }

    const symptom = STATUS_SYMPTOMS.find(
      (candidate) => candidate.id === selectedStatusSymptom,
    );
    if (!symptom) {
      return;
    }

    setEditingEvent(null);
    setEventPhotoFile(null);
    setFormValues({
      ...DEFAULT_CARE_EVENT_VALUES,
      event_type: symptom.eventType,
      condition: symptom.condition,
      note: symptom.historyNote,
    });
    setIsStatusCheckOpen(false);
    setIsEventSheetOpen(true);
  }

  async function handleSubmitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload: CareEventCreateRequest = { kytka_id: kytka.id, ...formValues };
    let uploadedPath: string | null = null;

    try {
      if (eventPhotoFile) {
        const uploaded = await uploadPlantPhoto(kytka.id, eventPhotoFile);
        uploadedPath = uploaded.storagePath;
      }

      const savedEvent = editingEvent
        ? await apiPatchAuthed<CareEventItem>(
            `/api/care-events/${editingEvent.id}`,
            payload,
          )
        : await apiPostAuthed<CareEventItem>("/api/care-events", payload);

      let savedPhoto: PlantPhotoItem | null = null;
      if (uploadedPath) {
        const photoStoragePath = uploadedPath;
        try {
          savedPhoto = await apiPostAuthed<PlantPhotoItem>("/api/plant-photos", {
            kytka_id: kytka.id,
            storage_path: photoStoragePath,
            care_event_id: savedEvent.id,
          });
          uploadedPath = null;
        } catch (photoError) {
          await deleteUploadedPlantPhoto(photoStoragePath).catch(() => undefined);
          uploadedPath = null;
          if (!editingEvent) {
            await apiDeleteAuthed(`/api/care-events/${savedEvent.id}`).catch(
              () => undefined,
            );
          }
          throw photoError;
        }
      }

      setEvents((current) =>
        editingEvent
          ? current.map((item) => (item.id === savedEvent.id ? savedEvent : item))
          : [savedEvent, ...current],
      );
      if (savedPhoto) {
        setPhotos((current) => [savedPhoto, ...current]);
      }
      resetEventForm();
      void loadTimeline({ suppressError: true });
      onDataChanged();
    } catch (saveError) {
      if (uploadedPath) {
        await deleteUploadedPlantPhoto(uploadedPath).catch(() => undefined);
      }
      setError(
        saveError instanceof Error ? saveError.message : "Event se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvent(event: CareEventItem) {
    const confirmed = await confirm({
      confirmLabel: "Smazat",
      title: `Smazat záznam (${formatEventType(event.event_type)})?`,
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/care-events/${event.id}`);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      resetEventForm();
      void loadTimeline({ suppressError: true });
      onDataChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Event se nepodařilo smazat.",
      );
    }
  }

  function openFotoPicker() {
    fotoInputRef.current?.click();
  }

  function handleFotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    setStandalonePhotoFile(file);
    setStandaloneNote("");
    setStandaloneHealth("unknown");
  }

  function resetStandalonePhoto() {
    setStandalonePhotoFile(null);
    setStandaloneNote("");
    setStandaloneHealth("unknown");
  }

  async function handleSubmitStandalonePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!standalonePhotoFile) {
      return;
    }

    setError(null);
    setIsUploadingPhoto(true);

    try {
      const uploaded = await uploadPlantPhoto(kytka.id, standalonePhotoFile);
      let savedPhoto: PlantPhotoItem | null = null;
      try {
        savedPhoto = await apiPostAuthed<PlantPhotoItem>("/api/plant-photos", {
          kytka_id: kytka.id,
          storage_path: uploaded.storagePath,
          note: standaloneNote || null,
          health_snapshot: standaloneHealth === "unknown" ? null : standaloneHealth,
        });
      } catch (metadataError) {
        await deleteUploadedPlantPhoto(uploaded.storagePath).catch(() => undefined);
        throw metadataError;
      }
      if (savedPhoto) {
        setPhotos((current) => [savedPhoto, ...current]);
      }
      resetStandalonePhoto();
      void loadTimeline({ suppressError: true });
      onDataChanged();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Fotku se nepodařilo uložit.",
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photo: PlantPhotoItem) {
    const confirmed = await confirm({
      confirmLabel: "Smazat",
      title: "Smazat tuto fotku?",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/plant-photos/${photo.id}`);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setViewingPhoto(null);
      void loadTimeline({ suppressError: true });
      onDataChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Fotku se nepodařilo smazat.",
      );
    }
  }

  async function handleSetAvatar(photo: PlantPhotoItem) {
    setError(null);
    setIsSettingAvatar(true);

    try {
      await apiPostAuthed(`/api/kytky/${kytka.id}/avatar`, { photo_id: photo.id });
      setViewingPhoto(null);
      onDataChanged();
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : "Profilovku se nepodařilo nastavit.",
      );
    } finally {
      setIsSettingAvatar(false);
    }
  }

  function memberLabel(userId: string): string {
    if (me && userId === me.user_id) {
      return "Já";
    }
    return members.find((member) => member.user_id === userId)?.display_name ?? "Partner";
  }

  const profileLines = careProfile ? buildProfileSummaryLines(careProfile) : [];
  const timeline = buildTimeline(events, photos);
  const selectedStatusSymptomData =
    STATUS_SYMPTOMS.find((symptom) => symptom.id === selectedStatusSymptom) ?? null;
  const isAnySheetOpen =
    isEventSheetOpen ||
    editingEvent !== null ||
    isStatusCheckOpen ||
    standalonePhotoFile !== null ||
    viewingPhoto !== null;

  return (
    <section
      className="screen screen--stack screen--with-floating-action"
      aria-label={kytka.display_name}
    >
      <ScreenHeader
        title={kytka.display_name}
        titleBadge={
          <span
            className={`status-badge status-badge--${statusBadgeTone(kytka.status)}`}
          >
            {formatStatus(kytka.status)}
          </span>
        }
      />

      {confirmDialog}

      <div className="kytka-detail__header-actions">
        <Button
          icon={<ArrowLeft aria-hidden="true" size={18} />}
          onClick={onBack}
          variant="ghost"
        >
          Zpět
        </Button>
        <div className="kytka-detail__header-actions-group">
          <IconButton
            icon={<Camera aria-hidden="true" size={18} />}
            label="Přidat foto"
            onClick={openFotoPicker}
            variant="surface"
          />
          <IconButton
            icon={<Pencil aria-hidden="true" size={18} />}
            label="Upravit kytku"
            onClick={onEdit}
            variant="surface"
          />
        </div>
      </div>

      <input
        accept="image/*"
        className="visually-hidden"
        onChange={handleFotoSelected}
        ref={fotoInputRef}
        type="file"
      />

      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      <div className="kytka-detail__identity">
        <PlantAvatar
          bucket={kytka.primary_photo_bucket}
          label={kytka.display_name}
          path={kytka.primary_photo_path}
          size="lg"
        />
      </div>

      <div className="kytka-detail__quick-actions">
        <Button
          icon={<Eye aria-hidden="true" size={18} />}
          onClick={openStatusCheckSheet}
          type="button"
          variant="ghost"
        >
          Potřebuju pomoct
        </Button>
      </div>

      {careProfile ? (
        <div className="entity-card kytka-detail__profile-summary">
          <Text as="p" variant="label">
            Care profil
          </Text>
          <div>
            <Text as="p" variant="title">
              {careProfile.name}
            </Text>
            {careProfile.scientific_name ? (
              <Text
                as="p"
                tone="muted"
                variant="caption"
                className="kytka-detail__scientific-name"
              >
                {careProfile.scientific_name}
              </Text>
            ) : null}
          </div>
          {profileLines.map((line) => {
            const Icon = line.icon;
            return (
              <div className="kytka-detail__profile-line" key={line.key}>
                <Icon aria-hidden="true" size={18} />
                <Text as="p" tone={line.emphasize ? "danger" : "default"} variant="body">
                  {line.text}
                </Text>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="kytka-detail__history">
        <Text as="p" variant="label">
          Historie
        </Text>

        {isLoading ? <SkeletonCard aria-label="Načítám historii" lines={2} /> : null}

        {!isLoading && timeline.length === 0 ? (
          <EmptyState
            icon={<Droplets aria-hidden="true" size={30} strokeWidth={2.1} />}
            title="Zatím žádná historie."
            variant="inline"
          />
        ) : null}

        {timeline.length > 0 ? (
          <div className="kytka-detail__timeline">
            {timeline.map((entry) => {
              if (entry.kind === "event") {
                const EventIcon = EVENT_TYPE_ICONS[entry.event.event_type] ?? Droplets;
                const detail = formatEventDetail(entry.event);
                const recordedByCurrentUser = entry.event.recorded_by === me?.user_id;

                return (
                  <div className="kytka-detail__timeline-item" key={entry.key}>
                    <div
                      className={`kytka-detail__timeline-marker kytka-detail__timeline-marker--${entry.event.event_type}`}
                    >
                      <EventIcon aria-hidden="true" size={16} />
                    </div>
                    <div className="entity-card kytka-detail__timeline-card">
                      <button
                        className="kytka-detail__timeline-main"
                        onClick={() => openEditEventSheet(entry.event)}
                        type="button"
                      >
                        <span className="kytka-detail__timeline-meta">
                          <Text as="span" tone="muted" variant="caption">
                            {formatEventDateTime(entry.event.occurred_at)}
                          </Text>
                          {!recordedByCurrentUser ? (
                            <Text as="span" tone="muted" variant="caption">
                              {memberLabel(entry.event.recorded_by)}
                            </Text>
                          ) : null}
                        </span>
                        <Text as="span" variant="title">
                          {formatEventType(entry.event.event_type)}
                        </Text>
                        {detail ? (
                          <Text as="span" tone="muted" variant="caption">
                            {detail}
                          </Text>
                        ) : null}
                      </button>
                      {entry.photo ? (
                        <button
                          className="kytka-detail__timeline-thumb"
                          onClick={() => setViewingPhoto(entry.photo)}
                          type="button"
                        >
                          <PlantAvatar
                            bucket={entry.photo.storage_bucket}
                            label="Foto"
                            path={entry.photo.storage_path}
                            size="sm"
                          />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div className="kytka-detail__timeline-item" key={entry.key}>
                  <div className="kytka-detail__timeline-marker kytka-detail__timeline-marker--photo">
                    <ImageIcon aria-hidden="true" size={16} />
                  </div>
                  <button
                    className="entity-card kytka-detail__timeline-card kytka-detail__timeline-card--photo"
                    onClick={() => setViewingPhoto(entry.photo)}
                    type="button"
                  >
                    <span className="kytka-detail__timeline-main">
                      <Text as="span" tone="muted" variant="caption">
                        {formatEventDateTime(entry.timestamp)}
                      </Text>
                      <Text as="span" variant="title">
                        Fotka
                      </Text>
                      {entry.photo.note ? (
                        <Text as="span" tone="muted" variant="caption">
                          {entry.photo.note}
                        </Text>
                      ) : null}
                    </span>
                    <PlantAvatar
                      bucket={entry.photo.storage_bucket}
                      label="Foto"
                      path={entry.photo.storage_path}
                      size="sm"
                    />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <Sheet
        isOpen={isEventSheetOpen || editingEvent !== null}
        onClose={resetEventForm}
        title={editingEvent ? "Upravit event" : "Přidat event"}
      >
        <div className="location-form">
          <form onSubmit={handleSubmitEvent}>
            <CareEventFields
              disabled={isSaving}
              kytkaStatus={kytka.status}
              onChange={(patch) =>
                setFormValues((current) => ({ ...current, ...patch }))
              }
              onPhotoChange={setEventPhotoFile}
              photoFile={eventPhotoFile}
              showOccurredAt={editingEvent !== null}
              values={formValues}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : editingEvent ? "Uložit změny" : "Uložit event"}
            </Button>
            {editingEvent ? (
              <Button
                disabled={isSaving}
                onClick={() => handleDeleteEvent(editingEvent)}
                type="button"
                variant="ghost"
              >
                Smazat
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      <Sheet
        isOpen={isStatusCheckOpen}
        onClose={resetStatusCheckSheet}
        title="Co pozoruješ?"
      >
        <div className="location-form">
          <div className="status-check-flow">
            <div className="status-check-grid">
              {STATUS_SYMPTOMS.map((symptom) => {
                const isSelected = selectedStatusSymptom === symptom.id;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? "status-check-grid__option is-selected"
                        : "status-check-grid__option"
                    }
                    key={symptom.id}
                    onClick={() => useStatusSymptom(symptom)}
                    type="button"
                  >
                    {symptom.label}
                  </button>
                );
              })}
            </div>

            {selectedStatusSymptom ? (
              <div className="status-check-summary">
                <Text as="p" variant="label">
                  První krok
                </Text>
                <Text as="p" variant="body">
                  {selectedStatusSymptomData?.firstStep}
                </Text>
                <Text as="p" tone="muted" variant="caption">
                  Tohle je jen první krok. Pokud chceš změnit stav kytky a
                  uložit to do historie, připravím ti běžný záznam.
                </Text>
                {selectedStatusSymptomData ? (
                  <Text as="p" tone="muted" variant="caption">
                    {statusCheckFollowupText(selectedStatusSymptomData)}
                  </Text>
                ) : null}
              </div>
            ) : null}
            <Button
              disabled={!selectedStatusSymptom}
              onClick={prepareStatusEvent}
              type="button"
            >
              Připravit záznam
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        isOpen={standalonePhotoFile !== null}
        onClose={resetStandalonePhoto}
        title="Nová fotka"
      >
        <div className="location-form">
          <form onSubmit={handleSubmitStandalonePhoto}>
            <ChoiceField
              disabled={isUploadingPhoto}
              label="Stav rostliny"
              onValueChange={setStandaloneHealth}
              options={PHOTO_HEALTH_OPTIONS}
              value={standaloneHealth}
            />
            <TextField
              disabled={isUploadingPhoto}
              label="Poznámka (nepovinné)"
              onChange={(event) => setStandaloneNote(event.target.value)}
              value={standaloneNote}
            />
            <Button disabled={isUploadingPhoto} type="submit">
              {isUploadingPhoto ? "Nahrávám..." : "Uložit fotku"}
            </Button>
          </form>
        </div>
      </Sheet>

      <Sheet isOpen={viewingPhoto !== null} onClose={() => setViewingPhoto(null)} title="Fotka">
        {viewingPhoto ? (
          <div className="kytka-detail__photo-viewer">
            <PlantAvatar
              bucket={viewingPhoto.storage_bucket}
              label="Foto"
              path={viewingPhoto.storage_path}
              size="full"
            />
            {viewingPhoto.note ? (
              <Text as="p" variant="body">
                {viewingPhoto.note}
              </Text>
            ) : null}
            <Text as="p" tone="muted" variant="caption">
              {formatEventDateTime(viewingPhoto.captured_at ?? viewingPhoto.created_at)}
            </Text>
            <Button
              disabled={isSettingAvatar}
              onClick={() => handleSetAvatar(viewingPhoto)}
              type="button"
            >
              {isSettingAvatar ? "Nastavuji..." : "Nastavit jako profilovku"}
            </Button>
            <Button
              onClick={() => handleDeletePhoto(viewingPhoto)}
              type="button"
              variant="ghost"
            >
              Smazat fotku
            </Button>
          </div>
        ) : null}
      </Sheet>

      {!isAnySheetOpen ? (
        <div className="screen-floating-action">
          <Button icon={<Plus aria-hidden="true" size={20} />} onClick={openCreateEventSheet}>
            Přidat event
          </Button>
        </div>
      ) : null}
    </section>
  );
}

type StatusSymptom = {
  condition: NonNullable<CareEventCreateRequest["condition"]>;
  eventType: CareEventCreateRequest["event_type"];
  firstStep: string;
  historyNote: string;
  id: StatusSymptomId;
  label: string;
};

type StatusSymptomId =
  | "brown_tips"
  | "damaged"
  | "leaf_drop"
  | "pests"
  | "rot"
  | "spots"
  | "sunburn"
  | "unknown"
  | "weak_growth"
  | "wilting"
  | "yellowing";

const STATUS_SYMPTOMS = [
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Zkontroluj substrát. Suchý = zalít, mokrý = nezalévat.",
    historyNote:
      "Symptom: vadnou/svěšené listy. Kytka je daná pod dohled kvůli možné chybě v zálivce.",
    id: "wilting",
    label: "Vadnou / svěšené",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Zkontroluj přelití a stojící vodu.",
    historyNote:
      "Symptom: žloutnou listy. Kytka je daná pod dohled kvůli možné zálivce nebo stresu.",
    id: "yellowing",
    label: "Žloutnou listy",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep:
      "Dnes nehnoj. Zkontroluj horko, suchý vzduch nebo nepravidelnou zálivku.",
    historyNote:
      "Symptom: hnědé špičky/suché okraje. Kytka je daná pod dohled kvůli možnému stresu.",
    id: "brown_tips",
    label: "Hnědé špičky",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Neros listy a sleduj, jestli se fleky šíří.",
    historyNote:
      "Symptom: fleky na listech. Kytka je daná pod dohled, sledovat jestli se fleky šíří.",
    id: "spots",
    label: "Fleky na listech",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Zkontroluj spodky listů a okolí kytky.",
    historyNote:
      "Symptom: poškozené/okousané listy. Kytka je daná pod dohled kvůli možnému poškození nebo škůdcům.",
    id: "damaged",
    label: "Poškozené / okousané",
  },
  {
    condition: "sick",
    eventType: "pest_observation",
    firstStep: "Dej ji bokem a zkontroluj spodky listů.",
    historyNote:
      "Symptom: podezření na škůdce. Kytka je označená jako nemocná.",
    id: "pests",
    label: "Škůdci / lepí / pavučinky",
  },
  {
    condition: "sick",
    eventType: "checkin",
    firstStep: "Přestaň zalévat a zkontroluj substrát.",
    historyNote:
      "Symptom: měkké/hnijící části. Kytka je označená jako nemocná.",
    id: "rot",
    label: "Měkké / hnijící části",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Zkontroluj průvan/chlad a poslední zálivku.",
    historyNote:
      "Symptom: opadávají listy. Kytka je daná pod dohled kvůli možnému stresu.",
    id: "leaf_drop",
    label: "Opadávají listy",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Zkontroluj světlo. Tohle není akutní.",
    historyNote:
      "Symptom: nekvete nebo slabě roste. Kytka je daná pod dohled, nejde o akutní stav.",
    id: "weak_growth",
    label: "Nekvete / slabý růst",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Dej ji mimo ostré polední slunce.",
    historyNote:
      "Symptom: spálené/suché fleky od slunce. Kytka je daná pod dohled.",
    id: "sunburn",
    label: "Spálené sluncem",
  },
  {
    condition: "monitoring",
    eventType: "checkin",
    firstStep: "Dej ji pod dohled a za pár dní porovnej stav.",
    historyNote:
      "Symptom: stav vypadá horší, příčina není jasná. Kytka je daná pod dohled.",
    id: "unknown",
    label: "Nevím, vypadá hůř",
  },
] as const satisfies readonly StatusSymptom[];

function statusCheckFollowupText(symptom: StatusSymptom) {
  if (symptom.eventType === "pest_observation") {
    return "Po uložení se bude v Dnes hlídat další kontrola škůdců podle profilu.";
  }
  if (symptom.condition === "sick") {
    return "Po uložení dostane vyšší prioritu a appka ji bude hlídat častěji.";
  }
  return "Po uložení ji appka dá pod dohled a bude ji kontrolovat častěji.";
}

type TimelineEntry =
  | {
      kind: "event";
      key: string;
      timestamp: string;
      event: CareEventItem;
      photo: PlantPhotoItem | null;
    }
  | { kind: "photo"; key: string; timestamp: string; photo: PlantPhotoItem };

function buildTimeline(
  events: CareEventItem[],
  photos: PlantPhotoItem[],
): TimelineEntry[] {
  const photoByEventId = new Map<string, PlantPhotoItem>();
  const unattached: PlantPhotoItem[] = [];

  for (const photo of photos) {
    if (photo.care_event_id) {
      photoByEventId.set(photo.care_event_id, photo);
    } else {
      unattached.push(photo);
    }
  }

  const entries: TimelineEntry[] = events.map((event) => ({
    kind: "event",
    key: event.id,
    timestamp: event.occurred_at,
    event,
    photo: photoByEventId.get(event.id) ?? null,
  }));

  for (const photo of unattached) {
    entries.push({
      kind: "photo",
      key: photo.id,
      timestamp: photo.captured_at ?? photo.created_at,
      photo,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

type ProfileSummaryLine = {
  emphasize?: boolean;
  icon: LucideIcon;
  key: string;
  text: string;
};

function buildProfileSummaryLines(profile: CareProfileItem): ProfileSummaryLine[] {
  const lines: ProfileSummaryLine[] = [];

  const watering = buildWateringLine(profile);
  if (watering) {
    lines.push({ icon: Droplets, key: "watering", text: watering });
  }

  if (profile.light_need && profile.light_need !== "unknown") {
    lines.push({
      icon: Sun,
      key: "light",
      text: findLabel(LIGHT_NEED_OPTIONS, profile.light_need),
    });
  }

  const temperature = buildTemperatureLine(profile);
  if (temperature) {
    lines.push({ icon: Thermometer, key: "temperature", text: temperature });
  }

  const feeding = buildFeedingLine(profile);
  if (feeding) {
    lines.push({ icon: Sprout, key: "feeding", text: feeding });
  }

  if (profile.maintenance_notes) {
    lines.push({ icon: Wrench, key: "maintenance", text: profile.maintenance_notes });
  }

  if (profile.risk_notes) {
    lines.push({
      emphasize: true,
      icon: AlertTriangle,
      key: "risk",
      text: profile.risk_notes,
    });
  }

  return lines;
}

function buildWateringLine(profile: CareProfileItem): string | null {
  const parts: string[] = [];

  if (profile.water_interval_min_days != null && profile.water_interval_max_days != null) {
    parts.push(`zalévat každých ${profile.water_interval_min_days}–${profile.water_interval_max_days} dní`);
  } else if (profile.water_interval_min_days != null) {
    parts.push(`zalévat alespoň každých ${profile.water_interval_min_days} dní`);
  } else if (profile.water_interval_max_days != null) {
    parts.push(`zalévat nejpozději za ${profile.water_interval_max_days} dní`);
  }

  if (profile.moisture_preference && profile.moisture_preference !== "unknown") {
    parts.push(findLabel(MOISTURE_OPTIONS, profile.moisture_preference).toLowerCase());
  }
  if (profile.drought_tolerance && profile.drought_tolerance !== "unknown") {
    parts.push(`sucho snáší ${findLabel(LEVEL_OPTIONS, profile.drought_tolerance).toLowerCase()}`);
  }
  if (profile.overwatering_risk && profile.overwatering_risk !== "unknown") {
    parts.push(`riziko přelití ${findLabel(LEVEL_OPTIONS, profile.overwatering_risk).toLowerCase()}`);
  }
  if (profile.watering_method) {
    parts.push(profile.watering_method);
  }

  return parts.length > 0 ? capitalize(parts.join(", ")) : null;
}

function buildTemperatureLine(profile: CareProfileItem): string | null {
  if (profile.heat_sensitive_above_c == null && profile.cold_sensitive_below_c == null) {
    return null;
  }

  const parts: string[] = [];
  if (profile.heat_sensitive_above_c != null) {
    parts.push(`vadí horko nad ${profile.heat_sensitive_above_c} °C`);
  }
  if (profile.cold_sensitive_below_c != null) {
    parts.push(`vadí zima pod ${profile.cold_sensitive_below_c} °C`);
  }
  if (profile.frost_sensitive) {
    parts.push("citlivá na mráz");
  }

  return capitalize(parts.join(", "));
}

function buildFeedingLine(profile: CareProfileItem): string | null {
  if (!profile.feeding_enabled) {
    return null;
  }

  const parts: string[] = ["Hnojit"];
  if (profile.feeding_interval_days != null) {
    parts.push(`každých ${profile.feeding_interval_days} dní`);
  }
  if (profile.feeding_months && profile.feeding_months.length > 0) {
    parts.push(`v měsících ${profile.feeding_months.join(", ")}`);
  }

  return parts.join(" ");
}

function findLabel(options: readonly { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeEditableCondition(
  value: string | null,
): CareEventCreateRequest["condition"] {
  if (value === "ok" || value === "monitoring" || value === "sick") {
    return value;
  }

  return null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  watering: "Zalévání",
  fertilizing: "Hnojení",
  checkin: "Kontrola",
  pest_observation: "Škůdci",
  treatment: "Ošetření",
  maintenance: "Údržba",
};

const EVENT_TYPE_ICONS: Record<string, LucideIcon> = {
  watering: Droplets,
  fertilizing: Sprout,
  checkin: Eye,
  pest_observation: Bug,
  treatment: Stethoscope,
  maintenance: Wrench,
};

function formatEventType(eventType: string) {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

const STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  monitoring: "sledovaná",
  sick: "nemocná",
  dormant: "klidová",
  // "dead" is no longer settable, kept only so any pre-existing kytka
  // still displays sensibly instead of showing the raw code.
  dead: "mrtvá",
};

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
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

function formatEventDateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventDetail(event: CareEventItem) {
  const parts: string[] = [];
  if (event.condition && event.condition !== "unknown") {
    const label = findLabel([...PLANT_STATUS_OPTIONS, ...PHOTO_HEALTH_OPTIONS], event.condition);
    if (event.event_type === "checkin" || event.event_type === "pest_observation") {
      parts.push(`Nastaven stav: ${label}`);
    } else {
      parts.push(label);
    }
  }
  if (event.method) {
    parts.push(event.method);
  }
  if (event.amount_ml != null) {
    parts.push(`${event.amount_ml} ml`);
  }
  if (event.note) {
    parts.push(event.note);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
