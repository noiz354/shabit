/**
 * HabitWealth analytics — AUD-ANAL-01
 * APIs 60,179: Beacon + Page Visibility
 * - Redacted queue, no PII in payloads
 * - Offline queue flush via Beacon on pagehide/unload
 * - Event dictionary from specs/05-analytics.md
 */

import { idbPut, idbGetAll, idbDel, getDB } from "./storage/db.js";
import { hashId } from "./crypto.js";

const STORE = "analytics_queue";
const ALLOWED_EVENTS = new Set([
  "signup_completed",
  "onboarding_completed",
  "habit_completed",
  "habit_skipped_day",
  "transaction_created",
  "category_corrected",
  "budget_threshold_hit",
  "connection_started",
  "connection_completed",
  "connection_failed",
  "sync_failed",
  "sync_recovered",
  "notification_opened",
  "notification_dismissed",
  "export_requested",
  "deletion_requested",
  "paywall_shown",
  "paywall_dismissed",
  // extended from specs 17,19
  "range_changed",
  "range_custom_applied",
  "range_empty_shown",
  "search_opened",
  "search_executed",
  "search_result_opened",
  "search_history_cleared",
  "permission_granted",
  "permission_denied",
  // T11 (spec 05 amandemen 19 Sep 2026) — tanpa nominal/judul habit
  "insight_viewed",
  "goal_created",
  "goal_completed",
  "goal_withdrawn",
  "celebration_shared",
  "celebration_dismissed",
]);

const MAX_QUEUE = 100;
const FLUSH_INTERVAL = 30 * 1000; // 30s
let flushTimer = null;
let isOptIn = false;

function nowISO() {
  return new Date().toISOString();
}

// redaction — ensure no raw PII
function redactProps(eventName, props = {}) {
  const out = { ...props };
  // Never allow these keys
  const forbidden = ["email", "password", "token", "amount", "note", "title", "description", "phone", "account", "q", "query", "name"];
  for (const k of Object.keys(out)) {
    const low = k.toLowerCase();
    if (forbidden.some((f) => low.includes(f))) {
      // special handling: for some events we allow hashed versions
      if (low.includes("habit_id") || low.includes("transaction_id")) {
        // keep hash
        continue;
      }
      if (k === "char_len" || k === "result_count" || k === "scope" || k === "category" || k === "preset" || k === "days" || k === "module" || k === "method" || k === "day" || k === "time_of_day" || k === "streak_day" || k === "has_note" || k === "kind" || k === "pct" || k === "month" || k === "error_code" || k === "deep_link" || k === "source_type" || k === "retry_count" || k === "offline" || k === "char_len") {
        continue;
      }
      // otherwise redact
      if (eventName.startsWith("search_") && k === "q") {
        delete out[k];
        continue;
      }
      // hash if it's an id
      if (low.endsWith("_id") || low.endsWith("_hash")) {
        // assume already hashed or will be hashed
        continue;
      }
      delete out[k];
    }
  }

  // Ensure no raw query in search events
  if (eventName.startsWith("search_")) {
    delete out.q;
    delete out.query;
    delete out.text;
  }

  // Ensure no raw amount
  delete out.amount;
  delete out.nominal;

  return out;
}

async function enqueueEvent(eventName, props) {
  if (!ALLOWED_EVENTS.has(eventName)) {
    console.warn(`[analytics] event not in allowlist: ${eventName}`);
    return false;
  }

  const redacted = redactProps(eventName, props);
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event: eventName,
    props: redacted,
    ts: nowISO(),
    createdAt: Date.now(),
    sent: false,
  };

  try {
    await idbPut(STORE, entry);
    // also keep in-memory for quick flush
    // enforce max
    const all = await idbGetAll(STORE, null, undefined, 1000);
    if (all.length > MAX_QUEUE) {
      const sorted = all.sort((a, b) => a.createdAt - b.createdAt);
      const toDel = sorted.slice(0, all.length - MAX_QUEUE);
      for (const item of toDel) {
        await idbDel(STORE, item.id);
      }
    }
    return true;
  } catch (e) {
    console.warn("[analytics] enqueue failed", e);
    // fallback to localStorage queue
    try {
      const key = "hw:analytics:fallback";
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      if (arr.length > 20) arr.shift();
      localStorage.setItem(key, JSON.stringify(arr));
    } catch {}
    return false;
  }
}

