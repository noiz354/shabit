/**
 * HabitWealth API client — AUD-API-01 (partial, Wave 0) + AUD-STORE-01 outbox integration
 * - Fetch wrapper thin envelope {ok,data,error} (specs/18)
 * - Idempotency-Key support
 * - Retry/backoff for GET, outbox for mutating ops when offline
 * - No PII in logs (redacted via cryptoHelpers)
 */

import { generateIdempotencyKey } from "./crypto.js";
import { enqueue } from "./storage/outbox.js";

const BASE = "/api/v1";

async function request(method, path, body, opts = {}) {
  const idempotencyKey = opts.idempotencyKey || (method !== "GET" ? generateIdempotencyKey() : undefined);
  const headers = {
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(opts.csrf ? { "X-CSRF-Token": opts.csrf } : {}),
    ...(opts.headers || {}),
  };

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutMs = opts.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
      signal: opts.signal || controller.signal,
    });

    const requestId = res.headers.get("X-Request-Id");
    let json;
    try {
      json = await res.json();
    } catch {
      json = {};
    }

    return { status: res.status, requestId, ok: res.ok, idempotencyKey, ...json };
  } catch (e) {
    // Network error — enqueue if mutating and offline handling enabled
    if (opts.enqueueOnFail !== false && method !== "GET" && navigator.onLine === false) {
      // Offline — queue to outbox
      try {
        await enqueue(method, path, body);
      } catch {}
      return { status: 0, ok: false, error: { code: "OFFLINE_QUEUED", message: "Disimpan offline, akan sync otomatis" }, queued: true };
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestWithRetry(method, path, body, opts = {}) {
  const retries = opts.retries ?? (method === "GET" ? 2 : 0);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await request(method, path, body, { ...opts, retries: 0 });
      // Retry on 5xx
      if (res.status >= 500 && attempt < retries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export const api = {
  get: (path, opts) => requestWithRetry("GET", path, null, opts),
  post: (path, body, opts) => requestWithRetry("POST", path, body, opts),
  patch: (path, body, opts) => requestWithRetry("PATCH", path, body, opts),
  put: (path, body, opts) => requestWithRetry("PUT", path, body, opts),
  del: (path, opts) => requestWithRetry("DELETE", path, null, opts),
  request: (method, path, body, opts) => requestWithRetry(method, path, body, opts),
  health: () => requestWithRetry("GET", "/health"),
};

// For outbox drain compatibility
export default api;
