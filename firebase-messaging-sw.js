importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAcQx1ZzgBI2GS8wih6Bdb5fgczBGdaxWg",
  projectId: "madiyan-reminders",
  messagingSenderId: "8448913143",
  appId: "1:8448913143:web:8f35331cc43e980a976df2"
});

// OS Notification Tray Button Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'done') {
    // Send message to open client tabs
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ action: 'done', taskId: event.notification.tag });
      });
    });
  } else if (event.action === 'snooze') {
    // Can snooze or open app
    self.clients.openWindow('/');
  } else {
    self.clients.openWindow('/');
  }
});