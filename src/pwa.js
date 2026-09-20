/**
 * HabitWealth PWA — AUD-PWA-01 + T15
 * APIs 61,62,66,69,70,90,172: Service Worker, Background Sync (progressive), Manifest, Navigation Preload, Clients, Launch Handler, Online/Offline events
 * - Install prompt delayed until after first habit (post-first-habit sheet)
 * - Offline banner + outbox flush
 * - Update flow: skipWaiting only after user tap "Muat versi baru"
 * - iOS manual instruction
 */

import { isOnboardingDone } from "./storage/prefs.js";
import { track } from "./analytics.js";
import { openSheet } from "./ui.js";

let deferredPrompt = null;
let installSheetShown = false;
let installTracked = false;

export function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

export function isIOS() {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  } catch {
    return false;
  }
}

// Init PWA install prompt handling
let inited = false;
export function initPWAInstall() {
  if (inited) return; // idempoten: listener window hanya sekali
  inited = true;
  // beforeinstallprompt — tunda sampai first habit
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // console.debug("[pwa] beforeinstallprompt captured");

    // Only show sheet if onboarding done + first habit completed
    try {
      const firstHabitDone = localStorage.getItem("hw:first-habit:done") === "1";
      const dismissed = localStorage.getItem("hw:pwa:install-dismissed") === "1";
      if (firstHabitDone && !dismissed && !isStandalone()) {
        // Delay 2s after first habit
        setTimeout(() => showInstallSheet(), 2000);
      }
    } catch {}
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallSheet();
    // source: "prompt" sudah dicatat di handler Pasang; di sini hanya install manual (menu browser) — tanpa duplikat
    if (!installTracked) track("pwa_installed", { source: "manual" }).catch(() => {});
    installTracked = true;
    try {
      localStorage.setItem("hw:pwa:installed", "1");
    } catch {}
  });

  // iOS: if not standalone and iOS, show manual instruction after first habit
  if (isIOS() && !isStandalone()) {
    try {
      const firstHabitDone = localStorage.getItem("hw:first-habit:done") === "1";
      if (firstHabitDone) {
        setTimeout(() => showIOSInstallInstruction(), 2000);
      }
    } catch {}
  }
}

let installApi = null;

/**
 * Sheet "Pasang HabitWealth?" (spec 15): hanya setelah first habit, via ui.js openSheet (scrim + focus trap + Esc + drag,
 * fokus kembali ke pemicu, reduced-motion fade). Sebelumnya sheet manual tanpa focus trap.
 */
export function showInstallSheet() {
  if (installSheetShown || isStandalone()) return null;
  installSheetShown = true;
  let decided = false;
  const dismiss = () => {
    if (decided) return;
    decided = true;
    try {
      localStorage.setItem("hw:pwa:install-dismissed", "1");
    } catch {}
    track("pwa_dismissed", {}).catch(() => {});
  };
  installApi = openSheet({
    id: "pwa-install-sheet",
    title: "Pasang HabitWealth?",
    desc: "Akses lebih cepat, tetap bisa dipakai offline. Tidak pakai kuota besar.",
    actions: [
      { label: "Nanti", kind: "secondary", onClick: dismiss },
      {
        label: "Pasang",
        kind: "primary",
        autofocus: true,
        onClick: async () => {
          decided = true;
          if (deferredPrompt) {
            try {
              deferredPrompt.prompt();
              const choice = await deferredPrompt.userChoice;
              if (choice && choice.outcome === "accepted") {
                installTracked = true;
                track("pwa_installed", { source: "prompt" }).catch(() => {});
              } else {
                track("pwa_dismissed", {}).catch(() => {});
              }
            } catch {}
            deferredPrompt = null;
          }
        },
      },
    ],
    onClose: (reason) => {
      installSheetShown = false;
      installApi = null;
      if (reason !== "action") dismiss(); // scrim/Esc/drag = "Nanti"
    },
  });
  if (!installApi) installSheetShown = false;
  return installApi;
}

export function hideInstallSheet() {
  if (installApi) installApi.close("hide");
  installSheetShown = false;
}

