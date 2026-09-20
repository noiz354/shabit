/**
 * HabitWealth notify — T12 (spec 11 amandemen 19 Sep 2026): Kotak Masuk in-app + Quiet Hours tz-user
 * MVP lokal tanpa Web Push (ADR-0002 = R1.1). Kotak Masuk = channel utama; OS lokal (SW showNotification) pelengkap.
 *
 * - Store IDB `inbox` (DB v3): id deterministik → dedup idempoten
 * - Quiet Hours dihitung di zona waktu user (prefs.tz) via Intl, bukan jam server/perangkat; item ditunda (deliver_after), `system` tidak pernah ditunda
 * - Prioritas budget(3) > habit(2) > celebration(1) > weekly/promo(0); hanya prioritas tertinggi per evaluasi yang memicu OS
 * - Expiry per template → arsip otomatis; kategori mute → tidak dibuat
 * - Events hanya saat user tap/arsip: notification_opened/dismissed {id: template, category, deep_link}
 * - Copy ≤40 karakter, tanpa nominal/judul habit (lock-screen aman)
 */

import { idbPut, idbGet, idbGetAll, idbDel } from "./storage/db.js";
import { getPrefs, updatePrefs, setPrefs } from "./storage/prefs.js";
import { enqueue } from "./storage/outbox.js";
import { queryPermission } from "./permissions.js";
import { track } from "./analytics.js";

const STORE = "inbox";
const LEGACY_LS_KEY = "hw:notif:inbox:v1";
const LAST_EVAL_KEY = "hw:notify:last-eval:v1";

export const PRIORITY = { system: 4, budget: 3, habit: 2, celebration: 1, weekly: 0, promo: 0 };

export const CATEGORY_COPY = {
  habit: { label: "Pengingat habit", desc: "Pagi & sore bila masih ada habit yang belum dicentang." },
  budget: { label: "Peringatan budget", desc: "Saat kategori mencapai 80% dan 100%." },
  streak: { label: "Streak & perayaan", desc: "Milestone 7 dan 30 hari." },
  weekly: { label: "Ringkasan mingguan", desc: "Setiap Senin pagi." },
  promo: { label: "Promosi", desc: "Info fitur/penawaran. Terpisah dan mati secara bawaan." },
  system: { label: "Keamanan & operasional", desc: "Sesi, sinkronisasi, dan pemberitahuan penting — tidak bisa dimatikan." },
};

// Matriks spec 11 — copy ≤40 karakter, tanpa nominal
export const TEMPLATES = {
  habit_morning: { category: "habit", priority: "habit", title: "Pagi! Satu habit kecil hari ini?", body: "Centang satu saja untuk menjaga ritme.", deepLink: "#/habit", expiry: "today-18" },
  habit_evening: { category: "habit", priority: "habit", title: "Masih ada habit yang bisa dicentang", body: "Belum terlambat untuk hari ini.", deepLink: "#/habit", expiry: "today-end" },
  streak_7: { category: "streak", priority: "celebration", title: "Streak 7 hari! Konsisten banget 🎉", body: "Seminggu penuh. Pertahankan ritmenya.", deepLink: "#/habit/{habit_id}", expiry: "7d" },
  streak_30: { category: "streak", priority: "celebration", title: "30 hari beruntun. Luar biasa! 🎉", body: "Sebulan konsisten — ini kebiasaan sungguhan.", deepLink: "#/habit/{habit_id}", expiry: "7d" },
  budget_80: { category: "budget", priority: "budget", title: "Budget {category} sudah 80%", body: "Cek pengeluaran kategori ini sebelum akhir bulan.", deepLink: "#/uang?cat={category_enc}", expiry: "month-end" },
  budget_100: { category: "budget", priority: "budget", title: "Budget {category} tercapai 100%", body: "Batas bulan ini sudah terpakai. Tidak apa-apa — tinjau pelan-pelan.", deepLink: "#/uang?cat={category_enc}", expiry: "month-end" },
  goal_success: { category: "streak", priority: "celebration", title: "Celengan minggu ini tercapai ✓", body: "Alokasi virtual pekan ini lengkap.", deepLink: "#/insight", expiry: "7d", gated: "T11" },
  goal_missed: { category: "weekly", priority: "weekly", title: "Sayang, celengan pekan ini terlewat", body: "Streak habit-mu tetap aman. Coba lagi pekan depan.", deepLink: "#/insight", expiry: "7d", gated: "T11" },
  weekly_summary: { category: "weekly", priority: "weekly", title: "Ringkasan minggumu sudah siap", body: "Lihat habit dan pengeluaran 7 hari terakhir.", deepLink: "#/beranda?preset=7d", expiry: "7d" },
  system: { category: "system", priority: "system", title: "HabitWealth", body: "{message}", deepLink: "#/beranda", expiry: "7d" },
};

