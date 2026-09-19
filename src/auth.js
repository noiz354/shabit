/**
 * HabitWealth auth + onboarding state — T5 (spec 07, P07) — TANPA backend wajib
 *
 * Local-first session: sesi disimpan lokal (hash id, tanpa kredensial mentah).
 * Bila /api/v1/auth/* tersedia → dipanggil; bila gagal/offline → sesi lokal tetap dibuat
 * (first habit <3 menit tidak boleh tergantung jaringan).
 *
 * State machine onboarding (spec 02 flow first-value):
 *   splash → carousel → hub → consent → passkey → first-habit → done
 *
 * Rules:
 * - Consent 3 lapis: dasar WAJIB; kesehatan/finansial opsional TANPA preselect.
 * - Passkey kondisional; "Nanti Saja" → badge pengingat di Pengaturan.
 * - Primer izin: SATU per momen (Day-1 biometrik saja; notifikasi setelah first habit).
 * - Biometrik gagal 3× → fallback (PIN/password/tautan email) — di sini: masuk ulang via email.
 * - Auto-logout 30 hari tidak aktif = USULAN (OPEN di spec 07), dibuat konstanta + label OPEN.
 * - Events: signup_completed {method, day}, onboarding_completed {duration_s, skipped}.
 * - Tidak menyimpan email mentah di analytics/log; sesi menyimpan email hanya untuk tampilan (bisa dimasking).
 */

import { track } from "./analytics.js";
import { hashString } from "./crypto.js";
import { updatePrefs, setOnboardingDone, isOnboardingDone } from "./storage/prefs.js";
import { listOutbox } from "./storage/outbox.js";

export const SESSION_KEY = "hw:session:v1";
export const ONBOARDING_KEY = "hw:onboarding:state:v1";
export const CONSENT_HISTORY_KEY = "hw:consent:history:v1";
export const PASSKEY_KEY = "hw:passkey:v1";
export const BIO_FAIL_KEY = "hw:auth:bio-fail:v1";
export const RETURN_TO_KEY = "hw:auth:return-to";
const ACCOUNTS_KEY = "hw:accounts:v1"; // hash email → user_id (deteksi duplikat lokal)

export const AUTO_LOGOUT_DAYS = 30; // OPEN (spec 07: usulan, belum diputuskan)
export const CONSENT_VERSION = 1;
export const BIO_FAIL_LIMIT = 3;
export const STEPS = ["carousel", "hub", "consent", "passkey", "first-habit", "done"];

const listeners = new Set();

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function safeSet(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function emit(type, detail) {
  listeners.forEach((fn) => {
    try {
      fn({ type, detail });
    } catch {}
  });
  try {
    window.dispatchEvent(new CustomEvent("hw:auth-changed", { detail: { type, ...detail } }));
  } catch {}
}
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Session ----------
export function getSession() {
  const s = safeGet(SESSION_KEY);
  if (!s || !s.user_id) return null;
  return s;
}

export function isLoggedIn() {
  return !!getSession();
}

export function isSessionExpired(session = getSession(), now = Date.now()) {
  if (!session) return false;
  const last = session.last_active_at || session.created_at || now;
  return now - last > AUTO_LOGOUT_DAYS * 24 * 60 * 60 * 1000;
}

export function touchSession(now = Date.now()) {
  const s = getSession();
  if (!s) return null;
  s.last_active_at = now;
  safeSet(SESSION_KEY, s);
  return s;
}

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const e = email.trim();
  if (e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return "••••";
  const [user, domain] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, Math.min(6, user.length - 2)))}@${domain}`;
}

async function emailHash(email) {
  return hashString(`hw-acct:${String(email).trim().toLowerCase()}`);
}

/**
 * Cek duplikat akun lokal (state "duplikat" di SignupLoginHub).
 * Backend nyata akan menjawab 409; lokal cukup cek tabel hash.
 */
export async function findLocalAccount(email) {
  const accounts = safeGet(ACCOUNTS_KEY, {});
  const h = await emailHash(email);
  return accounts[h] ? { user_id: accounts[h], hash: h } : null;
}

async function rememberLocalAccount(email, userId) {
  const accounts = safeGet(ACCOUNTS_KEY, {});
  const h = await emailHash(email);
  accounts[h] = userId;
  safeSet(ACCOUNTS_KEY, accounts);
}

/**
 * Coba backend, tapi jangan bergantung padanya.
 * Mengembalikan {ok, data, offline} — tidak melempar.
 */
async function tryApi(path, body, { timeout = 4000 } = {}) {
  if (typeof fetch !== "function") return { ok: false, offline: true };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, offline: true };
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const res = await fetch(`/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
      signal: controller ? controller.signal : undefined,
    });
    let json = {};
    try {
      json = await res.json();
    } catch {}
    return { ok: res.ok && json && json.ok !== false, status: res.status, data: json.data || null, error: json.error || null, offline: false };
  } catch {
    return { ok: false, offline: true };
  } finally {
    if (t) clearTimeout(t);
  }
}

