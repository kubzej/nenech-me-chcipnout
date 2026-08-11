import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Camera,
  CircleCheck,
  CloudSun,
  Droplets,
  Eye,
  Plane,
  Sprout,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import {
  CareEventFields,
  DEFAULT_CARE_EVENT_VALUES,
} from "../../components/care-event/CareEventFields";
import { PlantAvatar } from "../../components/avatar/PlantAvatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Sheet } from "../../components/ui/Sheet";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Text } from "../../components/ui/Text";
import { apiGetAuthed, apiPostAuthed } from "../../lib/api";
import { uploadPlantPhoto } from "../../lib/photoUpload";
import type { CareEventCreateRequest } from "../../types/care-event";
import type {
  ActiveAbsenceItem,
  CareTaskCompleteResponse,
  CareTaskItem,
  DailyPlanResponse,
  LightMismatchItem,
  ProfileLessKytkaItem,
} from "../../types/care-task";
import type { KytkaListItem } from "../../types/kytka";
import "./screen.css";

type QuickTaskType = "watering" | "fertilizing";

type TaskGroup =
  | {
      kind: "quick";
      key: string;
      taskType: QuickTaskType;
      tasks: CareTaskItem[];
      priorityRank: number;
    }
  | {
      kind: "detailed";
      key: string;
      task: CareTaskItem;
      priorityRank: number;
    }
  | {
      kind: "photo";
      key: string;
      task: CareTaskItem;
      priorityRank: number;
    };

const QUICK_TASK_TYPES: QuickTaskType[] = ["watering", "fertilizing"];

const QUICK_TASK_BUTTON_LABEL: Record<QuickTaskType, string> = {
  watering: "Zalito",
  fertilizing: "Přihnojeno",
};

const QUICK_TASK_BUSY_LABEL: Record<QuickTaskType, string> = {
  watering: "Zalévám...",
  fertilizing: "Hnojím...",
};

const DETAILED_TASK_EVENT_DEFAULTS: Record<string, CareEventCreateRequest["event_type"]> = {
  checkin: "checkin",
  pest_followup: "pest_observation",
  weather_protection: "weather_protection",
  maintenance: "maintenance",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  watering: "Zalévání",
  fertilizing: "Hnojení",
  checkin: "Kontrola",
  pest_followup: "Kontrola škůdců",
  photo_observation: "Foto check-in",
  weather_protection: "Ochrana před počasím",
  maintenance: "Údržba",
};

