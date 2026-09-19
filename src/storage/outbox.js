/**
 * HabitWealth outbox queue — offline writes + idempotency
 * AUD-STORE-01 + AUD-SYNC-01 + AUD-API-01
 *
 * Each entry: {id, op, path, body, idempotencyKey, status, createdAt, retryCount, lastError}
 * status: pending | syncing | failed
 *
 * Uses:
 *  - IndexedDB store "outbox"
 *  - Web Locks (navigator.locks) to prevent double-send across tabs
 *  - BroadcastChannel "habitwealth-v1" for multi-tab sync
 *  - idempotencyKey from crypto.js
 */

import { getDB, idbGetAll, idbPut, idbDel } from "./db.js";
import { generateIdempotencyKey } from "../crypto.js";

const STORE = "outbox";
const BC_NAME = "habitwealth-v1";
let bc = null;

function getBC() {
  if (bc) return bc;
  try {
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(BC_NAME);
    }
  } catch {}
  return bc;
}

export async function enqueue(op, path, body = null) {
  const id = (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `out_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const entry = {
    id,
    op: op.toUpperCase(), // POST, PATCH, DELETE, PUT
    path, // e.g. "/habit-entries"
    body,
    idempotencyKey: generateIdempotencyKey(),
    status: "pending",
    createdAt: Date.now(),
    retryCount: 0,
    lastError: null,
  };
  await idbPut(STORE, entry);
  notifyTabs({ type: "outbox:enqueued", id });
  return entry;
}

export async function listOutbox(status) {
  const all = await idbGetAll(STORE, null, undefined, 1000);
  if (status) return all.filter((e) => e.status === status).sort((a, b) => a.createdAt - b.createdAt);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeFromOutbox(id) {
  await idbDel(STORE, id);
  notifyTabs({ type: "outbox:removed", id });
}

export async function markSyncing(id) {
  const db = await getDB();
  const entry = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!entry) return null;
  entry.status = "syncing";
  await idbPut(STORE, entry);
  return entry;
}

export async function markFailed(id, errorMsg) {
  const db = await getDB();
  const entry = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!entry) return null;
  entry.status = "failed";
  entry.retryCount = (entry.retryCount || 0) + 1;
  entry.lastError = errorMsg ? String(errorMsg).slice(0, 500) : "unknown";
  await idbPut(STORE, entry);
  return entry;
}

// drain flush — called on online + foreground + manual
export async function drainOutbox(apiClient, options = {}) {
  const { maxRetries = 3, concurrency = 1 } = options;

  // Use Web Locks to prevent double-send across tabs
  const runDrain = async () => {
    const pending = await listOutbox("pending");
    const failedRetryable = (await listOutbox("failed")).filter((e) => (e.retryCount || 0) < maxRetries);
    const queue = [...pending, ...failedRetryable].sort((a, b) => a.createdAt - b.createdAt);

    if (queue.length === 0) return { drained: 0, failed: 0 };

    let drained = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await markSyncing(item.id);
        // apiClient is expected to have post/patch/del with idempotency support
        const method = item.op.toLowerCase();
        let res;
        if (apiClient && typeof apiClient[method] === "function") {
          res = await apiClient[method](item.path, item.body, { idempotencyKey: item.idempotencyKey });
        } else if (apiClient && typeof apiClient.request === "function") {
          res = await apiClient.request(item.op, item.path, item.body, { idempotencyKey: item.idempotencyKey });
        } else {
          // fallback direct fetch
          const r = await fetch(`/api/v1${item.path}`, {
            method: item.op,
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": item.idempotencyKey,
            },
            credentials: "same-origin",
            body: item.body ? JSON.stringify(item.body) : undefined,
          });
          res = { status: r.status, ok: r.ok };
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        }

        // success if 2xx or 409 (idempotency replay returns original)
        if (res && (res.ok || (res.status >= 200 && res.status < 300) || res.status === 409)) {
          await removeFromOutbox(item.id);
          drained++;
          notifyTabs({ type: "outbox:drained", id: item.id });
        } else {
          throw new Error(`flush failed status ${res?.status}`);
        }
      } catch (e) {
        await markFailed(item.id, e.message || e);
        failed++;
        // exponential backoff: skip remaining if network offline
        if (!navigator.onLine) break;
      }
    }

    return { drained, failed, remaining: queue.length - drained };
  };

  try {
    if (navigator.locks && navigator.locks.request) {
      return await navigator.locks.request("outbox", async () => runDrain());
    } else {
      return await runDrain();
    }
  } catch (e) {
    console.warn("[outbox] drain lock failed", e);
    return await runDrain();
  }
}

function notifyTabs(msg) {
  const channel = getBC();
  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {}
  }
  // storage event fallback handled elsewhere
  try {
    localStorage.setItem("hw:bc:ping", String(Date.now()));
  } catch {}
}

export function onOutboxMessage(callback) {
  const channel = getBC();
  if (channel) {
    channel.onmessage = (ev) => {
      if (ev.data && ev.data.type && ev.data.type.startsWith("outbox:")) {
        callback(ev.data);
      }
    };
  }
  // storage fallback
  window.addEventListener("storage", (e) => {
    if (e.key === "hw:bc:ping") {
      callback({ type: "outbox:sync" });
    }
  });
}

// auto-drain on online + visibility
export function setupAutoDrain(apiClient) {
  const tryDrain = () => {
    if (!navigator.onLine) return;
    drainOutbox(apiClient).catch(() => {});
  };

  window.addEventListener("online", tryDrain);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryDrain();
  });

  // initial
  if (navigator.onLine) {
    // defer to idle
    if ("requestIdleCallback" in window) {
      requestIdleCallback(tryDrain, { timeout: 2000 });
    } else {
      setTimeout(tryDrain, 1500);
    }
  }
}