function dayLabel(d = new Date()) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}

/**
 * Signup/login lokal-first.
 * method: "email" | "google" | "apple" | "passkey" (google/apple/passkey belum aktif → ditolak jujur)
 */
export async function signup({ method = "email", email = "" } = {}) {
  if (method !== "email") {
    return { ok: false, code: "METHOD_UNAVAILABLE", message: "Metode ini belum tersedia di versi ini." };
  }
  if (!isValidEmail(email)) {
    return { ok: false, code: "INVALID_EMAIL", message: "Format email belum benar." };
  }
  const dup = await findLocalAccount(email);
  if (dup) {
    return { ok: false, code: "DUPLICATE", message: "Akun dengan email ini sudah ada di perangkat ini.", user_id: dup.user_id };
  }

  const remote = await tryApi("/auth/signup", { email: email.trim() });
  const userId = (remote.ok && remote.data && remote.data.user_id) || `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const session = {
    user_id: userId,
    user_id_hash: await hashString(userId),
    method,
    email: email.trim(), // untuk tampilan (dimasking di UI); tidak pernah dikirim ke analytics
    created_at: now,
    last_active_at: now,
    synced: !!remote.ok,
    offline_created: !remote.ok,
  };
  safeSet(SESSION_KEY, session);
  await rememberLocalAccount(email, userId);

  const ob = getOnboardingState();
  if (!ob.started_at) ob.started_at = now;
  ob.step = "consent";
  ob.signup_at = now;
  safeSet(ONBOARDING_KEY, ob);

  track("signup_completed", { method, day: dayLabel() }).catch(() => {});
  emit("signup", { method, offline: !remote.ok });
  return { ok: true, session, offline: !remote.ok };
}

export async function login({ method = "email", email = "" } = {}) {
  if (method !== "email") {
    return { ok: false, code: "METHOD_UNAVAILABLE", message: "Metode ini belum tersedia di versi ini." };
  }
  if (!isValidEmail(email)) return { ok: false, code: "INVALID_EMAIL", message: "Format email belum benar." };
  const local = await findLocalAccount(email);
  if (!local) return { ok: false, code: "NOT_FOUND", message: "Akun belum ada di perangkat ini. Daftar dulu?" };

  const remote = await tryApi("/auth/login", { email: email.trim() });
  const now = Date.now();
  const session = {
    user_id: local.user_id,
    user_id_hash: await hashString(local.user_id),
    method,
    email: email.trim(),
    created_at: now,
    last_active_at: now,
    synced: !!remote.ok,
    offline_created: !remote.ok,
  };
  safeSet(SESSION_KEY, session);
  emit("login", { method, offline: !remote.ok });
  return { ok: true, session, offline: !remote.ok, returning: true };
}

export async function logout({ reason = "user" } = {}) {
  await tryApi("/auth/logout", {}, { timeout: 2000 });
  safeSet(SESSION_KEY, null);
  try {
    localStorage.removeItem("hw:re-auth:expires");
  } catch {}
  emit("logout", { reason });
  return true;
}

/**
 * Splash/RestoreSession: cek sesi, expiry (usulan 30 hari), pending queue.
 */
export async function restoreSession() {
  const session = getSession();
  let expired = false;
  if (session && isSessionExpired(session)) {
    expired = true;
    await logout({ reason: "expired" });
  }
  let pendingSync = 0;
  try {
    const items = await listOutbox();
    pendingSync = items.filter((i) => i.status === "pending" || i.status === "failed").length;
  } catch {}
  if (session && !expired) touchSession();
  return {
    session: expired ? null : session,
    expired,
    pendingSync,
    onboardingDone: isOnboardingComplete(),
    nextStep: getNextStep(),
  };
}

// ---------- Onboarding state ----------
export function getOnboardingState() {
  const s = safeGet(ONBOARDING_KEY, null);
  if (s) return s;
  return { step: "carousel", started_at: 0, carousel_skipped: false, completed_at: 0 };
}

export function setOnboardingStep(step) {
  if (!STEPS.includes(step)) throw new Error(`Step tidak dikenal: ${step}`);
  const s = getOnboardingState();
  if (!s.started_at) s.started_at = Date.now();
  s.step = step;
  safeSet(ONBOARDING_KEY, s);
  emit("step", { step });
  return s;
}

export function markCarouselDone({ skipped = false } = {}) {
  const s = getOnboardingState();
  if (!s.started_at) s.started_at = Date.now();
  s.carousel_skipped = !!skipped;
  s.step = "hub";
  safeSet(ONBOARDING_KEY, s);
  emit("step", { step: "hub" });
  return s;
}

export function isOnboardingComplete() {
  const s = getOnboardingState();
  return s.step === "done" || isOnboardingDone();
}

/** Langkah berikutnya yang valid berdasarkan state (dipakai router guard). */
export function getNextStep() {
  if (isOnboardingComplete()) return "done";
  const s = getOnboardingState();
  if (!isLoggedIn()) {
    // belum punya sesi: carousel (sekali) → hub
    return s.step === "carousel" && !s.carousel_skipped && !s.signup_at ? "carousel" : "hub";
  }
  // sudah login tapi onboarding belum selesai
  if (!STEPS.includes(s.step) || s.step === "carousel" || s.step === "hub") return "consent";
  return s.step;
}

/**
 * Router guard. Mengembalikan hash tujuan bila harus redirect, else null.
 * @param {string} path  e.g. "/beranda" | "/auth/consent"
 */
export function authGate(path) {
  const isAuthRoute = path === "/auth" || path.startsWith("/auth/");
  const step = path.startsWith("/auth/") ? path.slice(6) : "";
  const next = getNextStep();

  if (next === "done") {
    // sudah selesai: rute auth (kecuali recovery) → beranda
    if (isAuthRoute && step !== "recovery") return "#/beranda";
    return null;
  }

  if (!isLoggedIn()) {
    if (!isAuthRoute) {
      safeSet(RETURN_TO_KEY, path);
      return "#/auth";
    }
    // belum login boleh: splash, carousel, hub, recovery
    if (["", "carousel", "hub", "recovery"].includes(step)) return null;
    return `#/auth/${next}`;
  }

  // login tapi onboarding belum selesai
  if (!isAuthRoute) {
    safeSet(RETURN_TO_KEY, path);
    return `#/auth/${next}`;
  }
  if (step === "" || step === "recovery") return null;
  // tidak boleh lompat maju melewati langkah berikutnya
  const allowed = STEPS.indexOf(step) <= STEPS.indexOf(next);
  if (!allowed) return `#/auth/${next}`;
  // sudah login tidak perlu balik ke carousel/hub
  if (step === "carousel" || step === "hub") return `#/auth/${next}`;
  return null;
}

