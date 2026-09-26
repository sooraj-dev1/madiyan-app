// ================= 1. FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyAcQx1ZzgBI2GS8wih6Bdb5fgczBGdaxWg",
  authDomain: "madiyan-reminders.firebaseapp.com",
  projectId: "madiyan-reminders",
  storageBucket: "madiyan-reminders.firebasestorage.app",
  messagingSenderId: "8448913143",
  appId: "1:8448913143:web:8f35331cc43e980a976df2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// Step 2-il kittiya VAPID Public Key:
const VAPID_KEY = "BKHD-zngiP7nAVFLLLsQkakDwTM0tBvyZrmwwd82A-bcTKXkOcQDMBDpxIzEYRYhIVJow_qnE5DKCNHT--g20WA";

// Sarcastic Manglish Roasts Database
const ROASTS = {
  salim: [
    "Eda dooshya... Task time kazhinju! Ini entha justification?",
    "Pora... ninte oru ithu pora! Alpam engilum uluppu baki undo?",
    "Vicharichaal nadakkilla ennu ariyam, ennalum oru reminder thannathaanu!"
  ],
  amma: [
    "Phone scroll cheythu theerkkane munpu aa task theerku!",
    "Baki ullavar ee samayath kond ethra karyangal theerkkunnu!",
    "Padichitt karyamilla, oru karyavum samayathu cheyyilla!"
  ],
  chank: [
    "Aliyaaa... Scene aakum! Poyi aa task cheyyeda!",
    "Ithrem valiya tholvi njaan swapnathil polum kandittilla!",
    "5 minutes koodi snooze cheythu ivide aarum Ambani aayittilla!"
  ]
};

// ================= UI SELECTORS =================
const authContainer = document.getElementById("auth-container");
const dashboardContainer = document.getElementById("dashboard-container");
const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const authError = document.getElementById("auth-error");
const authSuccess = document.getElementById("auth-success");
const googleBtn = document.getElementById("google-btn");
const forgotPasswordLink = document.getElementById("forgot-password-link");

// Dashboard Elements
const userAvatar = document.getElementById("user-avatar");
const userNameTag = document.getElementById("user-name-tag");
const userEmailTag = document.getElementById("user-email-tag");
const logoutBtn = document.getElementById("logout-btn");
const testNotifBtn = document.getElementById("test-notif-btn");
const notifPermBanner = document.getElementById("notif-perm-banner");
const grantPermBtn = document.getElementById("grant-perm-btn");
const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");

let currentUser = null;
let currentDeviceToken = null;
let activeTasks = [];
let serviceWorkerRegistration = null;

// ================= AUTH SWITCHER =================
tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  clearMessages();
});

tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  clearMessages();
});

function clearMessages() {
  authError.innerText = "";
  authSuccess.innerText = "";
}

// 1. LOGIN HANDLER
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    authError.innerText = err.message;
  }
});

// 2. SIGNUP HANDLER (Name Profile Save)
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;

  if (password !== confirmPassword) {
    authError.innerText = "Passwords do not match!";
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection("users").doc(cred.user.uid).set({
      name: name,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    authError.innerText = err.message;
  }
});

// 3. FORGOT PASSWORD
forgotPasswordLink.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    alert("Please enter your email address in the login box first!");
    document.getElementById("login-email").focus();
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    authSuccess.innerText = `Reset link sent to ${email}. Check inbox!`;
  } catch (err) {
    authError.innerText = err.message;
  }
});

// 4. GOOGLE SIGN-IN
googleBtn.addEventListener("click", async () => {
  clearMessages();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    authError.innerText = err.message;
  }
});

// LOGOUT
logoutBtn.addEventListener("click", () => auth.signOut());

// ================= AUTH OBSERVER =================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    authContainer.classList.add("hidden");
    dashboardContainer.classList.remove("hidden");

    let finalName = user.displayName;

    if (!finalName) {
      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists && userDoc.data().name) {
          finalName = userDoc.data().name;
        }
      } catch (err) {
        console.warn("User fetch error:", err);
      }
    }

    if (!finalName) {
      finalName = user.email.split("@")[0];
    }

    userNameTag.innerText = finalName;
    userEmailTag.innerText = user.email;
    userAvatar.innerText = finalName.charAt(0).toUpperCase();

    setupNotifications();
    loadTasks();
  } else {
    currentUser = null;
    currentDeviceToken = null;
    dashboardContainer.classList.add("hidden");
    authContainer.classList.remove("hidden");
  }
});

// ================= NOTIFICATION & FCM DEVICE TOKEN ENGINE =================
async function setupNotifications() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // Relative path for GitHub Pages compatibility
    serviceWorkerRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
    console.log("Service Worker Active:", serviceWorkerRegistration);

    if (Notification.permission === "granted") {
      notifPermBanner.classList.add("hidden");
      await fetchAndSaveDeviceToken();
    } else {
      notifPermBanner.classList.remove("hidden");
    }
  } catch (e) {
    console.warn("SW Registration Error:", e);
  }
}