const TASK_TYPE_ICONS: Record<string, LucideIcon> = {
  watering: Droplets,
  fertilizing: Sprout,
  checkin: Eye,
  pest_followup: Bug,
  photo_observation: Camera,
  weather_protection: CloudSun,
  maintenance: Wrench,
};

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function TodayScreen() {
  const [tasks, setTasks] = useState<CareTaskItem[]>([]);
  const [kytky, setKytky] = useState<KytkaListItem[]>([]);
  const [profileLessKytky, setProfileLessKytky] = useState<ProfileLessKytkaItem[]>([]);
  const [dismissedProfileLessIds, setDismissedProfileLessIds] = useState<Set<string>>(
    () => new Set(readDismissedProfileLessIds()),
  );
  const [everyoneAway, setEveryoneAway] = useState(false);
  const [activeAbsences, setActiveAbsences] = useState<ActiveAbsenceItem[]>([]);
  const [lightMismatches, setLightMismatches] = useState<LightMismatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<QuickTaskType | null>(null);
  const [activeTask, setActiveTask] = useState<CareTaskItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState<Omit<CareEventCreateRequest, "kytka_id">>(
    DEFAULT_CARE_EVENT_VALUES,
  );
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoTaskId, setPendingPhotoTaskId] = useState<string | null>(null);

  const loadToday = useCallback(async (options: { showLoading?: boolean } = {}) => {
    setError(null);
    if (options.showLoading ?? true) {
      setIsLoading(true);
    }

    try {
      const [plan, kytkyData] = await Promise.all([
        apiGetAuthed<DailyPlanResponse>("/api/care-tasks/today"),
        apiGetAuthed<KytkaListItem[]>("/api/kytky"),
      ]);
      setTasks(plan.tasks);
      setProfileLessKytky(plan.profile_less_kytky);
      setEveryoneAway(plan.everyone_away_today);
      setActiveAbsences(plan.active_absences);
      setLightMismatches(plan.light_mismatches);
      setKytky(kytkyData);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Dnešní plán se nenačetl.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const kytkaById = new Map(kytky.map((kytka) => [kytka.id, kytka]));
  const groups = buildGroups(tasks, kytkaById);
  const quickGroupsByType = (taskType: QuickTaskType) =>
    groups.filter(
      (group): group is Extract<TaskGroup, { kind: "quick" }> =>
        group.kind === "quick" && group.taskType === taskType,
    );
  const wateringGroups = quickGroupsByType("watering");
  const fertilizingGroups = quickGroupsByType("fertilizing");
  const visibleProfileLess = profileLessKytky.filter(
    (kytka) => !dismissedProfileLessIds.has(kytka.id),
  );

  function handleDismissProfileLess() {
    setDismissedProfileLessIds((current) => {
      const next = new Set(current);
      for (const kytka of profileLessKytky) {
        next.add(kytka.id);
      }
      writeDismissedProfileLessIds(next);
      return next;
    });
  }

  function openDetailedSheet(task: CareTaskItem) {
    setActiveTask(task);
    setFormValues({
      ...DEFAULT_CARE_EVENT_VALUES,
      event_type: DETAILED_TASK_EVENT_DEFAULTS[task.task_type] ?? "checkin",
    });
  }

  function resetDetailedSheet() {
    setActiveTask(null);
    setFormValues(DEFAULT_CARE_EVENT_VALUES);
  }

  async function handleSubmitDetailed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTask) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { occurred_at: _occurredAt, ...completePayload } = formValues;
      await apiPostAuthed(`/api/care-tasks/${activeTask.id}/complete`, completePayload);
      resetDetailedSheet();
      await loadToday({ showLoading: false });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Úkol se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQuickComplete(group: Extract<TaskGroup, { kind: "quick" }>) {
    setError(null);
    setBusyKey(group.key);

    try {
      for (const task of group.tasks) {
        await apiPostAuthed(`/api/care-tasks/${task.id}/complete`, {
          event_type: group.taskType,
          amount_ml: task.recommended_amount_ml,
        });
      }
      await loadToday({ showLoading: false });
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Úkol se nepodařilo uložit.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBulkComplete(
    taskType: QuickTaskType,
    groupsToComplete: Extract<TaskGroup, { kind: "quick" }>[],
  ) {
    setError(null);
    setBulkBusy(taskType);

    try {
      for (const group of groupsToComplete) {
        for (const task of group.tasks) {
          await apiPostAuthed(`/api/care-tasks/${task.id}/complete`, {
            event_type: taskType,
            amount_ml: task.recommended_amount_ml,
          });
        }
      }
      await loadToday({ showLoading: false });
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Úkol se nepodařilo uložit.",
      );
    } finally {
      setBulkBusy(null);
    }
  }

  function openPhotoPicker(taskId: string) {
    setPendingPhotoTaskId(taskId);
    photoInputRef.current?.click();
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const taskId = pendingPhotoTaskId;
    setPendingPhotoTaskId(null);

    const task = taskId ? tasks.find((candidate) => candidate.id === taskId) : null;
    if (!file || !task || !task.kytka_id) {
      return;
    }

    setError(null);
    setBusyKey(task.id);

    try {
      const uploaded = await uploadPlantPhoto(task.kytka_id, file);
      const response = await apiPostAuthed<CareTaskCompleteResponse>(
        `/api/care-tasks/${task.id}/complete`,
        { event_type: "photo_observation" },
      );
      await apiPostAuthed("/api/plant-photos", {
        kytka_id: task.kytka_id,
        storage_path: uploaded.storagePath,
        care_event_id: response.event_id,
      });
      await loadToday({ showLoading: false });
    } catch (photoError) {
      setError(
        photoError instanceof Error ? photoError.message : "Fotku se nepodařilo uložit.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSkip(taskIds: string[], key: string) {
    setError(null);
    setBusyKey(key);

    try {
      for (const taskId of taskIds) {
        await apiPostAuthed(`/api/care-tasks/${taskId}/skip`, {});
      }
      await loadToday({ showLoading: false });
    } catch (skipError) {
      setError(
        skipError instanceof Error ? skipError.message : "Úkol se nepodařilo přeskočit.",
      );
    } finally {
      setBusyKey(null);
    }
  }


  return (
    <section className="screen screen--stack" aria-label="Dnes">
      <ScreenHeader title="Dnes" subtitle="Co dnes zase zanedbáváš" />

      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      <input
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={handlePhotoSelected}
        ref={photoInputRef}
        type="file"
      />

      {everyoneAway ? (
        <div className="today-banner">
          <Plane aria-hidden="true" size={20} />
          <Text as="p" variant="body">
            Oba jste pryč. Kytky teď musí přežít bez dozoru.
          </Text>
        </div>
      ) : null}

      {!everyoneAway && activeAbsences.length > 0 ? (
        <div className="today-banner">
          <Plane aria-hidden="true" size={20} />
          <Text as="p" variant="body">
            {formatAbsenceList(activeAbsences)}
          </Text>
        </div>
      ) : null}

      {visibleProfileLess.length > 0 ? (
        <div className="today-banner">
          <Sprout aria-hidden="true" size={20} />
          <Text as="p" variant="body" className="today-banner__text">
            {formatProfileLessList(visibleProfileLess)}
          </Text>
          <IconButton
            icon={<X aria-hidden="true" size={16} />}
            label="Skrýt"
            onClick={handleDismissProfileLess}
            size="sm"
            variant="ghost"
          />
        </div>
      ) : null}

      {lightMismatches.length > 0 ? (
        <div className="today-banner">
          <Sun aria-hidden="true" size={20} />
          <Text as="p" variant="body">
            {formatLightMismatchList(lightMismatches)}
          </Text>
        </div>
      ) : null}

      {wateringGroups.length >= 2 || fertilizingGroups.length >= 2 ? (
        <div className="today-bulk-actions">
          {wateringGroups.length >= 2 ? (
            <Button
              disabled={bulkBusy !== null}
              icon={<Droplets aria-hidden="true" size={20} />}
              onClick={() => handleBulkComplete("watering", wateringGroups)}
            >
              {bulkBusy === "watering"
                ? "Zalévám..."
                : `Zalít vše (${wateringGroups.reduce((sum, g) => sum + g.tasks.length, 0)})`}
            </Button>
          ) : null}
          {fertilizingGroups.length >= 2 ? (
            <Button
              disabled={bulkBusy !== null}
              icon={<Sprout aria-hidden="true" size={20} />}
              onClick={() => handleBulkComplete("fertilizing", fertilizingGroups)}
            >
              {bulkBusy === "fertilizing"
                ? "Hnojím..."
                : `Přihnojit vše (${fertilizingGroups.reduce((sum, g) => sum + g.tasks.length, 0)})`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? <SkeletonCard aria-label="Načítám dnešní plán" lines={2} /> : null}

      {!isLoading && !error && groups.length === 0 ? (
        <EmptyState
          icon={<CircleCheck aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Dnes nikdo neumírá. Zatím."
          variant="inline"
        />
      ) : null}

      {groups.length > 0 ? (
        <div className="kytka-list">
          {groups.map((group) => (
            <TaskCard
              busyKey={busyKey}
              group={group}
              key={group.key}
              kytkaById={kytkaById}
              onOpenDetailed={openDetailedSheet}
              onOpenPhoto={openPhotoPicker}
              onQuickComplete={handleQuickComplete}
              onSkip={handleSkip}
            />
          ))}
        </div>
      ) : null}

      <Sheet
        isOpen={activeTask !== null}
        onClose={resetDetailedSheet}
        title={activeTask ? TASK_TYPE_LABELS[activeTask.task_type] ?? activeTask.title : ""}
      >
        <div className="location-form">
          <form onSubmit={handleSubmitDetailed}>
            <CareEventFields
              disabled={isSaving}
              onChange={(patch) =>
                setFormValues((current) => ({ ...current, ...patch }))
              }
              values={formValues}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : "Uložit"}
            </Button>
          </form>
        </div>
      </Sheet>
    </section>
  );
}

type TaskCardProps = {
  busyKey: string | null;
  group: TaskGroup;
  kytkaById: Map<string, KytkaListItem>;
  onOpenDetailed: (task: CareTaskItem) => void;
  onOpenPhoto: (taskId: string) => void;
  onQuickComplete: (group: Extract<TaskGroup, { kind: "quick" }>) => void;
  onSkip: (taskIds: string[], key: string) => void;
};

function TaskCard({
  busyKey,
  group,
  kytkaById,
  onOpenDetailed,
  onOpenPhoto,
  onQuickComplete,
  onSkip,
}: TaskCardProps) {
  const isBusy = busyKey === group.key;
  const Icon =
    TASK_TYPE_ICONS[group.kind === "quick" ? group.taskType : group.task.task_type] ?? Droplets;

  if (group.kind === "quick") {
    const names = group.tasks
      .map((task) => (task.kytka_id ? kytkaById.get(task.kytka_id)?.display_name : null))
      .filter((name): name is string => Boolean(name));
    const firstKytka = group.tasks[0]?.kytka_id
      ? kytkaById.get(group.tasks[0].kytka_id as string)
      : null;
    const targetLabel =
      names.length > 1
        ? firstKytka?.container_name ?? names.join(", ")
        : names[0] ?? group.tasks[0]?.title ?? TASK_TYPE_LABELS[group.taskType];
    const isHighPriority = group.tasks.some(
      (task) => task.priority === "high" || task.priority === "critical",
    );
    const explanation = group.tasks[0]?.explanation ?? null;
    const taskIds = group.tasks.map((task) => task.id);

    return (
      <article className="entity-card kytka-list__item">
        <div className="today-task__header">
          <div className="kytka-list__item-row">
            {names.length === 1 && firstKytka ? (
              <PlantAvatar
                bucket={firstKytka.primary_photo_bucket}
                label={targetLabel}
                path={firstKytka.primary_photo_path}
                size="sm"
              />
            ) : null}
            <div>
              <div className="kytka-detail__event-row-title">
                <Icon aria-hidden="true" size={18} />
                <Text as="span" variant="title" tone={isHighPriority ? "danger" : "default"}>
                  {targetLabel}
                </Text>
              </div>
              {explanation ? (
                <Text as="p" variant="body" tone="muted">
                  {explanation}
                </Text>
              ) : null}
              {names.length > 1 ? (
                <Text as="p" variant="caption" tone="muted" className="today-task__names">
                  {names.join(", ")}
                </Text>
              ) : null}
            </div>
          </div>
          <div className="kytka-detail__header-actions-group">
            <IconButton
              disabled={isBusy}
              icon={<X aria-hidden="true" size={16} />}
              label="Přeskočit"
              onClick={() => onSkip(taskIds, group.key)}
              size="sm"
              variant="ghost"
            />
          </div>
        </div>
        <div className="today-task__footer">
          <Button disabled={isBusy} onClick={() => onQuickComplete(group)} variant="ghost">
            {isBusy ? QUICK_TASK_BUSY_LABEL[group.taskType] : QUICK_TASK_BUTTON_LABEL[group.taskType]}
          </Button>
        </div>
      </article>
    );
  }

  const task = group.task;
  const kytka = task.kytka_id ? kytkaById.get(task.kytka_id) : null;
  const isHighPriority = task.priority === "high" || task.priority === "critical";

  return (
    <article className="entity-card kytka-list__item">
      <div className="today-task__header">
        <div className="kytka-list__item-row">
          {kytka ? (
            <PlantAvatar
              bucket={kytka.primary_photo_bucket}
              label={kytka.display_name}
              path={kytka.primary_photo_path}
              size="sm"
            />
          ) : null}
          <div>
            <div className="kytka-detail__event-row-title">
              <Icon aria-hidden="true" size={18} />
              <Text as="span" variant="title" tone={isHighPriority ? "danger" : "default"}>
                {kytka?.display_name ?? task.title}
              </Text>
            </div>
            <Text as="p" variant="body" tone="muted">
              {task.explanation ?? TASK_TYPE_LABELS[task.task_type]}
            </Text>
          </div>
        </div>
        <div className="kytka-detail__header-actions-group">
          <IconButton
            disabled={isBusy}
            icon={<X aria-hidden="true" size={16} />}
            label="Přeskočit"
            onClick={() => onSkip([task.id], group.key)}
            size="sm"
            variant="ghost"
          />
        </div>
      </div>
      <div className="today-task__footer">
        {group.kind === "detailed" ? (
          <Button disabled={isBusy} onClick={() => onOpenDetailed(task)} variant="ghost">
            Zaznamenat
          </Button>
        ) : (
          <Button disabled={isBusy} onClick={() => onOpenPhoto(task.id)} variant="ghost">
            {isBusy ? "Nahrávám..." : "Vyfotit"}
          </Button>
        )}
      </div>
    </article>
  );
}

function formatAbsenceList(absences: ActiveAbsenceItem[]): string {
  const parts = absences.map((absence) => {
    const name = absence.display_name ?? "Někdo";
    return `${name} (do ${formatShortDate(absence.ends_on)})`;
  });
  return `Pryč: ${parts.join(", ")}.`;
}

const LIGHT_LABELS: Record<string, string> = {
  full_sun: "plné slunce",
  partial_sun: "poloslunce",
  bright_indirect: "světlé nepřímé",
  shade: "stín",
};

function formatLightMismatchList(mismatches: LightMismatchItem[]): string {
  const parts = mismatches.map((mismatch) => {
    const name = mismatch.display_name ?? "Kytka";
    const need = LIGHT_LABELS[mismatch.light_need] ?? mismatch.light_need;
    const exposure = LIGHT_LABELS[mismatch.light_exposure] ?? mismatch.light_exposure;
    const zone = mismatch.zone_name ? ` (${mismatch.zone_name})` : "";
    return `${name} chce ${need}, ale má ${exposure}${zone}`;
  });
  return `Možná nejsem na správném místě: ${parts.join("; ")}.`;
}

function formatProfileLessList(kytky: ProfileLessKytkaItem[]): string {
  const names = kytky.map((kytka) => kytka.display_name ?? "Kytka").join(", ");
  return kytky.length === 1
    ? `${names} nemá profil — bez něj nevím, jak ji zachránit.`
    : `${names} nemají profil — bez něj nevím, jak je zachránit.`;
}

const PROFILE_LESS_DISMISS_KEY = "nmch:dismissed-profile-less-kytky";

function readDismissedProfileLessIds(): string[] {
  try {
    const raw = window.localStorage.getItem(PROFILE_LESS_DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissedProfileLessIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(
      PROFILE_LESS_DISMISS_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // localStorage can fail (private mode, quota) — dismiss just won't persist
  }
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

function buildGroups(
  tasks: CareTaskItem[],
  kytkaById: Map<string, KytkaListItem>,
): TaskGroup[] {
  const pending = tasks.filter((task) => task.status === "pending");
  const quickByKey = new Map<string, CareTaskItem[]>();
  const orderedKeys: string[] = [];
  const others: TaskGroup[] = [];

  for (const task of pending) {
    const priorityRank = PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.normal;

    if (
      QUICK_TASK_TYPES.includes(task.task_type as QuickTaskType) &&
      task.kytka_id &&
      kytkaById.get(task.kytka_id)?.container_id
    ) {
      const containerId = kytkaById.get(task.kytka_id)?.container_id;
      const key = `quick:${task.task_type}:${containerId}`;
      if (!quickByKey.has(key)) {
        quickByKey.set(key, []);
        orderedKeys.push(key);
      }
      quickByKey.get(key)?.push(task);
      continue;
    }

    if (task.task_type === "photo_observation") {
      others.push({ kind: "photo", key: task.id, task, priorityRank });
      continue;
    }

    others.push({ kind: "detailed", key: task.id, task, priorityRank });
  }

  const quickGroups: TaskGroup[] = orderedKeys.map((key) => {
    const groupTasks = quickByKey.get(key) ?? [];
    const priorityRank = Math.min(
      ...groupTasks.map((task) => PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.normal),
    );
    const [, taskType] = key.split(":");
    return {
      kind: "quick",
      key,
      taskType: taskType as QuickTaskType,
      tasks: groupTasks,
      priorityRank,
    };
  });

  return [...quickGroups, ...others].sort((a, b) => a.priorityRank - b.priorityRank);
}