export function showIOSInstallInstruction() {
  if (isStandalone()) return null;
  return openSheet({
    id: "pwa-ios-sheet",
    title: "Pasang di iPhone",
    build: (body) => {
      const p = document.createElement("p");
      p.className = "sheet-desc";
      p.append(document.createTextNode("Tap tombol Bagikan "));
      const ic = document.createElement("span");
      ic.setAttribute("aria-hidden", "true");
      ic.textContent = "⎙";
      p.appendChild(ic);
      p.append(document.createTextNode(" di Safari, lalu pilih “Add to Home Screen”."));
      body.appendChild(p);
    },
    actions: [{ label: "Mengerti", kind: "primary", autofocus: true }],
  });
}

// Offline banner
let offlineBanner = null;

export function initOfflineBanner() {
  function showOffline() {
    if (offlineBanner) return;
    offlineBanner = document.createElement("div");
    offlineBanner.className = "offline-banner";
    offlineBanner.setAttribute("role", "status");
    offlineBanner.setAttribute("aria-live", "polite");
    const icon = document.createElement("span");
    icon.className = "offline-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◍";
    const text = document.createElement("span");
    text.textContent = "Kamu offline — perubahan disimpan, terkirim otomatis";
    offlineBanner.append(icon, text);
    document.body.appendChild(offlineBanner);
    // Also trigger outbox flush check when back online
  }

  function hideOffline() {
    if (offlineBanner) {
      offlineBanner.remove();
      offlineBanner = null;
    }
  }

  window.addEventListener("online", hideOffline);
  window.addEventListener("offline", showOffline);

  if (!navigator.onLine) showOffline();

  return { showOffline, hideOffline };
}

// SW update flow — registerType: prompt, so we need to handle update prompt
export function initSWUpdatePrompt() {
  // vite-plugin-pwa exposes virtual module, but we can also listen to SW events via navigator.serviceWorker
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // Listen for message from SW about update available
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      // SW is waiting to activate
      showUpdatePrompt();
    }
  });

  // For vite-plugin-pwa with registerType prompt, we need to use the registerSW.js logic
  // We'll also poll for update via SW registration
  navigator.serviceWorker.ready.then((reg) => {
    // Check for waiting SW
    if (reg.waiting) {
      showUpdatePrompt(reg);
    }

    // Periodic check (15 min) — spec says update only on user tap, but we can check in background
    setInterval(() => {
      reg.update().catch(() => {});
    }, 15 * 60 * 1000);
  });
}

export function showUpdatePrompt(reg) {
  let promptEl = document.getElementById("pwa-update-prompt");
  if (promptEl) return;

  promptEl = document.createElement("div");
  promptEl.id = "pwa-update-prompt";
  promptEl.className = "update-prompt";
  promptEl.setAttribute("role", "alert");
  const content = document.createElement("div");
  content.className = "update-content";
  const label = document.createElement("span");
  label.textContent = "Versi baru tersedia";
  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.className = "btn btn-primary btn-small";
  updateBtn.dataset.action = "update";
  updateBtn.textContent = "Muat versi baru";
  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "btn btn-flat btn-small";
  dismissBtn.dataset.action = "dismiss";
  dismissBtn.textContent = "Nanti";
  content.append(label, updateBtn, dismissBtn);
  promptEl.appendChild(content);
  document.body.appendChild(promptEl);

  // Spec 15: versi baru hanya dimuat saat user tap (SKIP_WAITING → controllerchange → reload sekali)
  updateBtn.addEventListener("click", () => {
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
    promptEl.remove();
  });
  dismissBtn.addEventListener("click", () => promptEl.remove());
  return promptEl;
}

// Mark first habit done — triggers install prompt logic
export function markFirstHabitDone() {
  try {
    localStorage.setItem("hw:first-habit:done", "1");
    // If deferredPrompt exists, show sheet now
    if (deferredPrompt && !isStandalone()) {
      setTimeout(() => showInstallSheet(), 1000);
    } else if (isIOS() && !isStandalone()) {
      setTimeout(() => showIOSInstallInstruction(), 1000);
    }
  } catch {}
}

export const pwaHelpers = {
  isStandalone,
  isIOS,
  initPWAInstall,
  showInstallSheet,
  hideInstallSheet,
  showIOSInstallInstruction,
  initOfflineBanner,
  initSWUpdatePrompt,
  markFirstHabitDone,
};
