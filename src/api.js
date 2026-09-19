// Scaffold-only: fetch wrapper thin envelope {ok,data,error} (specs/18).
// Retry/backoff + outbox = sesi T18. Jangan dipakai fitur sebelum itu.
const BASE = "/api/v1";

async function request(method, path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      ...(opts.csrf ? { "X-CSRF-Token": opts.csrf } : {})
    },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
    signal: opts.signal
  });
  const requestId = res.headers.get("X-Request-Id");
  const json = await res.json().catch(() => ({}));
  return { status: res.status, requestId, ...json };
}

export const api = {
  get: (path, opts) => request("GET", path, null, opts),
  post: (path, body, opts) => request("POST", path, body, opts),
  patch: (path, body, opts) => request("PATCH", path, body, opts),
  del: (path, opts) => request("DELETE", path, null, opts),
  health: () => request("GET", "/health")
};
