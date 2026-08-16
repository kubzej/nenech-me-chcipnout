import { useState } from "react";
import { ArrowLeft, BellOff, Send, Smartphone } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Text } from "../../components/ui/Text";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import type { NotificationPreferencesItem } from "../../types/push";
import "../screens/screen.css";

type NotificationsSectionProps = {
  onBack: () => void;
};

type BoolPrefKey = "daily_plan_enabled";

type NotificationTypeMeta = {
  description: string;
  label: string;
};

const TYPE_META: Record<BoolPrefKey, NotificationTypeMeta> = {
  daily_plan_enabled: {
    label: "Denní přehled úkolů",
    description: "Souhrn toho, co dnes zalít, přihnojit nebo zkontrolovat.",
  },
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
          <div className="settings-card notification-master">
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
            <Button
              disabled={isBusy}
              onClick={handleToggleMaster}
              variant="ghost"
            >
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
  const isEnabled = settings.master_enabled;

  return (
    <div className="settings-card notification-settings">
      <div className="notification-settings__header">
        <div>
          <Text variant="title">Typy upozornění</Text>
          <Text as="p" variant="caption" tone="muted">
            Vyber, co má stát za vyrušení. Když jsou push notifikace vypnuté, nic
            z toho se neposílá.
          </Text>
        </div>
      </div>

      <div className="notification-settings__list">
        {(Object.keys(TYPE_META) as BoolPrefKey[]).map((key) => (
          <NotificationSwitchRow
            description={TYPE_META[key].description}
            disabled={!isEnabled}
            isOn={settings[key]}
            key={key}
            label={TYPE_META[key].label}
            onToggle={() => onUpdateBool(key, settings[key] ? "off" : "on")}
          />
        ))}
      </div>

      <label className={`notification-time-row${!isEnabled ? " is-disabled" : ""}`}>
        <span className="notification-time-row__text">
          <Text as="span" variant="label">
            Čas notifikace
          </Text>
          <Text as="span" variant="caption" tone="muted">
            Kdy má přijít denní seznam úkolů.
          </Text>
        </span>
        <input
          className="notification-time-row__input"
          disabled={!isEnabled}
          onChange={(event) => onUpdateTime("morning_time", event.target.value)}
          type="time"
          value={settings.morning_time.slice(0, 5)}
        />
      </label>

      <div className="notification-settings__test">
        <Button
          disabled={isSendingTest || !isEnabled}
          icon={<Send aria-hidden="true" size={16} />}
          onClick={onSendTest}
          variant="ghost"
        >
          {isSendingTest ? "Posílám..." : "Poslat testovací notifikaci"}
        </Button>
        {testResult ? (
          <Text as="p" variant="caption" tone="muted">
            {testResult}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

type NotificationSwitchRowProps = {
  description: string;
  disabled: boolean;
  isOn: boolean;
  label: string;
  onToggle: () => void;
};

function NotificationSwitchRow({
  description,
  disabled,
  isOn,
  label,
  onToggle,
}: NotificationSwitchRowProps) {
  return (
    <div className={`notification-switch-row${disabled ? " is-disabled" : ""}`}>
      <span className="notification-switch-row__text">
        <Text as="span" variant="label">
          {label}
        </Text>
        <Text as="span" variant="caption" tone="muted">
          {description}
        </Text>
      </span>
      <button
        aria-checked={isOn}
        aria-label={`${label}: ${isOn ? "zapnuto" : "vypnuto"}`}
        className={`notification-switch${isOn ? " is-on" : ""}`}
        disabled={disabled}
        onClick={onToggle}
        role="switch"
        type="button"
      >
        <span className="notification-switch__thumb" />
      </button>
    </div>
  );
}
