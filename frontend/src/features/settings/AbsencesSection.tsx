import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plane, Plus } from "lucide-react";
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
import type { AbsenceCreateRequest, AbsenceItem } from "../../types/absence";
import type { MeResponse, WorkspaceMemberItem } from "../../types/workspace";
import "../screens/screen.css";

type AbsencesSectionProps = {
  onBack: () => void;
};

const BOTH_VALUE = "both";

type FormState = {
  who: string;
  startsOn: string;
  endsOn: string;
  reason: string;
};

const DEFAULT_FORM_STATE: FormState = {
  who: "",
  startsOn: "",
  endsOn: "",
  reason: "",
};

export function AbsencesSection({ onBack }: AbsencesSectionProps) {
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceItem | null>(null);
  const [formValues, setFormValues] = useState<FormState>(DEFAULT_FORM_STATE);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadData = useCallback(async (options: {
    showLoading?: boolean;
    suppressError?: boolean;
  } = {}) => {
    setError(null);
    if (options.showLoading ?? true) {
      setIsLoading(true);
    }

    try {
      const [absencesData, membersData, meData] = await Promise.all([
        apiGetAuthed<AbsenceItem[]>("/api/absences"),
        apiGetAuthed<WorkspaceMemberItem[]>("/api/workspaces/members"),
        apiGetAuthed<MeResponse>("/api/me"),
      ]);
      setAbsences(absencesData);
      setMembers(membersData);
      setMe(meData);
    } catch (loadError) {
      if (!options.suppressError) {
        setError(loadError instanceof Error ? loadError.message : "Absence se nenačetly.");
      } else {
        console.warn("Absence se po změně nepodařilo obnovit.", loadError);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function memberLabel(userId: string): string {
    if (me && userId === me.user_id) {
      return "Já";
    }
    return members.find((member) => member.user_id === userId)?.display_name ?? "Partner";
  }

  const whoOptions = [
    ...members.map((member) => ({
      label: memberLabel(member.user_id),
      value: member.user_id,
    })),
    ...(members.length > 1 ? [{ label: "Oba", value: BOTH_VALUE }] : []),
  ];

  function openCreateSheet() {
    setEditingAbsence(null);
    setFormValues({ ...DEFAULT_FORM_STATE, who: me?.user_id ?? "" });
    setIsCreateSheetOpen(true);
  }

  function openEditSheet(absence: AbsenceItem) {
    setEditingAbsence(absence);
    setFormValues({
      who: absence.user_id,
      startsOn: absence.starts_on,
      endsOn: absence.ends_on,
      reason: absence.reason ?? "",
    });
  }

  function resetForm() {
    setIsCreateSheetOpen(false);
    setEditingAbsence(null);
    setFormValues(DEFAULT_FORM_STATE);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValues.who || !formValues.startsOn || !formValues.endsOn) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const basePayload = {
        starts_on: formValues.startsOn,
        ends_on: formValues.endsOn,
        reason: formValues.reason || null,
      };

      const savedAbsences: AbsenceItem[] = [];
      if (editingAbsence) {
        const payload: AbsenceCreateRequest = { user_id: formValues.who, ...basePayload };
        savedAbsences.push(
          await apiPatchAuthed<AbsenceItem>(
            `/api/absences/${editingAbsence.id}`,
            payload,
          ),
        );
      } else if (formValues.who === BOTH_VALUE) {
        for (const member of members) {
          const payload: AbsenceCreateRequest = { user_id: member.user_id, ...basePayload };
          savedAbsences.push(await apiPostAuthed<AbsenceItem>("/api/absences", payload));
        }
      } else {
        const payload: AbsenceCreateRequest = { user_id: formValues.who, ...basePayload };
        savedAbsences.push(await apiPostAuthed<AbsenceItem>("/api/absences", payload));
      }

      setAbsences((current) => {
        if (!editingAbsence) {
          return [...savedAbsences, ...current];
        }

        const saved = savedAbsences[0];
        if (!saved) {
          return current;
        }

        return current.map((absence) =>
          absence.id === saved.id ? saved : absence,
        );
      });
      resetForm();
      void loadData({ showLoading: false, suppressError: true });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Absenci se nepodařilo uložit.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(absence: AbsenceItem) {
    const confirmed = await confirm({
      confirmLabel: "Smazat",
      title: "Smazat tuto absenci?",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await apiDeleteAuthed(`/api/absences/${absence.id}`);
      setAbsences((current) => current.filter((item) => item.id !== absence.id));
      resetForm();
      void loadData({ showLoading: false, suppressError: true });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Absenci se nepodařilo smazat.",
      );
    }
  }

  return (
    <section className="screen screen--stack screen--with-floating-action" aria-label="Absence">
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
        title="Absence"
        subtitle="Kdy nikdo nezalévá"
      />

      {isLoading ? <SkeletonCard aria-label="Načítám absence" lines={1} /> : null}
      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {confirmDialog}

      {!isLoading && !error && absences.length === 0 ? (
        <EmptyState
          icon={<Plane aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Zatím žádná naplánovaná absence."
          variant="inline"
        />
      ) : null}

      {absences.length > 0 ? (
        <div className="entity-list">
          {absences.map((absence) => (
            <article className="entity-card" key={absence.id}>
              <div className="place-tree__header">
                <div>
                  <Text variant="title">
                    {formatDateRange(absence.starts_on, absence.ends_on)}
                  </Text>
                  <Text as="p" variant="body" tone="muted">
                    {memberLabel(absence.user_id)}
                    {absence.reason ? ` · ${absence.reason}` : ""}
                  </Text>
                </div>
                <IconButton
                  icon={<Pencil aria-hidden="true" size={16} />}
                  label="Upravit absenci"
                  onClick={() => openEditSheet(absence)}
                  size="sm"
                />
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Sheet
        isOpen={isCreateSheetOpen || editingAbsence !== null}
        onClose={resetForm}
        title={editingAbsence ? "Upravit absenci" : "Nová absence"}
      >
        <div className="location-form">
          <form onSubmit={handleSubmit}>
            <ChoiceField
              disabled={isSaving || (editingAbsence !== null)}
              label="Kdo"
              onValueChange={(value) =>
                setFormValues((current) => ({ ...current, who: value }))
              }
              options={whoOptions}
              value={formValues.who}
            />
            <TextField
              disabled={isSaving}
              label="Od"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, startsOn: event.target.value }))
              }
              required
              type="date"
              value={formValues.startsOn}
            />
            <TextField
              disabled={isSaving}
              label="Do"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, endsOn: event.target.value }))
              }
              required
              type="date"
              value={formValues.endsOn}
            />
            <TextField
              disabled={isSaving}
              label="Důvod (nepovinné)"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, reason: event.target.value }))
              }
              value={formValues.reason}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Ukládám..." : editingAbsence ? "Uložit změny" : "Uložit absenci"}
            </Button>
            {editingAbsence ? (
              <Button
                disabled={isSaving}
                onClick={() => handleDelete(editingAbsence)}
                type="button"
                variant="ghost"
              >
                Smazat absenci
              </Button>
            ) : null}
          </form>
        </div>
      </Sheet>

      {!isCreateSheetOpen && editingAbsence === null ? (
        <div className="screen-floating-action">
          <Button icon={<Plus aria-hidden="true" size={20} />} onClick={openCreateSheet}>
            Přidat
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatDateRange(startsOn: string, endsOn: string): string {
  const start = formatDate(startsOn);
  const end = formatDate(endsOn);
  return start === end ? start : `${start} – ${end}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}