// ---------- waktu di zona waktu user ----------
export function partsInTZ(date = new Date(), tz) {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
    const p = Object.fromEntries(fmt.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
    const hour = Number(p.hour) % 24; // en-GB dapat mengembalikan "24" pada tengah malam di beberapa engine
    return { date: `${p.year}-${p.month}-${p.day}`, hour, minute: Number(p.minute), minutes: hour * 60 + Number(p.minute), weekday: p.weekday };
  } catch {
    return { date: date.toISOString().slice(0, 10), hour: date.getHours(), minute: date.getMinutes(), minutes: date.getHours() * 60 + date.getMinutes(), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] };
  }
}

function hm(str, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str || "");
  if (!m) return fallback;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}

/** true bila `now` berada dalam jam tenang (mendukung rentang lewat tengah malam), dihitung di tz. */
export function isQuietNow(now, quietHours, tz) {
  const start = hm(quietHours && quietHours.start, 22 * 60);
  const end = hm(quietHours && quietHours.end, 7 * 60);
  if (start === end) return false;
  const cur = partsInTZ(now, tz).minutes;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Epoch ms akhir jam tenang berikutnya (dalam tz) — untuk deliver_after. */
export function quietEndsAt(now, quietHours, tz) {
  const end = hm(quietHours && quietHours.end, 7 * 60);
  const cur = partsInTZ(now, tz).minutes;
  const delta = end > cur ? end - cur : 24 * 60 - cur + end;
  return now.getTime() + delta * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

function expiryAt(kind, now, tz) {
  const p = partsInTZ(now, tz);
  const untilMinutes = (m) => now.getTime() + (m - p.minutes) * 60 * 1000;
  switch (kind) {
    case "today-18": return untilMinutes(18 * 60);
    case "today-end": return untilMinutes(24 * 60);
    case "month-end": {
      const [y, m] = p.date.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const dayNum = Number(p.date.slice(8));
      return untilMinutes(24 * 60) + (daysInMonth - dayNum) * 24 * 60 * 60 * 1000;
    }
    case "7d":
    default: return now.getTime() + 7 * 24 * 60 * 60 * 1000;
  }
}

// ---------- prefs ----------
const DEFAULT_NOTIF = {
  enabled: true,
  quietHours: { start: "22:00", end: "07:00" },
  categories: { habit: true, budget: true, streak: true, weekly: true, promo: false, system: true },
  channels: { push: true, inApp: true, email: false },
  stats: { date: null, delivered: 0 },
};

export async function getNotifPrefs() {
  const prefs = await getPrefs();
  const n = prefs.notifications || {};
  const cats = { ...DEFAULT_NOTIF.categories, ...(n.categories || {}) };
  if (n.categories && n.categories.insight !== undefined && n.categories.weekly === undefined) cats.weekly = n.categories.insight; // migrasi kunci lama
  cats.system = true; // tidak bisa dimatikan
  return {
    ...DEFAULT_NOTIF,
    ...n,
    quietHours: { ...DEFAULT_NOTIF.quietHours, ...(n.quietHours || {}) },
    categories: cats,
    channels: { ...DEFAULT_NOTIF.channels, ...(n.channels || {}), inApp: true, email: false },
    stats: { ...DEFAULT_NOTIF.stats, ...(n.stats || {}) },
    tz: prefs.tz || "Asia/Jakarta",
  };
}

/** Simpan sebagian prefs notifikasi (path relatif, mis. "categories.habit") + antre PATCH server (tanpa PII). */
export async function setNotifPref(path, value) {
  if (path === "categories.system") value = true;
  if (path === "channels.inApp") value = true;
  if (path === "channels.email") value = false;
  if (path === "tz") {
    await updatePrefs("tz", value);
  } else {
    await updatePrefs(`notifications.${path}`, value);
  }
  const n = await getNotifPrefs();
  try {
    await enqueue("PATCH", "/notification-preferences", { enabled: n.enabled, quietHours: n.quietHours, categories: n.categories, channels: n.channels, tz: n.tz });
  } catch {}
  return n;
}

export function deviceTZ() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
}

// ---------- inbox ----------
function fill(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""));
}
function shortCategory(c) {
  const s = String(c || "").trim();
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}

