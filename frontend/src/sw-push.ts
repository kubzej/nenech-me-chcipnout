/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

// Activate a newly deployed service worker immediately rather than waiting
// for every open tab to close — this app is mostly opened via push-taps, so
// a stale waiting worker would otherwise sit unused indefinitely.
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(new NavigationRoute(navigationHandler));

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload: PushPayload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: payload.body ?? "",
    icon: "/brand/app-icon.png",
    badge: "/brand/app-icon.png",
    tag: payload.tag ?? "nenech-me-chcipnout",
    renotify: true,
    data: { url: payload.url ?? "/" },
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Nenech mě chcípnout!", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            (client as WindowClient).navigate(url);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
