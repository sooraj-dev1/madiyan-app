importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAcQx1ZzgBI2GS8wih6Bdb5fgczBGdaxWg",
  projectId: "madiyan-reminders",
  messagingSenderId: "8448913143",
  appId: "1:8448913143:web:8f35331cc43e980a976df2"
});

const messaging = firebase.messaging();

// APP LOGOUT / CLOSED AAYALUM PUSH MESSAGE RECEIVE CHEYYUNNA MAIN HANDLER:
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background notification received: ', payload);

  const title = payload.notification?.title || payload.data?.title || "Madiyan Reminder! ⏰";
  const body = payload.notification?.body || payload.data?.body || "Uluppundo suhruthe? Task time kazhinju!";

  const notificationOptions = {
    body: body,
    icon: "https://cdn-icons-png.flaticon.com/512/3239/3239958.png",
    badge: "https://cdn-icons-png.flaticon.com/512/3239/3239958.png",
    requireInteraction: true,
    tag: payload.data?.taskId || 'madiyan-alert',
    actions: [
      { action: 'done', title: '✓ Theerthu' },
      { action: 'snooze', title: '⏱ Snooze (+5m)' }
    ]
  };

  self.registration.showNotification(title, notificationOptions);
});

// OS Notification Tray Button Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'done') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ action: 'done', taskId: event.notification.tag });
      });
    });
  } else if (event.action === 'snooze') {
    self.clients.openWindow('./');
  } else {
    self.clients.openWindow('./');
  }
});