export async function listInbox() {
  try {
    const all = await idbGetAll(STORE, null, undefined, 500);
    return all.sort((a, b) => (PRIORITY[b.priority] || 0) - (PRIORITY[a.priority] || 0) || b.created_at - a.created_at);
  } catch {
    return [];
  }
}

/** Arsipkan item kedaluwarsa; kembalikan {unread, archived, pending} yang sudah dinormalkan. */
export async function partitionInbox(now = Date.now()) {
  const all = await listInbox();
  const unread = [], archived = [], pending = [];
  for (const it of all) {
    if (!it.archived_at && it.expires_at && it.expires_at <= now) {
      it.archived_at = now;
      it.archive_reason = "expired";
      try { await idbPut(STORE, it); } catch {}
    }
    if (it.archived_at) archived.push(it);
    else if (it.deliver_after && it.deliver_after > now) pending.push(it);
    else unread.push(it);
  }
  archived.sort((a, b) => b.created_at - a.created_at);
  return { unread, archived, pending };
}

export async function unreadCount(now = Date.now()) {
  const { unread } = await partitionInbox(now);
  return unread.filter((i) => !i.read_at).length;
}

/**
 * Buat notifikasi dari template. Idempoten per id.
 * @returns {{created:boolean, item?:object, reason?:string, os?:boolean}}
 */
export async function notify(templateId, vars = {}, options = {}) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return { created: false, reason: "UNKNOWN_TEMPLATE" };
  if (tpl.gated && !options.allowGated) return { created: false, reason: `GATED_${tpl.gated}` };
  const now = options.now instanceof Date ? options.now : new Date();
  const prefs = await getNotifPrefs();
  const tz = prefs.tz;
  const isSystem = tpl.category === "system";
  if (!isSystem) {
    if (!prefs.enabled) return { created: false, reason: "DISABLED" };
    if (prefs.categories[tpl.category] === false) return { created: false, reason: "CATEGORY_MUTED" };
  }
  const p = partsInTZ(now, tz);
  const scope = options.scope !== undefined ? options.scope : vars.scope;
  const period = options.period || p.date;
  const id = options.id || [templateId, scope, period].filter((x) => x !== undefined && x !== null && x !== "").join(":");
  const existing = await idbGet(STORE, id).catch(() => null);
  if (existing) return { created: false, reason: "DUPLICATE", item: existing };

  const v = { ...vars, category: shortCategory(vars.category), category_enc: encodeURIComponent(vars.category || "") };
  const quiet = !isSystem && isQuietNow(now, prefs.quietHours, tz);
  const expiresAt = expiryAt(tpl.expiry, now, tz);
  const deliverAfter = quiet ? quietEndsAt(now, prefs.quietHours, tz) : now.getTime();
  // Pengingat yang sudah tidak relevan sebelum jam tenang berakhir (mis. pengingat sore) tidak dibuat — hindari konten basi pagi hari
  if (quiet && expiresAt <= deliverAfter) return { created: false, reason: "QUIET_EXPIRED" };
  const item = {
    id,
    template: templateId,
    category: tpl.category,
    priority: tpl.priority,
    title: fill(tpl.title, v).slice(0, 40),
    body: fill(tpl.body, v).slice(0, 120),
    deep_link: fill(tpl.deepLink, v),
    created_at: now.getTime(),
    deliver_after: deliverAfter,
    delivered_at: null,
    read_at: null,
    archived_at: null,
    expires_at: expiresAt,
    channel: "in_app",
  };
  await idbPut(STORE, item);
  await bumpStats(prefs, p.date);
  let os = false;
  if (!quiet && options.osAllowed !== false) os = await maybeShowOS(item, prefs, options);
  if (os) {
    item.channel = "in_app+os";
    item.delivered_at = now.getTime();
    await idbPut(STORE, item);
  }
  refreshBadge().catch(() => {});
  return { created: true, item, os, deferred: quiet };
}

