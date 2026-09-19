import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import "../assets/css/motion.css";
import "../assets/js/capabilities.js"; // single source; window.HWCapabilities
import { initRouter } from "./router.js";
import { store } from "./store.js";
import { initAnalytics } from "./analytics.js";
import { queryAll as queryPermissions } from "./permissions.js";
import { getDB } from "./storage/db.js";
import { initTheme, syncAppearanceFromPrefs } from "./theme.js";
import { initSync } from "./sync.js";
import { initPWAInstall, initOfflineBanner, initSWUpdatePrompt } from "./pwa.js";

// Wave 0 — Foundation (AUD-STORE-01, AUD-ROUTER-01, AUD-CRYPTO-01, AUD-PERM-01, AUD-ANAL-01)
// Wave 1 — Shell, motion, PWA (AUD-PWA-01, MOTION-01, GEST-01, KBD-01, THEME-01, SYNC-01) + T3/T4/T15
// Init storage + analytics + permissions + theme + sync + PWA + router

async function bootstrap() {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[main] #app not found");
    return;
  }

  render(null, root);

  // 1. Storage (IDB versioned + persist post-onboarding)
  try {
    await store.init();
  } catch (e) {
    console.warn("[main] storage init failed", e);
  }

  // 2. Theme — runtime theme + font-ready gate (AUD-THEME-01)
  try {
    await initTheme();
    await syncAppearanceFromPrefs();
  } catch (e) {
    console.warn("[main] theme init failed", e);
  }

  // 3. Sync — multi-tab safe (AUD-SYNC-01)
  try {
    initSync();
  } catch (e) {
    console.warn("[main] sync init failed", e);
  }

  // 4. Analytics (redacted queue + Beacon/pagehide)
  try {
    initAnalytics({ optIn: false });
  } catch (e) {
    console.warn("[main] analytics init failed", e);
  }

  // 5. Permissions pre-check (no system dialog)
  try {
    const perms = await queryPermissions();
    window.__HW_PERMS__ = perms;
  } catch (e) {
    console.warn("[main] permissions query failed", e);
  }

  // 6. PWA — install prompt + offline banner + SW update (AUD-PWA-01 + T15)
  try {
    initPWAInstall();
    initOfflineBanner();
    initSWUpdatePrompt();
  } catch (e) {
    console.warn("[main] PWA init failed", e);
  }

  // 7. Capabilities detect
  try {
    if (window.HWCapabilities && window.HWCapabilities.detect) {
      const caps = await window.HWCapabilities.detect();
      window.__HW_CAPS__ = caps;
    }
  } catch {}

  // 8. Router (hash + param restore + URLPattern + back restores range/search)
  try {
    initRouter(root);
  } catch (e) {
    console.error("[main] router init failed", e);
    root.innerHTML = "<div class='page'><header class='viewing-area'><h1>HabitWealth</h1></header><div class='interaction-area'><p class='placeholder'>Gagal memuat router.</p></div></div>";
  }

  // 9. Expose for CDP verification (audit)
  try {
    window.HWStorage = { getDB, store };
    window.HWTheme = { initTheme };
  } catch {}
}

bootstrap();
