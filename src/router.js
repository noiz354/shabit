/**
 * HabitWealth router — AUD-ROUTER-01
 * Hash router + param restore + SW URLPattern + back restores range/search
 * - Hash-based (no Apache rewrite needed)
 * - Preserves range {preset, from, to, tz} in hash query
 * - Preserves search q, sort, etc.
 * - Uses URLPattern if available (ID 197), fallback regex
 * - Deep-link mapping: habitwealth:// -> #/
 * - BroadcastChannel + storage event for multi-tab range sync
 */

import Navigo from "navigo";
import { Beranda, Habit, Uang, Pengaturan, NotFound } from "./views.jsx";
import { getRange, setRange } from "./storage/prefs.js";
import { subscribeRange } from "./storage/index.js";

const ROUTES = {
  "/beranda": Beranda,
  "/habit": Habit,
  "/habit/:id": Habit,
  "/uang": Uang,
  "/uang/:id": Uang,
  "/pengaturan": Pengaturan,
  "/pengaturan/:sub": Pengaturan,
};

const DEEP_LINK_MAP = {
  "habitwealth://habit/complete": "#/habit",
  "habitwealth://money/alert": "#/uang",
  "habitwealth://saving/withdraw": "#/uang",
  "habitwealth://settings/notifications": "#/pengaturan/notifikasi",
  "habitwealth://referral": "#/beranda",
};

// URLPattern support (ID 197)
let urlPatternSupported = false;
try {
  urlPatternSupported = typeof URLPattern !== "undefined";
} catch {
  urlPatternSupported = false;
}

function parseHash(hash = location.hash) {
  // hash like "#/uang?from=2026-09-01&to=2026-09-30&preset=month&q=kopi"
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathPart, queryString] = raw.split("?");
  const path = pathPart || "/beranda";
  const params = new URLSearchParams(queryString || "");
  const query = {};
  for (const [k, v] of params.entries()) {
    query[k] = v;
  }
  return { path, query, raw };
}

function buildHash(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined && v !== "") {
      qs.set(k, String(v));
    }
  }
  const qStr = qs.toString();
  return `#${path}${qStr ? `?${qStr}` : ""}`;
}

function getRangeFromHash() {
  const { query } = parseHash();
  const { from, to, preset, tz } = query;
  if (from || to || preset) {
    return {
      preset: preset || "month",
      from: from || null,
      to: to || null,
      tz: tz || "Asia/Jakarta",
    };
  }
  return null;
}

function getSearchFromHash() {
  const { query } = parseHash();
  return {
    q: query.q || "",
    sort: query.sort || "",
    order: query.order || "",
    cat: query.cat || "",
  };
}

