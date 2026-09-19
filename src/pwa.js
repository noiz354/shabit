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

let deferredPrompt = null;
let installSheetShown = false;

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
export function initPWAInstall() {
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
    // console.debug("[pwa] appinstalled");
    deferredPrompt = null;
    hideInstallSheet();
    track("pwa_installed", { source: "prompt" }).catch(() => {});
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

function createSheetElement(id, innerHTML) {
  let sheet = document.getElementById(id);
  if (sheet) return sheet;

  sheet = document.createElement("div");
  sheet.id = id;
  sheet.className = "pwa-sheet sheet-bottom";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = innerHTML;
  document.body.appendChild(sheet);

  // scrim
  let scrim = document.getElementById(`${id}-scrim`);
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.id = `${id}-scrim`;
    scrim.className = "scrim";
    scrim.addEventListener("click", () => hideInstallSheet());
    document.body.appendChild(scrim);
  }

  return sheet;
}

export function showInstallSheet() {
  if (installSheetShown || isStandalone()) return;
  installSheetShown = true;

  const sheet = createSheetElement(
    "pwa-install-sheet",
    `
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Pasang HabitWealth?</h2>
      <p class="sheet-desc">Akses lebih cepat, tetap bisa dipakai offline. Tidak pakai kuota besar.</p>
      <div class="sheet-actions">
        <button class="btn btn-secondary" data-action="dismiss">Nanti</button>
        <button class="btn btn-primary" data-action="install">Pasang</button>
      </div>
    </div>
  `
  );

  sheet.classList.add("open");
  sheet.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
    hideInstallSheet();
    try {
      localStorage.setItem("hw:pwa:install-dismissed", "1");
    } catch {}
    track("pwa_dismissed", {}).catch(() => {});
  });
  sheet.querySelector('[data-action="install"]')?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // console.debug("[pwa] userChoice", choice);
      if (choice.outcome === "accepted") {
        track("pwa_installed", { source: "prompt" }).catch(() => {});
      } else {
        track("pwa_dismissed", {}).catch(() => {});
      }
      deferredPrompt = null;
    }
    hideInstallSheet();
  });

  // Focus trap
  const firstBtn = sheet.querySelector("button");
  if (firstBtn) firstBtn.focus();
}

export function hideInstallSheet() {
  const sheet = document.getElementById("pwa-install-sheet");
  const scrim = document.getElementById("pwa-install-sheet-scrim");
  if (sheet) {
    sheet.classList.add("exiting");
    setTimeout(() => {
      sheet.classList.remove("open", "exiting");
      sheet.remove();
    }, 300);
  }
  if (scrim) {
    scrim.remove();
  }
  installSheetShown = false;
}

export function showIOSInstallInstruction() {
  if (isStandalone()) return;
  const sheet = createSheetElement(
    "pwa-ios-sheet",
    `
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Pasang di iPhone</h2>
      <p class="sheet-desc">Tap tombol Bagikan <span aria-hidden="true">⎙</span> di Safari, lalu pilih "Add to Home Screen".</p>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="close">Mengerti</button>
      </div>
    </div>
  `
  );
  sheet.classList.add("open");
  sheet.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    sheet.remove();
    document.getElementById("pwa-ios-sheet-scrim")?.remove();
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
    offlineBanner.innerHTML = `
      <span class="offline-icon" aria-hidden="true">◍</span>
      <span>Kamu offline — perubahan disimpan, terkirim otomatis</span>
    `;
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

function showUpdatePrompt(reg) {
  let promptEl = document.getElementById("pwa-update-prompt");
  if (promptEl) return;

  promptEl = document.createElement("div");
  promptEl.id = "pwa-update-prompt";
  promptEl.className = "update-prompt";
  promptEl.setAttribute("role", "alert");
  promptEl.innerHTML = `
    <div class="update-content">
      <span>Versi baru tersedia</span>
      <button class="btn btn-primary btn-small" data-action="update">Muat versi baru</button>
      <button class="btn btn-flat btn-small" data-action="dismiss">Nanti</button>
    </div>
  `;
  document.body.appendChild(promptEl);

  promptEl.querySelector('[data-action="update"]')?.addEventListener("click", async () => {
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      // fallback: reload
      window.location.reload();
    }
    promptEl.remove();
  });
  promptEl.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
    promptEl.remove();
  });
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