async function bumpStats(prefs, today) {
  const stats = prefs.stats && prefs.stats.date === today ? prefs.stats : { date: today, delivered: 0 };
  stats.delivered += 1;
  try { await updatePrefs("notifications.stats", stats); } catch {}
}

async function maybeShowOS(item, prefs, options = {}) {
  try {
    if (!prefs.channels.push) return false;
    if (typeof document !== "undefined" && document.visibilityState === "visible" && !options.forceOS) return false; // app terlihat → cukup in-app
    const perm = await queryPermission("notifications");
    if (perm.state !== "granted") return false;
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg || !reg.showNotification) return false;
    await reg.showNotification(item.title, {
      body: item.body,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: item.id, // dedup di OS juga
      renotify: false,
      data: { id: item.id, template: item.template, category: item.category, deepLink: item.deep_link },
    });
    return true;
  } catch {
    return false;
  }
}

export async function markRead(id, { open = true } = {}) {
  const it = await idbGet(STORE, id).catch(() => null);
  if (!it) return null;
  if (!it.read_at) {
    it.read_at = Date.now();
    await idbPut(STORE, it);
  }
  if (open) track("notification_opened", { id: it.template, category: it.category, deep_link: it.deep_link }).catch(() => {});
  refreshBadge().catch(() => {});
  return it;
}

export async function archive(id, reason = "user") {
  const it = await idbGet(STORE, id).catch(() => null);
  if (!it) return null;
  if (!it.archived_at) {
    it.archived_at = Date.now();
    it.archive_reason = reason;
    if (!it.read_at) it.read_at = it.archived_at;
    await idbPut(STORE, it);
    if (reason === "user") track("notification_dismissed", { id: it.template, category: it.category, deep_link: it.deep_link }).catch(() => {});
  }
  refreshBadge().catch(() => {});
  return it;
}

export async function markAllRead() {
  const { unread } = await partitionInbox();
  const now = Date.now();
  for (const it of unread) {
    if (!it.read_at) {
      it.read_at = now;
      await idbPut(STORE, it);
    }
  }
  refreshBadge().catch(() => {});
  return unread.length;
}

export async function removeItem(id) {
  try { await idbDel(STORE, id); } catch {}
  refreshBadge().catch(() => {});
}

export async function refreshBadge() {
  const n = await unreadCount();
  try {
    if ("setAppBadge" in navigator) {
      if (n > 0) await navigator.setAppBadge(n);
      else if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
      else await navigator.setAppBadge(0);
    }
  } catch {}
  try { window.dispatchEvent(new CustomEvent("hw:inbox-changed", { detail: { unread: n } })); } catch {}
  return n;
}

/** Impor sekali Kotak Masuk lama (LS, AUD-NOTIF-01). */
export async function importLegacyInbox() {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return 0;
    const items = JSON.parse(raw) || [];
    let n = 0;
    for (const old of items) {
      const created = Date.parse(old.at) || Date.now();
      const item = {
        id: `legacy:${old.id || created}`,
        template: old.template || "system",
        category: old.category || "system",
        priority: old.category === "budget" ? "budget" : old.category === "habit" ? "habit" : "system",
        title: String(old.title || "HabitWealth").slice(0, 40),
        body: String(old.body || "").slice(0, 120),
        deep_link: old.deepLink || old.deep_link || "#/beranda",
        created_at: created,
        deliver_after: created,
        delivered_at: created,
        read_at: old.read ? created : null,
        archived_at: null,
        expires_at: created + 7 * 24 * 60 * 60 * 1000,
        channel: "legacy",
      };
      await idbPut(STORE, item);
      n++;
    }
    localStorage.removeItem(LEGACY_LS_KEY);
    return n;
  } catch {
    return 0;
  }
}

// ---------- trigger ----------
/** Ambang budget: panggil setelah transaksi pengeluaran. Sekali per kategori/bulan untuk 80 dan 100. */
export async function checkBudgetThresholds(category, month, { before, after } = {}) {
  const results = [];
  if (typeof before !== "number" || typeof after !== "number") return results;
  for (const [pct, tpl] of [[80, "budget_80"], [100, "budget_100"]]) {
    if (before < pct && after >= pct) {
      track("budget_threshold_hit", { category, pct, month }).catch(() => {});
      results.push(await notify(tpl, { category }, { scope: category, period: month }));
    }
  }
  return results;
}