function matchRoute(path) {
  // Try URLPattern first
  if (urlPatternSupported) {
    for (const pattern of Object.keys(ROUTES)) {
      try {
        const p = new URLPattern({ pathname: pattern });
        const m = p.exec({ pathname: path });
        if (m) {
          return { pattern, params: m.pathname.groups || {} };
        }
      } catch {}
    }
  }
  // Fallback regex: simple :id matching
  for (const pattern of Object.keys(ROUTES)) {
    const regexStr = pattern.replace(/:[^/]+/g, "([^/]+)").replace(/\//g, "\\/");
    const regex = new RegExp(`^${regexStr}$`);
    const match = path.match(regex);
    if (match) {
      const keys = [...pattern.matchAll(/:([^/]+)/g)].map((m) => m[1]);
      const params = {};
      keys.forEach((k, i) => (params[k] = match[i + 1]));
      return { pattern, params };
    }
  }
  return null;
}

function applyRangeFromURL() {
  const rangeFromHash = getRangeFromHash();
  if (rangeFromHash) {
    setRange(rangeFromHash);
  }
}

function syncRangeToURL() {
  const range = getRange();
  const { path, query } = parseHash();
  // Only sync if range is not default? Actually always sync to preserve back/forward
  const nextQuery = { ...query };
  if (range.preset) nextQuery.preset = range.preset;
  if (range.from) nextQuery.from = range.from;
  if (range.to) nextQuery.to = range.to;
  if (range.tz && range.tz !== "Asia/Jakarta") nextQuery.tz = range.tz;

  const newHash = buildHash(path, nextQuery);
  if (newHash !== location.hash) {
    // Use replaceState to avoid pushing history for range sync? But spec says back restores range, so we need push when user changes range.
    // We'll use a custom event to decide: if triggered by user action, push; if by initial load, replace.
    // For now, replace to avoid loop, actual push is done via navigateWithRange
    history.replaceState(null, "", newHash);
  }
}

export function navigateWithRange(path, range, extraQuery = {}) {
  const current = parseHash();
  const r = range || getRange();
  const q = { ...current.query, ...extraQuery };
  if (r.preset) q.preset = r.preset;
  if (r.from) q.from = r.from;
  if (r.to) q.to = r.to;
  if (r.tz && r.tz !== "Asia/Jakarta") q.tz = r.tz;
  const hash = buildHash(path, q);
  location.hash = hash;
}

export function navigate(path, query = {}, opts = {}) {
  const { replace = false } = opts;
  const hash = buildHash(path, query);
  if (replace) {
    history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = hash;
  }
}

function handleDeepLink(url) {
  // url like "habitwealth://habit/complete?id=123"
  for (const [scheme, target] of Object.entries(DEEP_LINK_MAP)) {
    if (url.startsWith(scheme)) {
      try {
        const u = new URL(url);
        const id = u.searchParams.get("id") || u.searchParams.get("code");
        const hash = id ? `${target}/${id}` : target;
        location.hash = hash;
        return true;
      } catch {
        location.hash = target;
        return true;
      }
    }
  }
  return false;
}

export function initRouter(root) {
  const router = new Navigo("/", { hash: true });

  // Register routes
  Object.entries(ROUTES).forEach(([path, View]) => {
    router.on(path, (match) => {
      root.innerHTML = "";
      // Restore range from URL before rendering
      applyRangeFromURL();
      // Pass params to view
      const params = match?.data || {};
      const { query } = parseHash();
      View(root, { params, query });
    });
  });

  router.notFound(() => {
    root.innerHTML = "";
    NotFound(root);
  });

  router.on(() => {
    // default
    if (!location.hash || location.hash === "#/" || location.hash === "#") {
      router.navigate("/beranda");
    }
  });

  // Listen hashchange for range/search restore (back/forward)
  window.addEventListener("hashchange", () => {
    const rangeFromHash = getRangeFromHash();
    if (rangeFromHash) {
      setRange(rangeFromHash);
    }
    // Announce to analytics? Will be handled in analytics module if needed
  });

  // Subscribe to range changes from storage (multi-tab sync)
  subscribeRange((newRange) => {
    // When range changes in same tab via prefs.setRange, sync to URL
    const { path, query } = parseHash();
    const hasRangeInURL = query.from || query.to || query.preset;
    if (hasRangeInURL) {
      // Update URL to reflect new range (push for user action)
      const nextQuery = { ...query, preset: newRange.preset, from: newRange.from || undefined, to: newRange.to || undefined, tz: newRange.tz };
      // clean undefined
      Object.keys(nextQuery).forEach((k) => nextQuery[k] === undefined && delete nextQuery[k]);
      const newHash = buildHash(path, nextQuery);
      if (newHash !== location.hash) {
        // Use pushState? For simplicity, replace to avoid infinite loop, but we also broadcast
        // Actual push should be done by caller via navigateWithRange
        // Here we just sync if changed from other tab
        if (document.hasFocus && !document.hasFocus()) {
          // other tab changed — replace
          history.replaceState(null, "", newHash);
        }
      }
    }
    // Notify tabs via BroadcastChannel
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("habitwealth-v1");
        bc.postMessage({ type: "range:changed", range: newRange });
        bc.close();
      }
    } catch {}
  });

  // Handle deep-links from query param ?deep=habitwealth://...
  try {
    const urlParams = new URLSearchParams(location.search);
    const deep = urlParams.get("deep") || urlParams.get("link");
    if (deep && deep.startsWith("habitwealth://")) {
      handleDeepLink(deep);
    }
  } catch {}

  // Initial range sync
  applyRangeFromURL();

  router.resolve();

  // Expose helpers for testing / other modules
  router.hw = {
    parseHash,
    buildHash,
    getRangeFromHash,
    getSearchFromHash,
    navigate,
    navigateWithRange,
    matchRoute,
    handleDeepLink,
    urlPatternSupported,
  };

  return router;
}

// For non-Navigo usage (e.g., SW URLPattern matching)
export function matchWithURLPattern(url, pattern) {
  if (urlPatternSupported) {
    try {
      const p = new URLPattern(pattern);
      return p.test(url);
    } catch {
      return false;
    }
  }
  // fallback: simple string includes
  if (typeof pattern === "string") {
    return url.includes(pattern);
  }
  if (pattern instanceof RegExp) {
    return pattern.test(url);
  }
  return false;
}
