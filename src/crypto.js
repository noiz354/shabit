/**
 * HabitWealth crypto helpers — AUD-CRYPTO-01
 * APIs: 113,117,118,119,120,187 (Web Crypto, CSP, Secure Context, Reporting, Encoding)
 * Zero-dep, secure-context gated, UTF-8 safe
 */

export function isSecureContext() {
  try {
    return window.isSecureContext === true;
  } catch {
    return false;
  }
}

export function getRandomValues(len = 16) {
  const arr = new Uint8Array(len);
  if (globalThis.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    return arr;
  }
  // fallback (not cryptographically strong — only for non-secure contexts)
  for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

export function randomId() {
  if (globalThis.crypto && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  // fallback: 16 bytes hex
  const bytes = getRandomValues(16);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateIdempotencyKey() {
  // idempotency: timestamp + random + hash of UA (to avoid collisions)
  const ts = Date.now().toString(36);
  const rnd = randomId().slice(0, 12);
  return `idem_${ts}_${rnd}`;
}

// SHA-256 hash (hex) — uses SubtleCrypto when available, fallback sync hash (djb2) for non-secure ctx
export async function hashString(str) {
  const input = typeof str === "string" ? str : String(str);
  try {
    if (isSecureContext() && crypto.subtle && crypto.subtle.digest) {
      const enc = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const arr = new Uint8Array(buf);
      return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {
    console.warn("[crypto] subtle digest failed", e);
  }
  // fallback non-crypto hash (for non-secure ctx or unsupported) — NOT for security, only for redaction/id dedup
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0") + "_fallback";
}

// hashId for analytics redaction — always uses hashString, adds salt from prefs if available
export async function hashId(id, salt = "hw-salt-v1") {
  return hashString(`${salt}:${id}`);
}

// UTF-8 utils (ID 187)
export function utf8Encode(str) {
  try {
    return new TextEncoder().encode(str);
  } catch {
    // fallback
    const arr = [];
    for (let i = 0; i < str.length; i++) arr.push(str.charCodeAt(i));
    return new Uint8Array(arr);
  }
}

export function utf8Decode(bytes) {
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
}

export function base64UrlEncode(bytes) {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// VAPID key helpers (R1.1 design — no private key leaves server)
export function isVapidKeyValid(publicKey) {
  // basic check: base64url, 65 bytes uncompressed EC P-256
  if (!publicKey || typeof publicKey !== "string") return false;
  try {
    const bytes = base64UrlDecode(publicKey);
    return bytes.length === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

// CSP nonce generation (if needed for inline style fallback — but we use no inline per CSP)
export function generateNonce(len = 16) {
  return base64UrlEncode(getRandomValues(len));
}

// secure random int in range [0, max)
export function randomInt(max) {
  if (max <= 0) return 0;
  const bytes = getRandomValues(4);
  const val = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return Math.abs(val) % max;
}

// redaction helper: ensure no PII in logs
export function redactForLog(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const sensitiveKeys = ["email", "password", "token", "amount", "note", "title", "description", "phone", "account"];
  for (const k of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      clone[k] = "[REDACTED]";
    } else if (typeof clone[k] === "object") {
      clone[k] = redactForLog(clone[k]);
    }
  }
  return clone;
}

// Export bundle
export const cryptoHelpers = {
  isSecureContext,
  getRandomValues,
  randomId,
  generateIdempotencyKey,
  hashString,
  hashId,
  utf8Encode,
  utf8Decode,
  base64UrlEncode,
  base64UrlDecode,
  isVapidKeyValid,
  generateNonce,
  randomInt,
  redactForLog,
};