/** Milestone streak: panggil setelah completeHabit. */
export async function checkStreakMilestone(habitId, streak) {
  if (streak === 7) return notify("streak_7", { habit_id: habitId }, { scope: habitId, period: "m7" });
  if (streak === 30) return notify("streak_30", { habit_id: habitId }, { scope: habitId, period: "m30" });
  return { created: false, reason: "NO_MILESTONE" };
}

function isoWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}

/**
 * Evaluasi pengingat berbasis waktu (dipanggil saat foreground/visibility/timer).
 * Tidak memanggil dialog sistem. Idempoten per hari/pekan lewat id.
 */
export async function evaluateTriggers(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const prefs = await getNotifPrefs();
  const p = partsInTZ(now, prefs.tz);
  const out = [];
  try {
    const { listHabits, listEntries } = await import("./habit.js");
    const habits = await listHabits().catch(() => []);
    if (habits.length) {
      let doneToday = 0;
      for (const h of habits) {
        const e = await listEntries(h.id, { from: p.date, to: p.date }).catch(() => []);
        if (e.some((x) => x.status === "done")) doneToday++;
      }
      if (p.minutes >= 7 * 60 && p.minutes < 18 * 60 && doneToday === 0) out.push(await notify("habit_morning", {}, { now, period: p.date, osAllowed: options.osAllowed }));
      if (p.minutes >= 18 * 60 && doneToday < habits.length) out.push(await notify("habit_evening", {}, { now, period: p.date, osAllowed: options.osAllowed }));
      if (p.weekday === "Mon" && p.minutes >= 8 * 60) out.push(await notify("weekly_summary", {}, { now, period: isoWeek(p.date), osAllowed: options.osAllowed }));
    }
  } catch (e) {
    console.warn("[notify] evaluate failed", e);
  }
  try { localStorage.setItem(LAST_EVAL_KEY, String(now.getTime())); } catch {}
  await partitionInbox(now.getTime()); // arsipkan yang kedaluwarsa
  refreshBadge().catch(() => {});
  return out.filter(Boolean);
}

/** Menit sampai batas evaluasi berikutnya (07:00, 08:00, 18:00, akhir jam tenang) — untuk setTimeout selagi halaman hidup. */
export function minutesToNextBoundary(now, prefs) {
  const p = partsInTZ(now, prefs.tz);
  const bounds = [7 * 60, 8 * 60, 18 * 60, hm(prefs.quietHours.end, 7 * 60)].sort((a, b) => a - b);
  for (const b of bounds) if (b > p.minutes) return b - p.minutes;
  return 24 * 60 - p.minutes + bounds[0];
}

let timer = null;
let inited = false;
export async function initNotify() {
  if (inited) return;
  inited = true;
  await importLegacyInbox();
  const schedule = async () => {
    clearTimeout(timer);
    try {
      const prefs = await getNotifPrefs();
      const mins = Math.max(1, Math.min(24 * 60, minutesToNextBoundary(new Date(), prefs)));
      timer = setTimeout(async () => {
        await evaluateTriggers({ osAllowed: true }).catch(() => {});
        schedule();
      }, mins * 60 * 1000 + 1000);
    } catch {}
  };
  await evaluateTriggers({ osAllowed: false }).catch(() => {});
  schedule();
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") evaluateTriggers({ osAllowed: false }).catch(() => {});
    });
    // Klik notifikasi OS (public/sw-notify.js) → tandai dibaca + route
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (ev) => {
        const d = ev.data || {};
        if (d.type === "hw:notification-click" && d.id) {
          markRead(d.id).catch(() => {});
          if (d.deepLink) location.hash = d.deepLink;
        }
      });
    }
  } catch {}
}

export function __resetForTests() {
  inited = false;
  clearTimeout(timer);
}

export const notifyApi = { TEMPLATES, PRIORITY, CATEGORY_COPY, notify, listInbox, partitionInbox, unreadCount, markRead, archive, markAllRead, removeItem, refreshBadge, getNotifPrefs, setNotifPref, isQuietNow, quietEndsAt, partsInTZ, checkBudgetThresholds, checkStreakMilestone, evaluateTriggers, minutesToNextBoundary, initNotify, importLegacyInbox, deviceTZ };
