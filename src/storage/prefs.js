/**
 * HabitWealth prefs + history + range — localStorage wrapper with versioning
 * AUD-STORE-01: prefs/history/IDB/outbox/OPFS+fallback, persist() post-onboarding
 * Namespace: hw:*
 * Versioning: hw:prefs:v2 is canonical; migrate from v1 if found
 */

import { kvGet, kvSet, requestPersist } from "./db.js";

const LS_PREFIX = "hw:";
const PREFS_KEY_V2 = "hw:prefs:v2";
const PREFS_KEY_V1 = "hw:prefs:v1"; // legacy
const HISTORY_KEY = "hw:search:history:v1"; // max 5
const RANGE_KEY = "hw:range:v1";
const ONBOARDING_KEY = "hw:onboarding:done";

const DEFAULT_PREFS = {
  v: 2,
  theme: "system", // system | light | dark
  appearance: {
    reduceMotion: false,
    highContrast: false,
    fontScale: 100,
  },
  locale: "id-ID",
  tz: "Asia/Jakarta",
  notifications: {
    enabled: true,
    quietHours: { start: "22:00", end: "07:00" },
    categories: { habit: true, budget: true, insight: true, system: true },
  },
  privacy: {
    analyticsOptIn: false,
    consent: { dasar: false, kesehatan: false, finansial: false, version: 1 },
  },
  security: {
    maskBalance: true,
    reAuthRequired: true,
  },
  feedback: {
    haptics: true,
    sound: false, // OFF default per spec 04
  },
  installPromptDismissed: false,
};

const DEFAULT_RANGE = {
  preset: "month", // today, 7d, 30d, month, lastMonth, custom
  from: null, // YYYY-MM-DD
  to: null,
  tz: "Asia/Jakarta",
};

// in-memory cache
let prefsCache = null;

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadFromLS(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return safeParse(raw, undefined);
  } catch {
    return undefined;
  }
}

function saveToLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // quota
    console.warn("[prefs] LS quota", e);
    // try cleanup
    try {
      // remove old versions
      localStorage.removeItem(PREFS_KEY_V1);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

export async function getPrefs() {
  if (prefsCache) return prefsCache;

  // Try IDB kv first (more durable)
  try {
    const idbPrefs = await kvGet("prefs");
    if (idbPrefs && idbPrefs.v >= 2) {
      prefsCache = { ...DEFAULT_PREFS, ...idbPrefs };
      return prefsCache;
    }
  } catch {}

  // LS v2
  const v2 = loadFromLS(PREFS_KEY_V2);
  if (v2 && v2.v === 2) {
    prefsCache = { ...DEFAULT_PREFS, ...v2 };
    return prefsCache;
  }

  // Migrate v1
  const v1 = loadFromLS(PREFS_KEY_V1);
  if (v1) {
    const migrated = { ...DEFAULT_PREFS, ...v1, v: 2 };
    await setPrefs(migrated);
    try {
      localStorage.removeItem(PREFS_KEY_V1);
    } catch {}
    prefsCache = migrated;
    return migrated;
  }

  prefsCache = { ...DEFAULT_PREFS };
  return prefsCache;
}

export async function setPrefs(partialOrFull) {
  const current = prefsCache || (await getPrefs());
  const next = partialOrFull.v ? { ...DEFAULT_PREFS, ...partialOrFull } : { ...current, ...partialOrFull, v: 2 };

  prefsCache = next;
  saveToLS(PREFS_KEY_V2, next);
  try {
    await kvSet("prefs", next);
  } catch {}
  return next;
}

export async function updatePrefs(path, value) {
  // path dot notation e.g. "privacy.consent.dasar" or top-level
  const prefs = await getPrefs();
  const keys = path.split(".");
  let obj = prefs;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  return setPrefs(prefs);
}

// --- search history max 5 (spec 19) ---
export function getSearchHistory() {
  const raw = loadFromLS(HISTORY_KEY);
  if (Array.isArray(raw)) return raw.slice(0, 5);
  return [];
}

export function addSearchHistory(query) {
  if (!query || query.trim().length < 2) return getSearchHistory();
  const q = query.trim().slice(0, 100);
  let hist = getSearchHistory();
  hist = hist.filter((item) => item.toLowerCase() !== q.toLowerCase());
  hist.unshift(q);
  hist = hist.slice(0, 5);
  saveToLS(HISTORY_KEY, hist);
  // also persist to IDB for offline index
  kvSet("search_history", hist).catch(() => {});
  return hist;
}

export function removeHistoryItem(query) {
  let hist = getSearchHistory();
  hist = hist.filter((item) => item !== query);
  saveToLS(HISTORY_KEY, hist);
  kvSet("search_history", hist).catch(() => {});
  return hist;
}

export function clearSearchHistory() {
  saveToLS(HISTORY_KEY, []);
  kvSet("search_history", []).catch(() => {});
  return [];
}

// --- range single source (spec 17) ---
export function getRange() {
  const raw = loadFromLS(RANGE_KEY);
  if (raw && raw.preset) {
    return { ...DEFAULT_RANGE, ...raw };
  }
  return { ...DEFAULT_RANGE };
}

export function setRange(range) {
  const next = { ...DEFAULT_RANGE, ...range };
  saveToLS(RANGE_KEY, next);
  kvSet("range", next).catch(() => {});
  // notify via storage event + BroadcastChannel (handled in storage/index.js)
  try {
    // trigger storage event for other tabs (set + remove trick not needed — setItem triggers)
    // Also dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent("hw:range-changed", { detail: next }));
  } catch {}
  return next;
}

// --- onboarding flag + persist() ---
export function isOnboardingDone() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingDone(done = true) {
  try {
    if (done) localStorage.setItem(ONBOARDING_KEY, "1");
    else localStorage.removeItem(ONBOARDING_KEY);
  } catch {}
  if (done) {
    // request persistent storage post-onboarding (AUD-STORE-01)
    requestPersist().catch(() => {});
  }
}

export async function persistIfNeeded() {
  // called post-onboarding, also after first habit
  return requestPersist();
}

// --- helpers ---
export function getTZ() {
  try {
    const prefs = prefsCache || loadFromLS(PREFS_KEY_V2) || DEFAULT_PREFS;
    return prefs.tz || prefs.locale?.tz || DEFAULT_RANGE.tz;
  } catch {
    return DEFAULT_RANGE.tz;
  }
}
