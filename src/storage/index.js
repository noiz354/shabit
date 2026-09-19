/**
 * HabitWealth storage facade — AUD-STORE-01 + AUD-SYNC-01
 * Single entry for all storage: db, prefs, outbox, opfs
 * Also sets up BroadcastChannel sync for multi-tab
 */

import { getDB, requestPersist, estimateStorage, closeDB } from "./db.js";
import * as prefs from "./prefs.js";
import * as outbox from "./outbox.js";
import * as opfs from "./opfs.js";

export const storage = {
  db: { getDB, requestPersist, estimateStorage, closeDB },
  prefs,
  outbox,
  opfs,
};

// init called from main.jsx scaffold
export async function initStorage() {
  try {
    await getDB();
  } catch (e) {
    console.warn("[storage] IDB open failed, using LS fallback", e);
  }

  // setup multi-tab sync channel
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("habitwealth-v1");
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || !msg.type) return;
        // range sync
        if (msg.type === "range:changed") {
          // dispatch to same-tab listeners
          window.dispatchEvent(new CustomEvent("hw:range-changed", { detail: msg.range }));
        }
        // prefs sync could be added
      };
    }
  } catch {}

  // storage event fallback for range (other tabs)
  window.addEventListener("storage", (e) => {
    if (e.key === "hw:range:v1" && e.newValue) {
      try {
        const range = JSON.parse(e.newValue);
        window.dispatchEvent(new CustomEvent("hw:range-changed", { detail: range }));
      } catch {}
    }
  });

  // request persist if onboarding already done (AUD-STORE-01)
  try {
    if (prefs.isOnboardingDone()) {
      requestPersist().catch(() => {});
    }
  } catch {}

  return true;
}

// convenience: single source range with subscription
export function subscribeRange(cb) {
  const handler = (ev) => cb(ev.detail);
  window.addEventListener("hw:range-changed", handler);
  return () => window.removeEventListener("hw:range-changed", handler);
}

export async function getFullState() {
  const [p, range, outboxItems, est] = await Promise.all([
    prefs.getPrefs(),
    Promise.resolve(prefs.getRange()),
    outbox.listOutbox().catch(() => []),
    estimateStorage().catch(() => ({})),
  ]);
  return { prefs: p, range, outbox: outboxItems, estimate: est };
}
