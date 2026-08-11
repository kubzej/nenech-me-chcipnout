import { useState } from "react";
import { ArrowLeft, BellOff, Smartphone } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ChoiceField } from "../../components/ui/ChoiceField";
import { EmptyState } from "../../components/ui/EmptyState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Text } from "../../components/ui/Text";
import { TextField } from "../../components/ui/TextField";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import type { NotificationPreferencesItem } from "../../types/push";
import "../screens/screen.css";

type NotificationsSectionProps = {
  onBack: () => void;
};

const ON_OFF_OPTIONS = [
  { label: "Zapnuto", value: "on" },
  { label: "Vypnuto", value: "off" },
] as const;

type BoolPrefKey =
  | "daily_plan_enabled"
  | "critical_weather_enabled"
  | "sick_plant_enabled";

const TYPE_LABELS: Record<BoolPrefKey, string> = {
  daily_plan_enabled: "Denní přehled úkolů",
  critical_weather_enabled: "Kritické počasí",
  sick_plant_enabled: "Nemocná/sledovaná kytka",
};

export function NotificationsSection({ onBack }: NotificationsSectionProps) {
  const {
    isSupported,
    isIosNotInstalled,
    permission,
    isSubscribed,
    isBusy,
    settings,
    error,
    subscribe,
    unsubscribe,
    updateSettings,
    sendTest,
  } = usePushNotifications();

  const [testResult, setTestResult] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  async function handleToggleMaster() {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  async function handleSendTest() {
    setIsSendingTest(true);
    setTestResult(null);
    const sent = await sendTest();
    setTestResult(sent > 0 ? `Odesláno na ${sent} zařízení.` : "Žádné aktivní zařízení.");
    setIsSendingTest(false);
  }

  function updateBoolPref(key: BoolPrefKey, value: string) {
    void updateSettings({ [key]: value === "on" });
  }

  function updateTimePref(key: "morning_time", value: string) {
    if (!value) {
      return;
    }
    void updateSettings({ [key]: value });
  }

  return (
    <section className="screen screen--stack" aria-label="Notifikace">
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
        title="Notifikace"
        subtitle="Ať tě stihnu otravovat včas"
      />

      {error ? (
        <Text as="p" variant="body" tone="danger" className="text-banner">
          {error}
        </Text>
      ) : null}

      {!isSupported ? (
        <EmptyState
          icon={<BellOff aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Tenhle prohlížeč push notifikace nepodporuje."
          variant="inline"
        />
      ) : isIosNotInstalled ? (
        <EmptyState
          icon={<Smartphone aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Nejdřív appku přidej na plochu."
          description="Sdílet → Přidat na plochu. Pak se sem vrať a notifikace půjdou zapnout."
          variant="inline"
        />
      ) : permission === "denied" ? (
        <EmptyState
          icon={<BellOff aria-hidden="true" size={30} strokeWidth={2.1} />}
          title="Notifikace jsou blokované."
          description="Povol je v nastavení prohlížeče/systému pro tuhle appku, pak zkus znovu."
          variant="inline"
        />
      ) : (
        <>
          <div className="entity-card">
            <div className="place-tree__header">
              <div>
                <Text variant="title">Push notifikace</Text>
                <Text as="p" variant="body" tone="muted">
                  {isSubscribed
                    ? "Zapnuté na tomhle zařízení"
                    : "Vypnuté na tomhle zařízení"}
                </Text>
              </div>
            </div>
            <Button disabled={isBusy} onClick={handleToggleMaster} variant="ghost">
              {isBusy ? "Chvilku..." : isSubscribed ? "Vypnout" : "Zapnout notifikace"}
            </Button>
          </div>

          {isSubscribed && settings ? (
            <TypeSettings
              onSendTest={handleSendTest}
              onUpdateBool={updateBoolPref}
              onUpdateTime={updateTimePref}
              isSendingTest={isSendingTest}
              settings={settings}
              testResult={testResult}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

type TypeSettingsProps = {
  isSendingTest: boolean;
  onSendTest: () => void;
  onUpdateBool: (key: BoolPrefKey, value: string) => void;
  onUpdateTime: (key: "morning_time", value: string) => void;
  settings: NotificationPreferencesItem;
  testResult: string | null;
};

function TypeSettings({
  isSendingTest,
  onSendTest,
  onUpdateBool,
  onUpdateTime,
  settings,
  testResult,
}: TypeSettingsProps) {
  return (
    <div className="entity-card">
      <Text as="p" variant="label">
        Typy upozornění
      </Text>

      {(Object.keys(TYPE_LABELS) as BoolPrefKey[]).map((key) => (
        <ChoiceField
          disabled={!settings.master_enabled}
          key={key}
          label={TYPE_LABELS[key]}
          onValueChange={(value) => onUpdateBool(key, value)}
          options={ON_OFF_OPTIONS}
          value={settings[key] ? "on" : "off"}
        />
      ))}

      <TextField
        label="Čas denního přehledu"
        onChange={(event) => onUpdateTime("morning_time", event.target.value)}
        type="time"
        value={settings.morning_time.slice(0, 5)}
      />

      <Button disabled={isSendingTest} onClick={onSendTest} variant="ghost">
        {isSendingTest ? "Posílám..." : "Poslat testovací notifikaci"}
      </Button>
      {testResult ? (
        <Text as="p" variant="caption" tone="muted">
          {testResult}
        </Text>
      ) : null}
    </div>
  );
}