// Fetch unique push token and save to Firestore
async function fetchAndSaveDeviceToken() {
  try {
    const swReg = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({
      serviceWorkerRegistration: swReg,
      vapidKey: VAPID_KEY
    });

    if (token) {
      currentDeviceToken = token;
      console.log("FCM Device Push Token:", token);

      if (currentUser) {
        await db.collection("users").doc(currentUser.uid).set({
          fcmToken: token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
  } catch (err) {
    console.warn("FCM Token fetch failed:", err);
  }
}

// Mobile Compatible Permission Trigger
async function requestNotificationAccess() {
  if (!("Notification" in window)) {
    alert("This browser does not support web notifications.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      notifPermBanner.classList.add("hidden");
      await fetchAndSaveDeviceToken();
      triggerPopNotification("Notifications Active! 🎉", "Task samayam thettiyaal roast pop varum!");
    } else if (permission === "denied") {
      alert("Notifications blocked! Please enable notifications in your browser settings.");
    }
  } catch (error) {
    Notification.requestPermission(async (res) => {
      if (res === "granted") {
        notifPermBanner.classList.add("hidden");
        await fetchAndSaveDeviceToken();
        triggerPopNotification("Notifications Active! 🎉", "Task samayam thettiyaal roast pop varum!");
      }
    });
  }
}

if (grantPermBtn) {
  grantPermBtn.addEventListener("click", requestNotificationAccess);
  grantPermBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    requestNotificationAccess();
  });
}

// Test Notification Button
testNotifBtn.addEventListener("click", async () => {
  if (Notification.permission !== "granted") {
    await requestNotificationAccess();
  }
  triggerPopNotification("Testing Madiyan Pop! ⏰", "Aliyaaa... Notification super aayi work aavunund!");
});

// ================= TEXT-TO-SPEECH (TTS) ENGINE =================
function speakRoast(taskTitle, roastMsg) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const voicePrompt = `Attention! Time out for ${taskTitle}. ${roastMsg}`;
  const utterance = new SpeechSynthesisUtterance(voicePrompt);

  utterance.lang = 'en-IN';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const indianVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India'));
  if (indianVoice) {
    utterance.voice = indianVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Trigger Native System Pop + Speech Out Loud
function triggerPopNotification(title, body, taskId = null) {
  playBeep();
  speakRoast(title, body);

  if (serviceWorkerRegistration && serviceWorkerRegistration.showNotification) {
    serviceWorkerRegistration.showNotification(title, {
      body: body,
      icon: "https://cdn-icons-png.flaticon.com/512/3239/3239958.png",
      badge: "https://cdn-icons-png.flaticon.com/512/3239/3239958.png",
      requireInteraction: true,
      tag: taskId || 'reminder',
      actions: [
        { action: 'done', title: '✓ Theerthu' },
        { action: 'snooze', title: '⏱ Snooze (+5m)' }
      ]
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: body });
  } else {
    alert(`⏰ ${title}\n\n${body}`);
  }
}

// Tone Beep
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

// ================= TASK ENGINE & SCHEDULER =================
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  const time = document.getElementById("task-time").value;
  const persona = document.getElementById("roast-persona").value;

  if (!currentUser) return;

  // Device Token assure cheyyunnu
  if (!currentDeviceToken) {
    await fetchAndSaveDeviceToken();
  }

  await db.collection("tasks").add({
    userId: currentUser.uid,
    deviceToken: currentDeviceToken || null, // Background worker ithilekkaanu notification push cheyyuka
    title,
    time: new Date(time).toISOString(),
    persona,
    completed: false,
    notified: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  taskForm.reset();
});

function loadTasks() {
  db.collection("tasks")
    .where("userId", "==", currentUser.uid)
    .where("completed", "==", false)
    .onSnapshot((snapshot) => {
      activeTasks = [];
      taskList.innerHTML = "";

      if (snapshot.empty) {
        taskList.innerHTML = `<p style="color:#71717a; font-size:13px; text-align:center; padding: 20px 0;">Oru pending task-um illa. Uluppulla aal!</p>`;
        return;
      }

      snapshot.forEach((doc) => {
        const t = doc.data();
        activeTasks.push({ id: doc.id, ...t });

        const card = document.createElement("div");
        card.className = "task-card";
        card.innerHTML = `
          <div>
            <h4>${t.title}</h4>
            <span>⏰ ${new Date(t.time).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
          </div>
          <div class="action-buttons">
            <button class="btn-card btn-done" onclick="finishTask('${doc.id}')">✓ Theerthu</button>
            <button class="btn-card btn-snooze" onclick="snoozeTask('${doc.id}', '${t.time}', '${t.persona}')">⏱ Snooze</button>
          </div>
        `;
        taskList.appendChild(card);
      });
    });
}

// Foreground local fallback checker (Tab open aayirikkumbo instant alert varan)
setInterval(async () => {
  if (!activeTasks.length) return;

  const now = new Date().getTime();

  for (const task of activeTasks) {
    const taskTime = new Date(task.time).getTime();

    if (taskTime <= now && !task.notified) {
      await db.collection("tasks").doc(task.id).update({ notified: true });

      const personaRoasts = ROASTS[task.persona] || ROASTS.salim;
      const roast = personaRoasts[Math.floor(Math.random() * personaRoasts.length)];

      triggerPopNotification(`⏰ Time Out: ${task.title}!`, roast, task.id);
    }
  }
}, 10000);

// Finish Task Action
window.finishTask = async (id) => {
  await db.collection("tasks").doc(id).update({ completed: true });
};

// Snooze Action (+5m)
window.snoozeTask = async (id, oldTime, persona) => {
  const newTime = new Date(new Date(oldTime).getTime() + 5 * 60000).toISOString();
  await db.collection("tasks").doc(id).update({ time: newTime, notified: false });

  const roastList = ROASTS[persona] || ROASTS.salim;
  const roast = roastList[Math.floor(Math.random() * roastList.length)];
  triggerPopNotification("⚠️ Snoozed +5 Mins!", roast);
};

// Service Worker Tray Message Handlers
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.action === 'done' && event.data?.taskId) {
      window.finishTask(event.data.taskId);
    }
  });
}