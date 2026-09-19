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

// Wave 0 — Foundation (AUD-STORE-01, AUD-ROUTER-01, AUD-CRYPTO-01, AUD-PERM-01, AUD-ANAL-01)
// Init storage + analytics + permissions + router

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
    // console.debug("[main] storage ready");
  } catch (e) {
    console.warn("[main] storage init failed", e);
  }

  // 2. Analytics (redacted queue + Beacon/pagehide)
  try {
    initAnalytics({ optIn: false }); // opt-in checked inside
  } catch (e) {
    console.warn("[main] analytics init failed", e);
  }

  // 3. Permissions pre-check (no system dialog triggered here)
  try {
    const perms = await queryPermissions();
    // expose for debugging, not for UI yet
    window.__HW_PERMS__ = perms;
  } catch (e) {
    console.warn("[main] permissions query failed", e);
  }

  // 4. Capabilities detect (existing)
  try {
    if (window.HWCapabilities && window.HWCapabilities.detect) {
      const caps = await window.HWCapabilities.detect();
      window.__HW_CAPS__ = caps;
    }
  } catch {}

  // 5. Router (hash + param restore + URLPattern + back restores range/search)
  try {
    initRouter(root);
  } catch (e) {
    console.error("[main] router init failed", e);
    // fallback simple
    root.innerHTML = "<div class='page'><header class='viewing-area'><h1>HabitWealth</h1></header><div class='interaction-area'><p class='placeholder'>Gagal memuat router.</p></div></div>";
  }

  // 6. Expose storage for CDP verification (audit requirement)
  try {
    window.HWStorage = {
      getDB,
      store,
    };
  } catch {}
}

bootstrap();
