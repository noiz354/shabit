/**
 * HabitWealth multi-tab safe sync — AUD-SYNC-01
 * APIs 58,129: BroadcastChannel, Web Locks
 * - Single-tab → multi-tab safe sync
 * - Outbox single-send race prevention via Web Locks
 * - Prefs/range sync via BroadcastChannel + storage event fallback
 * - Verify: two-tab single-send race test
 */

import { getDB } from "./storage/db.js";

const BC_NAME = "habitwealth-v1";
let bc = null;
let listeners = new Map();

function getBC() {
  if (!bc) {
    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel(BC_NAME);
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || !msg.type) return;
          const cbs = listeners.get(msg.type) || [];
          cbs.forEach((cb) => {
            try {
              cb(msg);
            } catch (e) {
              console.warn("[sync] listener error", e);
            }
          });
          // wildcard
          const all = listeners.get("*") || [];
          all.forEach((cb) => {
            try {
              cb(msg);
            } catch {}
          });
        };
      }
    } catch (e) {
      console.warn("[sync] BC init failed", e);
    }
  }
  return bc;
}

export function subscribeSync(type, callback) {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(callback);
  return () => {
    const arr = listeners.get(type) || [];
    listeners.set(type, arr.filter((cb) => cb !== callback));
  };
}

export function publishSync(type, payload = {}) {
  const msg = { type, ...payload, ts: Date.now() };
  const channel = getBC();
  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {}
  }
  // storage event fallback for SI<15.4 (no BroadcastChannel)
  try {
    localStorage.setItem(`hw:sync:${type}`, JSON.stringify(msg));
    // cleanup after
    setTimeout(() => {
      try {
        localStorage.removeItem(`hw:sync:${type}`);
      } catch {}
    }, 1000);
  } catch {}
}

// Web Locks wrapper for outbox flush (single-send guarantee)
export async function withOutboxLock(fn) {
  if (navigator.locks && navigator.locks.request) {
    return navigator.locks.request("outbox", async (lock) => {
      if (!lock) {
        console.warn("[sync] outbox lock not granted");
        return null;
      }
      return fn();
    });
  } else {
    // fallback: no lock, just run
    return fn();
  }
}

// Generic lock wrapper
export async function withLock(name, fn) {
  if (navigator.locks && navigator.locks.request) {
    return navigator.locks.request(name, async (lock) => {
      if (!lock) return null;
      return fn();
    });
  }
  return fn();
}

// Two-tab race test helper (for QA)
export async function testTwoTabRace() {
  // Simulate two tabs trying to drain same outbox item
  // Returns {passed, details}
  const testId = `race-test-${Date.now()}`;
  const results = [];

  const task = async (tabId) => {
    return withOutboxLock(async () => {
      // Simulate read + write with delay
      await new Promise((r) => setTimeout(r, 100));
      results.push({ tabId, at: Date.now() });
      return tabId;
    });
  };

  // Run two "tabs" concurrently
  const [a, b] = await Promise.all([task("tabA"), task("tabB")]);

  // With lock, they should be sequential (difference > 80ms)
  const diff = Math.abs(results[0].at - results[1].at);
  const passed = diff >= 80;

  return { passed, diff, results, testId };
}

// Init sync: listen storage events for fallback
export function initSync() {
  getBC(); // init

  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith("hw:sync:")) return;
    try {
      const msg = JSON.parse(e.newValue || "{}");
      if (!msg.type) return;
      const cbs = listeners.get(msg.type) || [];
      cbs.forEach((cb) => {
        try {
          cb(msg);
        } catch {}
      });
    } catch {}
  });

  // Also sync range via storage event (already in storage/index.js, but ensure here too)
  window.addEventListener("storage", (e) => {
    if (e.key === "hw:range:v1" && e.newValue) {
      try {
        const range = JSON.parse(e.newValue);
        publishSync("range:changed", { range });
      } catch {}
    }
  });

  return true;
}

export const syncHelpers = {
  subscribeSync,
  publishSync,
  withOutboxLock,
  withLock,
  testTwoTabRace,
  initSync,
};
