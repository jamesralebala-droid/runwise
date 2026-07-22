// ============================================================================
// RunWise — Notification Service Worker
// Handles push events, notification display, and notification clicks.
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events from the server
self.addEventListener('push', (event) => {
  let data = { title: 'RunWise', body: '', icon: '/runwise-logo.svg', badge: '/runwise-logo.svg', tag: '' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    data.body = event.data?.text() || 'New RunWise update';
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'runwise-default',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Handle notification click — open RunWise to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Navigate to the relevant section based on notification data
  if (data.order_room_id) {
    url = '/?room=' + data.order_room_id;
  } else if (data.match_id) {
    url = '/?match=' + data.match_id;
  } else if (data.request_id) {
    url = '/?request=' + data.request_id;
  } else if (data.trip_id) {
    url = '/?trip=' + data.trip_id;
  } else if (data.page) {
    url = '/?page=' + data.page;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a RunWise tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
