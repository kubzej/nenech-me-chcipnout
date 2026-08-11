import { useCallback, useEffect, useState } from "react";
import { apiGetAuthed, apiPatchAuthed, apiPostAuthed } from "../lib/api";
import { isIOS, isStandalone, urlBase64ToUint8Array } from "../lib/pushPlatform";
import type {
  NotificationPreferencesItem,
  NotificationPreferencesUpdate,
  VapidKeyResponse,
} from "../types/push";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [settings, setSettings] = useState<NotificationPreferencesItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isIosNotInstalled = isIOS() && !isStandalone();

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    if (!supported) {
      return;
    }
    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(subscription !== null))
      .catch(() => setIsSubscribed(false));
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiGetAuthed<NotificationPreferencesItem>("/api/push/settings");
      setSettings(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nastavení notifikací se nenačetlo.",
      );
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (patch: NotificationPreferencesUpdate) => {
    try {
      const data = await apiPatchAuthed<NotificationPreferencesItem>(
        "/api/push/settings",
        patch,
      );
      setSettings(data);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Nastavení se nepodařilo uložit.",
      );
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    setError(null);
    setIsBusy(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        return false;
      }

      const vapid = await apiGetAuthed<VapidKeyResponse>("/api/push/vapid-key");

      let applicationServerKey: Uint8Array;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapid.public_key);
      } catch (decodeError) {
        throw new Error(
          `VAPID klíč ze serveru se nepodařilo dekódovat (délka ${vapid.public_key.length} znaků): ${
            decodeError instanceof Error ? decodeError.message : String(decodeError)
          }`,
        );
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const json = subscription.toJSON();
      await apiPostAuthed("/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: json.keys,
        user_agent: navigator.userAgent,
      });

      setIsSubscribed(true);
      await updateSettings({ master_enabled: true });
      return true;
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Přihlášení k notifikacím selhalo.",
      );
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, updateSettings]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiPostAuthed("/api/push/unsubscribe", { endpoint: subscription.endpoint });
        try {
          await subscription.unsubscribe();
        } catch {
          // The backend is the source of truth and is already updated —
          // a flaky browser-side unsubscribe (common on iOS) shouldn't
          // leave the UI stuck showing "enabled".
        }
      }
      setIsSubscribed(false);
      await updateSettings({ master_enabled: false });
    } catch (unsubscribeError) {
      setError(
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : "Odhlášení z notifikací selhalo.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [updateSettings]);

  const sendTest = useCallback(async (): Promise<number> => {
    try {
      const result = await apiPostAuthed<{ sent: number }>("/api/push/test", {});
      return result.sent;
    } catch (testError) {
      setError(
        testError instanceof Error ? testError.message : "Test se nepodařilo odeslat.",
      );
      return 0;
    }
  }, []);

  return {
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
  };
}
