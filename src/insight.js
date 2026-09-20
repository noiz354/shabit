/**
 * HabitWealth — T11 Insight deskriptif + Celengan virtual (spec 10 amandemen 19 Sep 2026)
 * Engine murni data (tanpa DOM). Chunk lazy: hanya dimuat dari #/insight, Uang › Saldo, dan HabitToday (perayaan).
 *
 * Guardrail keras (AGENTS.md / spec 10):
 *  - TIDAK ADA money movement: "alokasi"/"tarik" = catatan sub-ledger lokal + outbox POST yang di server pun hanya dicatat.
 *  - Insight dihitung DI PERANGKAT, opt-in default OFF, korelasi ≠ sebab-akibat, ambang ≥7 hari per sisi.
 *  - Event analytics TANPA nominal/judul habit (spec 05: insight_viewed, goal_*, celebration_*).
 *  - Undo alokasi hanya ≤5 detik (UNDO_WINDOW_MS); setelah itu ditolak (UNDO_EXPIRED) — tarik lewat re-auth.
 */

import { idbGet, idbGetAll, idbPut } from "./storage/db.js";
import { getPrefs, updatePrefs } from "./storage/prefs.js";
import { enqueue, listOutbox, removeFromOutbox } from "./storage/outbox.js";
import { listTransactions, getManualBalance, isReAuthed } from "./money.js";
import { listHabits, listEntries } from "./habit.js";
import { track } from "./analytics.js";

export const GOALS_STORE = "savings_goals";
export const GOAL_DEFAULT_DAILY = 10000; // Rp10.000 (spec 10) — dapat diatur per celengan
export const UNDO_WINDOW_MS = 5000; // spec 10: "Batalkan" 5 detik
export const MILESTONES = [7, 30, 100];
export const MIN_DAYS_PER_SIDE = 7; // narasi hanya bila ≥7 hari di tiap sisi
export const SCATTER_MIN_SPAN_DAYS = 90;
export const INSIGHT_WINDOW_DAYS = 90;
export const WEEKLY_BUCKETS = 8;
export const DEFAULT_SOURCE_REF = "Rekening manual";

export const LEGAL_COPY = "Dana di celengan masih berada di rekeningmu. HabitWealth tidak menyimpan/memindahkan uangmu ke pihak ketiga.";
export const INSUFFICIENT_COPY = "Saldo tercatat tidak cukup untuk hari ini. Streak habit-mu tetap aman!";
export const CORRELATION_COPY = "Korelasi ≠ sebab-akibat. Ini ringkasan deskriptif dari catatanmu sendiri, bukan nasihat keuangan.";

const DEFAULT_INSIGHT_PREFS = {
  optIn: false,
  sources: { habits: true, transactions: true },
  hideSensitive: false,
  celebrations: { never: false, shown: {} },
};

// ---------- util tanggal (lokal, tanpa tz server) ----------
export function localDateStr(d = new Date()) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDate(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const x = new Date(y, m - 1, d + deltaDays);
  return localDateStr(x);
}

