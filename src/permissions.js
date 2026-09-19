/**
 * HabitWealth permissions — AUD-PERM-01
 * API 116: Permissions API pre-checks driving primers
 * Rule: "Later" never triggers system dialog (spec 07)
 * Stores decisions in prefs (localStorage) + IDB kv
 */

import { kvGet, kvSet } from "./storage/db.js";

const PERM_KEY = "hw:permissions:decisions:v1";

const DEFAULT_DECISIONS = {
  notifications: { state: "prompt", primerDismissed: false, lastDecision: null, lastAt: 0 },
  camera: { state: "prompt", primerDismissed: false, lastDecision: null, lastAt: 0 },
  microphone: { state: "prompt", primerDismissed: false, lastDecision: null, lastAt: 0 },
  geolocation: { state: "prompt", primerDismissed: false, lastDecision: null, lastAt: 0 },
};

let decisionsCache = null;

function loadDecisionsSync() {
  if (decisionsCache) return decisionsCache;
  try {
    const raw = localStorage.getItem(PERM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      decisionsCache = { ...DEFAULT_DECISIONS, ...parsed };
      return decisionsCache;
    }
  } catch {}
  decisionsCache = { ...DEFAULT_DECISIONS };
  return decisionsCache;
}

async function saveDecisions(decisions) {
  decisionsCache = decisions;
  try {
    localStorage.setItem(PERM_KEY, JSON.stringify(decisions));
  } catch {}
  try {
    await kvSet("permissions_decisions", decisions);
  } catch {}
}

export function isPermissionsAPISupported() {
  return !!(navigator.permissions && navigator.permissions.query);
}

export async function queryPermission(name) {
  // name: notifications, camera, microphone, geolocation, persistent-storage
  try {
    if (!isPermissionsAPISupported()) {
      return { supported: false, state: "unsupported", name };
    }
    // Safari requires specific descriptors; wrap in try
    const status = await navigator.permissions.query({ name });
    return { supported: true, state: status.state, name, raw: status };
  } catch (e) {
    // Some permissions need extra params or are unsupported
    // e.g., camera may throw in some contexts
    return { supported: false, state: "unsupported", name, error: String(e) };
  }
}

export async function queryAll() {
  const names = ["notifications", "camera", "microphone", "geolocation"];
  const out = { supported: isPermissionsAPISupported() };
  for (const n of names) {
    try {
      const res = await queryPermission(n);
      out[n] = res.state;
    } catch {
      out[n] = "unsupported";
    }
  }
  // persistent-storage separately
  try {
    if (navigator.storage && navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      out["persistent-storage"] = persisted ? "granted" : "prompt";
    }
  } catch {}
  return out;
}

// primer logic
export function getDecision(name) {
  const all = loadDecisionsSync();
  return all[name] || { state: "prompt", primerDismissed: false, lastDecision: null };
}

export async function recordPrimerDecision(name, decision) {
  // decision: "granted" | "denied" | "later" | "dismissed"
  const all = loadDecisionsSync();
  const now = Date.now();
  all[name] = {
    ...(all[name] || {}),
    lastDecision: decision,
    lastAt: now,
    primerDismissed: decision === "later" || decision === "dismissed",
    // if granted via primer, we will later trigger system dialog; keep state prompt until system confirms
    state: decision === "granted" ? "prompt" : decision === "denied" ? "denied" : "prompt",
  };
  await saveDecisions(all);
  return all[name];
}

export function shouldShowPrimer(name) {
  const dec = getDecision(name);
  // If user explicitly denied via system, don't show primer again quickly (respect)
  if (dec.state === "denied" && Date.now() - dec.lastAt < 7 * 24 * 60 * 60 * 1000) {
    // 7 days cooldown after denied
    return false;
  }
  // If user tapped Later, don't show again until next contextual moment (we reset via clearPrimerDismissal)
  if (dec.primerDismissed && dec.lastDecision === "later") {
    // allow after 24h or explicit reset
    if (Date.now() - dec.lastAt < 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

export function canTriggerSystemDialog(name) {
  // Only if user explicitly tapped "Allow" in our primer, not "Later"
  const dec = getDecision(name);
  return dec.lastDecision === "granted";
}

export function clearPrimerDismissal(name) {
  const all = loadDecisionsSync();
  if (all[name]) {
    all[name].primerDismissed = false;
    all[name].lastDecision = null;
    saveDecisions(all);
  }
}

// Notification permission request — only after primer granted
export async function requestNotificationPermission() {
  if (!canTriggerSystemDialog("notifications")) {
    console.warn("[perm] notification system dialog blocked — primer not granted");
    return { state: "prompt", blocked: true, reason: "primer-not-granted" };
  }

  try {
    if (!("Notification" in window)) {
      return { state: "unsupported" };
    }
    const result = await Notification.requestPermission();
    const all = loadDecisionsSync();
    all["notifications"] = {
      ...all["notifications"],
      state: result,
      lastDecision: result,
      lastAt: Date.now(),
      primerDismissed: false,
    };
    await saveDecisions(all);
    return { state: result };
  } catch (e) {
    return { state: "denied", error: String(e) };
  }
}

// Camera permission via getUserMedia — only after primer granted
export async function requestCameraPermission() {
  if (!canTriggerSystemDialog("camera")) {
    return { state: "prompt", blocked: true, reason: "primer-not-granted" };
  }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { state: "unsupported" };
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // stop immediately — we only wanted permission
    stream.getTracks().forEach((t) => t.stop());
    const all = loadDecisionsSync();
    all["camera"] = { ...all["camera"], state: "granted", lastDecision: "granted", lastAt: Date.now() };
    await saveDecisions(all);
    return { state: "granted" };
  } catch (e) {
    const denied = e.name === "NotAllowedError" || e.name === "PermissionDeniedError";
    const all = loadDecisionsSync();
    all["camera"] = {
      ...all["camera"],
      state: denied ? "denied" : "prompt",
      lastDecision: denied ? "denied" : "prompt",
      lastAt: Date.now(),
    };
    await saveDecisions(all);
    return { state: denied ? "denied" : "prompt", error: String(e) };
  }
}

// Generic helper for permission-gated features
export async function withPermissionCheck(name, fn) {
  const q = await queryPermission(name);
  if (q.state === "granted") {
    return fn();
  }
  if (q.state === "denied") {
    throw new Error(`Permission ${name} denied`);
  }
  // prompt state — should show primer first
  if (!shouldShowPrimer(name)) {
    throw new Error(`Primer dismissed for ${name}`);
  }
  // Caller should show primer UI, then if user grants primer, call canTriggerSystemDialog and actual request
  return { needsPrimer: true, currentState: q.state };
}

export const permissions = {
  isPermissionsAPISupported,
  queryPermission,
  queryAll,
  getDecision,
  recordPrimerDecision,
  shouldShowPrimer,
  canTriggerSystemDialog,
  clearPrimerDismissal,
  requestNotificationPermission,
  requestCameraPermission,
  withPermissionCheck,
};