export function consumeReturnTo() {
  const p = safeGet(RETURN_TO_KEY, null);
  safeSet(RETURN_TO_KEY, null);
  if (!p || typeof p !== "string" || !p.startsWith("/") || p.startsWith("/auth")) return null;
  return p;
}

// ---------- Consent (3 lapis; opsional tanpa preselect) ----------
export const CONSENT_DEFAULT = Object.freeze({ dasar: false, kesehatan: false, finansial: false });

export const CONSENT_COPY = {
  dasar: {
    title: "Dasar (wajib)",
    desc: "Menyimpan habit dan catatan uang manualmu di perangkat ini agar aplikasi berfungsi. Kami memproses data pribadi sesuai UU PDP No. 27/2022.",
  },
  kesehatan: {
    title: "Data kesehatan (opsional)",
    desc: "Nanti kamu bisa menghubungkan sumber langkah/tidur. Belum aktif sekarang; bisa diubah kapan saja di Pengaturan › Data & Privasi.",
  },
  finansial: {
    title: "Data finansial (opsional)",
    desc: "Nanti kamu bisa menghubungkan rekening lewat mitra terverifikasi. HabitWealth tidak pernah memindahkan uang. Bisa dicabut kapan saja.",
  },
};

export function validateConsent(choice) {
  const c = { ...CONSENT_DEFAULT, ...(choice || {}) };
  if (c.dasar !== true) return { ok: false, code: "BASIC_REQUIRED", message: "Persetujuan dasar diperlukan agar aplikasi bisa berfungsi." };
  return { ok: true, value: { dasar: true, kesehatan: c.kesehatan === true, finansial: c.finansial === true } };
}

export function getConsentHistory() {
  const h = safeGet(CONSENT_HISTORY_KEY, []);
  return Array.isArray(h) ? h : [];
}

export async function saveConsent(choice) {
  const v = validateConsent(choice);
  if (!v.ok) return v;
  const record = { ...v.value, version: CONSENT_VERSION, granted_at: new Date().toISOString() };
  const hist = getConsentHistory();
  hist.unshift(record);
  safeSet(CONSENT_HISTORY_KEY, hist.slice(0, 20));
  try {
    await updatePrefs("privacy.consent", { ...v.value, version: CONSENT_VERSION });
  } catch {}
  setOnboardingStep("passkey");
  emit("consent", { kesehatan: record.kesehatan, finansial: record.finansial });
  return { ok: true, record };
}