export function daysBetween(fromStr, toStr) {
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- prefs ----------
export async function getInsightPrefs() {
  const p = await getPrefs();
  const raw = (p && p.insights) || {};
  return {
    ...DEFAULT_INSIGHT_PREFS,
    ...raw,
    sources: { ...DEFAULT_INSIGHT_PREFS.sources, ...(raw.sources || {}) },
    celebrations: { ...DEFAULT_INSIGHT_PREFS.celebrations, ...(raw.celebrations || {}), shown: { ...((raw.celebrations && raw.celebrations.shown) || {}) } },
  };
}

export async function setInsightPref(path, value) {
  return updatePrefs(`insights.${path}`, value);
}

// ---------- celengan virtual (sub-ledger lokal) ----------
export function goalTotal(goal) {
  if (!goal || !Array.isArray(goal.ledger)) return 0;
  let total = 0;
  for (const e of goal.ledger) {
    if (e.status !== "done") continue;
    if (e.kind === "allocate") total += e.amount;
    else if (e.kind === "withdraw") total -= e.amount;
  }
  return Math.max(0, total);
}

export function dailyBucket(amount) {
  const n = Number(amount) || 0;
  if (n < 10000) return "lt10k";
  if (n === 10000) return "10k";
  if (n <= 50000) return "10k_50k";
  return "gt50k";
}

export async function listGoals() {
  try {
    const all = await idbGetAll(GOALS_STORE, null, undefined, 200);
    return all.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  } catch {
    return [];
  }
}

export async function getGoal(id) {
  try {
    return (await idbGet(GOALS_STORE, id)) || null;
  } catch {
    return null;
  }
}

export async function getGoalsTotal() {
  const goals = await listGoals();
  return goals.reduce((acc, g) => acc + goalTotal(g), 0);
}

/**
 * Buat celengan. Server (spec 18): POST /savings-goals {name, daily_amount>=1, source_ref}.
 * @returns {Promise<{ok:boolean, goal?:object, reason?:string}>}
 */
export async function createGoal({ name, daily_amount = GOAL_DEFAULT_DAILY, source_ref = DEFAULT_SOURCE_REF, target_amount = null } = {}) {
  const cleanName = String(name || "").trim().slice(0, 100);
  if (!cleanName) return { ok: false, reason: "NAME_REQUIRED" };
  const daily = parseInt(daily_amount, 10);
  if (!Number.isFinite(daily) || daily < 1) return { ok: false, reason: "DAILY_INVALID" };
  let target = target_amount === null || target_amount === undefined || target_amount === "" ? null : parseInt(target_amount, 10);
  if (target !== null && (!Number.isFinite(target) || target < daily)) return { ok: false, reason: "TARGET_INVALID" };
  const now = Date.now();
  const goal = {
    id: newId("goal"),
    name: cleanName,
    daily_amount: daily,
    source_ref: String(source_ref || DEFAULT_SOURCE_REF).slice(0, 50),
    target_amount: target,
    status: "active",
    ledger: [],
    created_at: now,
    updated_at: now,
  };
  await idbPut(GOALS_STORE, goal);
  try {
    await enqueue("POST", "/savings-goals", { id: goal.id, name: goal.name, daily_amount: goal.daily_amount, source_ref: goal.source_ref, target_amount: goal.target_amount });
  } catch {}
  track("goal_created", { daily_bucket: dailyBucket(daily) }).catch(() => {});
  return { ok: true, goal };
}

/**
 * Saldo tercatat (manual): Σ pemasukan − Σ pengeluaran (semua waktu) − netto celengan.
 * Bukan saldo bank; hanya dari catatan pengguna sendiri.
 */
export async function getRecordedBalance() {
  const base = await getManualBalance();
  const goals = await getGoalsTotal();
  return { ...base, goals, available: base.net - goals };
}

export function hasAllocationOn(goal, dateStr) {
  return !!(goal && Array.isArray(goal.ledger) && goal.ledger.some((e) => e.kind === "allocate" && e.date === dateStr && e.status !== "undone"));
}

/**
 * "Tabung hari ini": 1× per hari per celengan; pending → done (foreground); outbox POST allocate.
 * Saldo tercatat kurang → {ok:false, reason:"INSUFFICIENT", message} (peringatan ramah, bukan error).
 */
export async function allocateToday(goalId, { now = new Date(), amount } = {}) {
  const goal = await getGoal(goalId);
  if (!goal) return { ok: false, reason: "NOT_FOUND" };
  if (goal.status !== "active") return { ok: false, reason: "NOT_ACTIVE" };
  const date = localDateStr(now);
  if (hasAllocationOn(goal, date)) return { ok: false, reason: "ALREADY_TODAY" };
  const amt = parseInt(amount || goal.daily_amount, 10);
  if (!Number.isFinite(amt) || amt < 1) return { ok: false, reason: "AMOUNT_INVALID" };
  const balance = await getRecordedBalance();
  if (balance.available < amt) return { ok: false, reason: "INSUFFICIENT", message: INSUFFICIENT_COPY, balance };

  const at = now instanceof Date ? now.getTime() : Number(now);
  const entry = { id: newId("alloc"), kind: "allocate", amount: amt, date, at, status: "pending" };
  goal.ledger = Array.isArray(goal.ledger) ? goal.ledger : [];
  goal.ledger.push(entry);
  goal.updated_at = at;
  await idbPut(GOALS_STORE, goal);

  try {
    const out = await enqueue("POST", `/savings-goals/${goalId}/allocate`, { amount: amt, date, entry_id: entry.id });
    if (out && out.id) entry.outbox_id = out.id;
  } catch {}

  entry.status = "done";
  entry.done_at = Date.now();
  let completed = false;
  if (goal.target_amount && goalTotal(goal) >= goal.target_amount) {
    goal.status = "completed";
    goal.completed_at = Date.now();
    completed = true;
  }
  goal.updated_at = Date.now();
  await idbPut(GOALS_STORE, goal);
  if (completed) track("goal_completed", { days: Math.max(1, daysBetween(localDateStr(new Date(goal.created_at)), date) + 1) }).catch(() => {});
  return { ok: true, entry, goal, completed, undoUntil: at + UNDO_WINDOW_MS };
}

/**
 * Batalkan alokasi ≤5 detik: entri → undone; outbox pending dihapus, atau (bila sudah terkirim) antre withdraw{reason:"undo"}.
 */
export async function undoAllocation(goalId, entryId, { now = Date.now() } = {}) {
  const goal = await getGoal(goalId);
  if (!goal) return { ok: false, reason: "NOT_FOUND" };
  const entry = (goal.ledger || []).find((e) => e.id === entryId && e.kind === "allocate");
  if (!entry) return { ok: false, reason: "NOT_FOUND" };
  if (entry.status === "undone") return { ok: false, reason: "ALREADY_UNDONE" };
  if (now - entry.at > UNDO_WINDOW_MS) return { ok: false, reason: "UNDO_EXPIRED" };

  entry.status = "undone";
  entry.undone_at = now;
  if (goal.status === "completed" && goal.target_amount && goalTotal(goal) < goal.target_amount) {
    goal.status = "active";
    delete goal.completed_at;
  }
  goal.updated_at = now;
  await idbPut(GOALS_STORE, goal);

  try {
    const items = await listOutbox();
    const queued = entry.outbox_id ? items.find((o) => o.id === entry.outbox_id) : null;
    if (queued && queued.status === "pending") {
      await removeFromOutbox(queued.id);
    } else {
      await enqueue("POST", `/savings-goals/${goalId}/withdraw`, { amount: entry.amount, reason: "undo", entry_id: entry.id });
    }
  } catch {}
  return { ok: true, entry, goal };
}

/**
 * Tarik dari celengan (catatan, bukan transfer). Wajib re-auth (sesi 5 menit) — spec 09/10.
 */
export async function withdrawFromGoal(goalId, amount, { reason = "user", now = new Date() } = {}) {
  if (!isReAuthed()) return { ok: false, reason: "RE_AUTH_REQUIRED" };
  const goal = await getGoal(goalId);
  if (!goal) return { ok: false, reason: "NOT_FOUND" };
  const amt = parseInt(amount, 10);
  if (!Number.isFinite(amt) || amt < 1) return { ok: false, reason: "AMOUNT_INVALID" };
  const total = goalTotal(goal);
  if (amt > total) return { ok: false, reason: "EXCEEDS_TOTAL", total };
  const at = now instanceof Date ? now.getTime() : Number(now);
  const entry = { id: newId("wd"), kind: "withdraw", amount: amt, date: localDateStr(now), at, status: "done", done_at: at, reason };
  goal.ledger = Array.isArray(goal.ledger) ? goal.ledger : [];
  goal.ledger.push(entry);
  goal.updated_at = at;
  await idbPut(GOALS_STORE, goal);
  try {
    await enqueue("POST", `/savings-goals/${goalId}/withdraw`, { amount: amt, reason, entry_id: entry.id });
  } catch {}
  track("goal_withdrawn", { reason }).catch(() => {});
  return { ok: true, entry, goal, total: goalTotal(goal) };
}

// ---------- insight deskriptif (di perangkat) ----------
function longestRun(datesSet, monthPrefix) {
  // streak terpanjang (hari berurutan dengan ≥1 habit selesai) dalam satu bulan
  const days = [...datesSet].filter((d) => d.startsWith(monthPrefix)).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * Hitung insight dari IDB (habit entries + transaksi manual). Tanpa efek samping (tidak track).
 * @param {{now?:Date}} o
 */
export async function computeInsight({ now = new Date() } = {}) {
  const prefs = await getInsightPrefs();
  const today = localDateStr(now);
  const windowFrom = shiftDate(today, -(INSIGHT_WINDOW_DAYS - 1));

  // Sumber: habit (semua entri done) + transaksi (semua waktu) — dihitung sekali
  const doneByDate = new Map(); // date → jumlah habit selesai
  let firstDate = null;
  if (prefs.sources.habits) {
    const habits = await listHabits().catch(() => []);
    for (const h of habits) {
      const entries = await listEntries(h.id).catch(() => []);
      for (const e of entries) {
        if (e.status !== "done" || !e.date) continue;
        doneByDate.set(e.date, (doneByDate.get(e.date) || 0) + 1);
        if (!firstDate || e.date < firstDate) firstDate = e.date;
      }
    }
  }
  const expenseByDate = new Map();
  const expenseCountByMonth = new Map();
  if (prefs.sources.transactions) {
    const txs = await listTransactions().catch(() => []);
    for (const t of txs) {
      if (!t.date) continue;
      if (!firstDate || t.date < firstDate) firstDate = t.date;
      if (t.kind !== "expense") continue;
      expenseByDate.set(t.date, (expenseByDate.get(t.date) || 0) + (Number(t.amount) || 0));
      const mo = t.date.slice(0, 7);
      expenseCountByMonth.set(mo, (expenseCountByMonth.get(mo) || 0) + 1);
    }
  }
  const dataSpanDays = firstDate && firstDate <= today ? daysBetween(firstDate, today) + 1 : 0;

  // Narasi: rata-rata pengeluaran harian, hari dengan ≥1 habit vs tanpa (90 hari, hanya sejak data pertama)
  const start = firstDate && firstDate > windowFrom ? firstDate : windowFrom;
  let n1 = 0, n2 = 0, sum1 = 0, sum2 = 0;
  if (firstDate) {
    for (let d = start; d <= today; d = shiftDate(d, 1)) {
      const spent = expenseByDate.get(d) || 0; // hari tanpa catatan = Rp0 (diungkap di "Kenapa")
      if ((doneByDate.get(d) || 0) > 0) { n1 += 1; sum1 += spent; } else { n2 += 1; sum2 += spent; }
    }
  }
  const minSide = Math.min(n1, n2);
  const confidence = minSide < MIN_DAYS_PER_SIDE ? "rendah" : minSide < 21 ? "sedang" : "cukup";
  const avgWith = n1 ? Math.round(sum1 / n1) : 0;
  const avgWithout = n2 ? Math.round(sum2 / n2) : 0;
  let diffPct = 0;
  if (avgWithout > 0) diffPct = Math.round(((avgWithout - avgWith) / avgWithout) * 100);
  else if (avgWith > 0) diffPct = -100;
  let narrative = null;
  if (confidence !== "rendah") {
    const tail = `(${n1} hari dengan habit vs ${n2} hari tanpa, ${INSIGHT_WINDOW_DAYS} hari terakhir)`;
    if (diffPct > 0) narrative = `Di hari kamu menyelesaikan habit, pengeluaran rata-rata ${diffPct}% lebih rendah dibanding hari tanpa habit ${tail}.`;
    else if (diffPct < 0) narrative = `Di hari kamu menyelesaikan habit, pengeluaran rata-rata ${Math.abs(diffPct)}% lebih tinggi dibanding hari tanpa habit ${tail}.`;
    else narrative = `Pengeluaran rata-rata harianmu kurang lebih sama di hari dengan dan tanpa habit ${tail}.`;
  }

  // Bar mingguan: 8 jendela 7 hari yang berakhir hari ini
  const weekly = [];
  for (let w = WEEKLY_BUCKETS - 1; w >= 0; w--) {
    const to = shiftDate(today, -(w * 7));
    const from = shiftDate(to, -6);
    let habitDone = 0, expense = 0;
    for (let d = from; d <= to; d = shiftDate(d, 1)) {
      habitDone += doneByDate.get(d) || 0;
      expense += expenseByDate.get(d) || 0;
    }
    weekly.push({ from, to, label: `${from.slice(8)}/${from.slice(5, 7)}`, habitDone, expense });
  }

  // Scatter bulanan (hanya bila rentang ≥90 hari): X = streak maks bulan itu, Y = jumlah transaksi pengeluaran (proxy "impulsif")
  const months = new Set([...expenseCountByMonth.keys(), ...[...doneByDate.keys()].map((d) => d.slice(0, 7))]);
  const doneDates = new Set(doneByDate.keys());
  const points = [...months].sort().map((mo) => ({ month: mo, streak: longestRun(doneDates, mo), impulsive: expenseCountByMonth.get(mo) || 0 }));
  const scatterReady = dataSpanDays >= SCATTER_MIN_SPAN_DAYS && points.length >= 3;

  return {
    optIn: prefs.optIn,
    hideSensitive: prefs.hideSensitive,
    sources: prefs.sources,
    today,
    firstDate,
    dataSpanDays,
    confidence,
    narrative,
    stats: { n1, n2, avgWith, avgWithout, diffPct },
    weekly,
    scatter: { ready: scatterReady, points, minSpanDays: SCATTER_MIN_SPAN_DAYS },
  };
}

// ---------- perayaan streak (rate-limit 1× per habit per milestone) ----------
export async function celebrationAllowed(habitId, streak) {
  if (!MILESTONES.includes(Number(streak))) return false;
  const prefs = await getInsightPrefs();
  if (prefs.celebrations.never) return false;
  return !prefs.celebrations.shown[`${habitId}:${streak}`];
}

export async function markCelebrationShown(habitId, streak) {
  const prefs = await getInsightPrefs();
  const shown = { ...prefs.celebrations.shown, [`${habitId}:${streak}`]: Date.now() };
  return updatePrefs("insights.celebrations.shown", shown);
}

export async function setCelebrationsNever(never = true) {
  return updatePrefs("insights.celebrations.never", !!never);
}

export const insight = {
  getInsightPrefs, setInsightPref, listGoals, getGoal, createGoal, goalTotal, getGoalsTotal, getRecordedBalance,
  allocateToday, undoAllocation, withdrawFromGoal, computeInsight, celebrationAllowed, markCelebrationShown, setCelebrationsNever,
};