export async function track(eventName, props = {}) {
  if (!isOptIn) {
    // still queue if it's essential? For MVP, only queue if opt-in or it's not PII and user consented? We'll queue but not flush unless opt-in
    // For now, respect opt-in: if not opted in, only track anonymized essential events (onboarding, habit)
    const essential = ["signup_completed", "onboarding_completed", "habit_completed", "range_changed", "search_opened"];
    if (!essential.includes(eventName)) {
      // console.debug(`[analytics] skip ${eventName} — not opted in`);
      return false;
    }
  }

  // hash ids if present
  const toHash = ["habit_id", "transaction_id", "budget_id"];
  const propsHashed = { ...props };
  for (const k of toHash) {
    if (propsHashed[k] && typeof propsHashed[k] === "string" && !propsHashed[k].includes("_hash")) {
      try {
        const hashed = await hashId(propsHashed[k]);
        propsHashed[`${k}_hash`] = hashed;
        delete propsHashed[k];
      } catch {}
    }
  }

  return enqueueEvent(eventName, propsHashed);
}

async function flushViaFetch() {
  try {
    const all = await idbGetAll(STORE, null, undefined, 100);
    const pending = all.filter((e) => !e.sent).slice(0, 20);
    if (pending.length === 0) return { sent: 0 };

    // In MVP, no backend analytics endpoint yet (vendor OPEN). So we just mark as sent if opt-in false?
    // For now, try POST to /api/v1/analytics if exists, else keep queue for future.
    // We'll attempt fetch but don't fail if 404 — just keep queue.
    try {
      const res = await fetch("/api/v1/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ events: pending.map((p) => ({ event: p.event, props: p.props, ts: p.ts })) }),
      });
      if (res.ok) {
        for (const item of pending) {
          await idbDel(STORE, item.id);
        }
        return { sent: pending.length };
      } else if (res.status === 404) {
        // no endpoint yet — keep queue but don't spam
        return { sent: 0, noEndpoint: true };
      }
    } catch (e) {
      // network error — keep queue
      return { sent: 0, error: String(e) };
    }

    return { sent: 0 };
  } catch (e) {
    console.warn("[analytics] flushViaFetch failed", e);
    return { sent: 0, error: String(e) };
  }
}

async function flushViaBeacon() {
  try {
    const all = await idbGetAll(STORE, null, undefined, 50);
    const pending = all.filter((e) => !e.sent).slice(0, 20);
    if (pending.length === 0) return true;

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events: pending.map((p) => ({ event: p.event, props: p.props, ts: p.ts })) })], {
        type: "application/json",
      });
      const ok = navigator.sendBeacon("/api/v1/analytics", blob);
      if (ok) {
        // We can't know if server got it, but we mark sent and will clean on next successful fetch
        // For beacon, we keep queue and let next fetch clear it
        // Alternatively, delete if beacon succeeded (optimistic)
        // We'll keep for now to avoid data loss, but mark sent=true
        for (const item of pending) {
          item.sent = true;
          await idbPut(STORE, item);
        }
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn("[analytics] beacon failed", e);
    return false;
  }
}

export function initAnalytics(options = {}) {
  const { optIn = false } = options;
  isOptIn = optIn;

  // load opt-in from prefs if available
  try {
    const raw = localStorage.getItem("hw:prefs:v2");
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs.privacy && typeof prefs.privacy.analyticsOptIn === "boolean") {
        isOptIn = prefs.privacy.analyticsOptIn;
      }
    }
  } catch {}

  // pagehide + visibilitychange flush (ID 60, 179)
  const handleHide = () => {
    flushViaBeacon().catch(() => {});
  };

  window.addEventListener("pagehide", handleHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      handleHide();
    }
  });

  // periodic flush
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      flushViaFetch().catch(() => {});
    }
  }, FLUSH_INTERVAL);

  // initial flush attempt
  if (navigator.onLine) {
    setTimeout(() => flushViaFetch().catch(() => {}), 2000);
  }

  return {
    track,
    flush: flushViaFetch,
    setOptIn: (v) => {
      isOptIn = !!v;
    },
  };
}

export const analytics = {
  track,
  init: initAnalytics,
  flush: flushViaFetch,
  flushBeacon: flushViaBeacon,
};