export async function revokeConsent(scope) {
  if (scope !== "kesehatan" && scope !== "finansial") return { ok: false, code: "NOT_REVOCABLE" };
  const last = getConsentHistory()[0] || { ...CONSENT_DEFAULT, dasar: true };
  const record = { ...last, [scope]: false, version: CONSENT_VERSION, granted_at: new Date().toISOString(), revoked: scope };
  const hist = getConsentHistory();
  hist.unshift(record);
  safeSet(CONSENT_HISTORY_KEY, hist.slice(0, 20));
  try {
    await updatePrefs(`privacy.consent.${scope}`, false);
  } catch {}
  emit("consent", { revoked: scope });
  return { ok: true, record };
}

// ---------- Passkey (kondisional) + "Nanti Saja" ----------
export function getPasskeyState() {
  return safeGet(PASSKEY_KEY, { status: "none", deferred_at: 0, reminder: false });
}

export function deferPasskey() {
  const s = { status: "deferred", deferred_at: Date.now(), reminder: true };
  safeSet(PASSKEY_KEY, s);
  setOnboardingStep("first-habit");
  emit("passkey", { status: "deferred" });
  return s;
}

export function hasPasskeyReminder() {
  const s = getPasskeyState();
  return s.status === "deferred" && s.reminder === true;
}

export function dismissPasskeyReminder() {
  const s = getPasskeyState();
  s.reminder = false;
  safeSet(PASSKEY_KEY, s);
  return s;
}

/** Setelah passkey benar-benar terdaftar (Wave 3). Tidak dipanggil sebelum RP siap. */
export function markPasskeyEnrolled(credentialIdHash) {
  const s = { status: "enrolled", enrolled_at: Date.now(), reminder: false, credential_hash: credentialIdHash || null };
  safeSet(PASSKEY_KEY, s);
  setOnboardingStep("first-habit");
  emit("passkey", { status: "enrolled" });
  return s;
}

// ---------- Biometrik gagal 3× → fallback ----------
export function getBiometricFailures() {
  const s = safeGet(BIO_FAIL_KEY, { count: 0, last_at: 0 });
  return s && typeof s.count === "number" ? s : { count: 0, last_at: 0 };
}

export function recordBiometricFailure(now = Date.now()) {
  const s = getBiometricFailures();
  s.count += 1;
  s.last_at = now;
  safeSet(BIO_FAIL_KEY, s);
  return { ...s, fallback: s.count >= BIO_FAIL_LIMIT };
}

export function resetBiometricFailures() {
  safeSet(BIO_FAIL_KEY, { count: 0, last_at: 0 });
}

export function shouldFallbackToRecovery() {
  return getBiometricFailures().count >= BIO_FAIL_LIMIT;
}

// ---------- First habit → handoff ke pengalaman utama ----------
/**
 * Dipanggil saat first completion. Mengunci onboarding = done,
 * fire onboarding_completed {duration_s, skipped}, request persist() via prefs.
 */
export async function completeOnboarding({ firstHabitId } = {}) {
  const s = getOnboardingState();
  const now = Date.now();
  const duration_s = s.started_at ? Math.max(0, Math.round((now - s.started_at) / 1000)) : 0;
  s.step = "done";
  s.completed_at = now;
  s.first_habit_id = firstHabitId || null;
  safeSet(ONBOARDING_KEY, s);
  try {
    setOnboardingDone(true); // requestPersist() post-onboarding (AUD-STORE-01)
  } catch {}
  track("onboarding_completed", { duration_s, skipped: !!s.carousel_skipped }).catch(() => {});
  emit("done", { duration_s });
  return { duration_s, under3min: duration_s > 0 ? duration_s < 180 : null };
}

/** Untuk QA: reset seluruh state auth/onboarding lokal (tidak menyentuh data habit/uang). */
export function resetAuthState() {
  [SESSION_KEY, ONBOARDING_KEY, CONSENT_HISTORY_KEY, PASSKEY_KEY, BIO_FAIL_KEY, RETURN_TO_KEY].forEach((k) => safeSet(k, null));
  try {
    setOnboardingDone(false);
  } catch {}
  emit("reset", {});
}

export const auth = {
  getSession,
  isLoggedIn,
  isSessionExpired,
  touchSession,
  isValidEmail,
  maskEmail,
  findLocalAccount,
  signup,
  login,
  logout,
  restoreSession,
  getOnboardingState,
  setOnboardingStep,
  markCarouselDone,
  isOnboardingComplete,
  getNextStep,
  authGate,
  consumeReturnTo,
  validateConsent,
  saveConsent,
  revokeConsent,
  getConsentHistory,
  getPasskeyState,
  deferPasskey,
  hasPasskeyReminder,
  dismissPasskeyReminder,
  markPasskeyEnrolled,
  recordBiometricFailure,
  resetBiometricFailures,
  shouldFallbackToRecovery,
  completeOnboarding,
  resetAuthState,
  onAuthChange,
  STEPS,
  AUTO_LOGOUT_DAYS,
  CONSENT_VERSION,
  CONSENT_COPY,
};
