// T11 — Insight deskriptif + Celengan virtual + undo 5 dtk + StreakCelebration (spec 10 amandemen, spec 05). happy-dom + fake-indexeddb.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const tracked = [];
vi.mock("../src/analytics.js", () => ({ track: vi.fn((name, props) => { tracked.push({ name, props }); return Promise.resolve(true); }), initAnalytics: vi.fn() }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(() => Promise.resolve()), playBlip: vi.fn() }));
vi.mock("../src/share.js", () => ({ shareStreakCard: vi.fn(() => Promise.resolve({ shared: true, via: "clipboard" })), shareReferralLink: vi.fn(), copyToClipboard: vi.fn() }));
vi.mock("../src/charts.js", () => ({
  renderRingProgress: vi.fn(), renderStreakDots: vi.fn(), renderHabitBar: vi.fn(() => Promise.resolve()), renderDonutCategory: vi.fn(() => Promise.resolve()),
  renderCashflowBar: vi.fn(() => Promise.resolve()), renderScatterIfNeeded: vi.fn(() => Promise.resolve(null)), tokenColor: () => "",
}));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const T0 = new Date(2026, 8, 19, 9, 0, 0); // 19 Sep 2026 09.00 lokal

function clockAt(d) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d);
}
function dstr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n, base = T0) {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return dstr(d);
}

async function fresh() {
  const { idbClear } = await import("../src/storage/db.js");
  for (const s of ["savings_goals", "habits", "habit_entries", "transactions", "budgets", "outbox", "kv", "inbox"]) await idbClear(s).catch(() => {});
  const prefs = await import("../src/storage/prefs.js");
  await prefs.setPrefs({ v: 2, tz: "Asia/Jakarta" });
  const money = await import("../src/money.js");
  money.clearReAuth();
  tracked.length = 0;
}

async function seedIncome(amount, date = daysAgo(1)) {
  const { idbPut } = await import("../src/storage/db.js");
  await idbPut("transactions", { id: `tx_in_${date}_${amount}`, kind: "income", amount, category: "Gaji", date, createdAt: Date.now(), updatedAt: Date.now() });
}
async function seedExpense(amount, date) {
  const { idbPut } = await import("../src/storage/db.js");
  await idbPut("transactions", { id: `tx_out_${date}_${Math.random().toString(36).slice(2, 6)}`, kind: "expense", amount, category: "Kopi", date, createdAt: Date.now(), updatedAt: Date.now() });
}
async function seedHabitDone(habitId, date) {
  const { idbPut } = await import("../src/storage/db.js");
  await idbPut("habit_entries", { id: `${habitId}_${date}`, habit_id: habitId, date, status: "done", source: "manual", createdAt: Date.now(), updatedAt: Date.now() });
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  clockAt(T0);
  await fresh();
});
afterEach(() => vi.useRealTimers());

describe("Celengan virtual — sub-ledger lokal, tanpa money movement", () => {
  it("createGoal: validasi nama/nominal, default Rp10.000, outbox POST /savings-goals, event goal_created hanya daily_bucket", async () => {
    const g = await import("../src/insight.js");
    expect((await g.createGoal({ name: "  " })).reason).toBe("NAME_REQUIRED");
    expect((await g.createGoal({ name: "Dana darurat", daily_amount: 0 })).reason).toBe("DAILY_INVALID");
    expect((await g.createGoal({ name: "Dana darurat", daily_amount: 10000, target_amount: 5000 })).reason).toBe("TARGET_INVALID");
    const r = await g.createGoal({ name: "Dana darurat" });
    expect(r.ok).toBe(true);
    expect(r.goal.daily_amount).toBe(g.GOAL_DEFAULT_DAILY);
    expect(r.goal.status).toBe("active");
    expect(g.goalTotal(r.goal)).toBe(0);
    const { listOutbox } = await import("../src/storage/outbox.js");
    const out = await listOutbox();
    expect(out.some((o) => o.op === "POST" && o.path === "/savings-goals" && o.body.daily_amount === 10000)).toBe(true);
    const ev = tracked.find((t) => t.name === "goal_created");
    expect(ev.props).toEqual({ daily_bucket: "10k" });
    expect(JSON.stringify(ev.props)).not.toMatch(/amount|Dana/);
  });

  it("allocateToday: saldo tercatat cukup → pending→done + outbox allocate; dedup 1×/hari; saldo kurang → INSUFFICIENT ramah tanpa entri", async () => {
    const g = await import("../src/insight.js");
    await seedIncome(25000);
    const { goal } = await g.createGoal({ name: "Liburan", daily_amount: 10000 });
    const bal0 = await g.getRecordedBalance();
    expect(bal0).toMatchObject({ income: 25000, expense: 0, net: 25000, goals: 0, available: 25000 });

    const r1 = await g.allocateToday(goal.id, { now: T0 });
    expect(r1.ok).toBe(true);
    expect(r1.entry).toMatchObject({ kind: "allocate", amount: 10000, date: "2026-09-19", status: "done" });
    expect(typeof r1.entry.done_at).toBe("number");
    expect(r1.undoUntil).toBe(T0.getTime() + g.UNDO_WINDOW_MS);
    const { listOutbox } = await import("../src/storage/outbox.js");
    const out = await listOutbox();
    const alloc = out.find((o) => o.path === `/savings-goals/${goal.id}/allocate`);
    expect(alloc.body).toEqual({ amount: 10000, date: "2026-09-19", entry_id: r1.entry.id });

    expect((await g.allocateToday(goal.id, { now: T0 })).reason).toBe("ALREADY_TODAY");
    expect((await g.getRecordedBalance()).available).toBe(15000);

    // Hari berikutnya: 10.000 → sisa 5.000; hari ketiga: tidak cukup → peringatan ramah, ledger tidak bertambah
    const d2 = new Date(T0); d2.setDate(d2.getDate() + 1);
    expect((await g.allocateToday(goal.id, { now: d2 })).ok).toBe(true);
    const d3 = new Date(T0); d3.setDate(d3.getDate() + 2);
    const r3 = await g.allocateToday(goal.id, { now: d3 });
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe("INSUFFICIENT");
    expect(r3.message).toBe(g.INSUFFICIENT_COPY);
    expect(r3.message).toMatch(/Streak habit-mu tetap aman/);
    const after = await g.getGoal(goal.id);
    expect(after.ledger.length).toBe(2);
    expect(g.goalTotal(after)).toBe(20000);
  });

  it("undoAllocation ≤5 dtk → undone + outbox pending dihapus; >5 dtk → UNDO_EXPIRED (harus lewat Tarik + re-auth)", async () => {
    const g = await import("../src/insight.js");
    await seedIncome(100000);
    const { goal } = await g.createGoal({ name: "Sepeda", daily_amount: 10000 });
    const r = await g.allocateToday(goal.id, { now: T0 });
    const { listOutbox } = await import("../src/storage/outbox.js");
    expect((await listOutbox()).some((o) => o.path.endsWith("/allocate"))).toBe(true);

    const u = await g.undoAllocation(goal.id, r.entry.id, { now: T0.getTime() + 4000 });
    expect(u.ok).toBe(true);
    expect(u.entry.status).toBe("undone");
    expect(g.goalTotal(u.goal)).toBe(0);
    const out = await listOutbox();
    expect(out.some((o) => o.path.endsWith("/allocate"))).toBe(false); // POST pending dibatalkan
    expect(out.some((o) => o.path.endsWith("/withdraw"))).toBe(false); // belum terkirim → tidak perlu withdraw
    expect((await g.undoAllocation(goal.id, r.entry.id, { now: T0.getTime() + 4500 })).reason).toBe("ALREADY_UNDONE");
    // setelah undo, hari yang sama boleh ditabung lagi (dedup mengabaikan entri undone)
    const r2 = await g.allocateToday(goal.id, { now: new Date(T0.getTime() + 60000) });
    expect(r2.ok).toBe(true);
    const late = await g.undoAllocation(goal.id, r2.entry.id, { now: T0.getTime() + 60000 + g.UNDO_WINDOW_MS + 1 });
    expect(late.reason).toBe("UNDO_EXPIRED");
    expect(g.goalTotal(await g.getGoal(goal.id))).toBe(10000);
  });

  it("withdrawFromGoal: tanpa re-auth → RE_AUTH_REQUIRED; dengan re-auth → catatan berkurang + outbox withdraw + goal_withdrawn{reason}; target tercapai → completed + goal_completed{days}", async () => {
    const g = await import("../src/insight.js");
    const money = await import("../src/money.js");
    await seedIncome(100000);
    const { goal } = await g.createGoal({ name: "Kado", daily_amount: 10000, target_amount: 20000 });
    await g.allocateToday(goal.id, { now: T0 });
    const d2 = new Date(T0); d2.setDate(d2.getDate() + 1);
    const r2 = await g.allocateToday(goal.id, { now: d2 });
    expect(r2.completed).toBe(true);
    expect(r2.goal.status).toBe("completed");
    const done = tracked.find((t) => t.name === "goal_completed");
    expect(done.props).toEqual({ days: 2 });

    expect((await g.withdrawFromGoal(goal.id, 5000)).reason).toBe("RE_AUTH_REQUIRED");
    await money.requestReAuth();
    expect((await g.withdrawFromGoal(goal.id, 999999)).reason).toBe("EXCEEDS_TOTAL");
    const w = await g.withdrawFromGoal(goal.id, 5000);
    expect(w.ok).toBe(true);
    expect(w.total).toBe(15000);
    const { listOutbox } = await import("../src/storage/outbox.js");
    const wd = (await listOutbox()).find((o) => o.path === `/savings-goals/${goal.id}/withdraw`);
    expect(wd.body).toMatchObject({ amount: 5000, reason: "user" });
    const ev = tracked.find((t) => t.name === "goal_withdrawn");
    expect(ev.props).toEqual({ reason: "user" });
    expect((await g.getRecordedBalance()).available).toBe(85000);
  });
});

describe("Insight deskriptif — di perangkat, opt-in OFF, ambang ≥7 hari per sisi, scatter ≥90 hari", () => {
  it("prefs default: optIn=false, sumber ON, hideSensitive=false, perayaan tidak pernah tampil", async () => {
    const g = await import("../src/insight.js");
    const p = await g.getInsightPrefs();
    expect(p).toEqual({ optIn: false, sources: { habits: true, transactions: true }, hideSensitive: false, celebrations: { never: false, shown: {} } });
  });

  it("computeInsight: 10 hari habit (Rp10.000) vs 10 hari tanpa (Rp20.000) → 50% lebih rendah, sedang; <7 hari per sisi → rendah tanpa narasi; 8 bucket mingguan; scatter belum siap (<90 hari)", async () => {
    const g = await import("../src/insight.js");
    const { idbPut } = await import("../src/storage/db.js");
    await idbPut("habits", { id: "h1", title: "Jalan pagi", category: "Sehat", streak: 0, createdAt: Date.now(), updatedAt: Date.now() });
    // 20 hari terakhir: genap = habit + Rp10.000; ganjil = tanpa habit + Rp20.000
    for (let i = 0; i < 20; i++) {
      const d = daysAgo(i);
      if (i % 2 === 0) { await seedHabitDone("h1", d); await seedExpense(10000, d); } else { await seedExpense(20000, d); }
    }
    const r = await g.computeInsight({ now: T0 });
    expect(r.optIn).toBe(false);
    expect(r.dataSpanDays).toBe(20);
    expect(r.stats).toMatchObject({ n1: 10, n2: 10, avgWith: 10000, avgWithout: 20000, diffPct: 50 });
    expect(r.confidence).toBe("sedang");
    expect(r.narrative).toMatch(/50% lebih rendah/);
    expect(r.weekly.length).toBe(8);
    const last = r.weekly[7];
    expect(last.to).toBe("2026-09-19");
    expect(last.habitDone).toBe(4); // hari ke-0,2,4,6
    expect(last.expense).toBe(4 * 10000 + 3 * 20000);
    expect(r.scatter.ready).toBe(false);
    expect(r.scatter.points.length).toBeGreaterThan(0);

    // sumber transaksi dimatikan → pengeluaran 0 → tidak ada perbedaan
    await g.setInsightPref("sources.transactions", false);
    const r2 = await g.computeInsight({ now: T0 });
    expect(r2.stats.avgWith).toBe(0);
    expect(r2.narrative).toMatch(/kurang lebih sama/);
    await g.setInsightPref("sources.transactions", true);

    // data tipis: hanya 4 hari → rendah, narasi null
    await fresh();
    await idbPut("habits", { id: "h1", title: "Jalan pagi", category: "Sehat", streak: 0, createdAt: Date.now(), updatedAt: Date.now() });
    for (let i = 0; i < 4; i++) { if (i % 2 === 0) await seedHabitDone("h1", daysAgo(i)); await seedExpense(5000, daysAgo(i)); }
    const r3 = await g.computeInsight({ now: T0 });
    expect(r3.confidence).toBe("rendah");
    expect(r3.narrative).toBeNull();
  });

  it("scatter siap bila rentang ≥90 hari dan ≥3 bulan; titik = streak maks bulanan × jumlah transaksi pengeluaran", async () => {
    const g = await import("../src/insight.js");
    const { idbPut } = await import("../src/storage/db.js");
    await idbPut("habits", { id: "h1", title: "Baca", category: "Belajar", streak: 0, createdAt: Date.now(), updatedAt: Date.now() });
    for (let i = 0; i < 100; i += 3) await seedExpense(7000, daysAgo(i));
    for (let i = 0; i < 5; i++) await seedHabitDone("h1", daysAgo(i)); // streak 5 hari di September
    const r = await g.computeInsight({ now: T0 });
    expect(r.dataSpanDays).toBe(100);
    expect(r.scatter.ready).toBe(true);
    const sep = r.scatter.points.find((p) => p.month === "2026-09");
    expect(sep.streak).toBe(5);
    expect(sep.impulsive).toBeGreaterThan(0);
  });
});

describe("Layar #/insight + perayaan", () => {
  it("Opt-in OFF → InsightSetup tanpa angka (sumber, di perangkat, korelasi≠sebab, cara mematikan); Aktifkan → ringkasan + confidence + 'Kenapa' + tabel SR + insight_viewed", async () => {
    const { Insight } = await import("../src/views-insight.jsx");
    const root = document.getElementById("app");
    location.hash = "#/insight";
    Insight(root, {});
    await tick(50);
    expect(root.querySelector(".insight-setup")).toBeTruthy();
    expect(root.querySelector("#insight-narrative")).toBeNull();
    expect(root.textContent).toMatch(/di perangkat/i);
    expect(root.textContent).toMatch(/Korelasi ≠ sebab-akibat/);
    expect(root.textContent).toMatch(/Bisa dimatikan kapan saja/);
    expect(root.textContent).toMatch(/Dana di celengan masih berada di rekeningmu/);
    expect(root.querySelector("#insight-src-habits").getAttribute("role")).toBe("switch");
    expect(root.querySelector("#insight-hide-sensitive").checked).toBe(false);
    // Setup tidak menampilkan angka rupiah insight (saldo tercatat pada celengan dimasking)
    expect(root.querySelector(".insight-section").textContent).not.toMatch(/Rp[1-9]/); // "Rp0" hanya penjelasan data hilang
    expect(tracked.find((t) => t.name === "insight_viewed")).toBeUndefined();

    root.querySelector("#insight-activate").click();
    await tick(80);
    const g = await import("../src/insight.js");
    expect((await g.getInsightPrefs()).optIn).toBe(true);
    expect(root.querySelector("#insight-optin").checked).toBe(true);
    expect(root.querySelector("#insight-confidence").textContent).toMatch(/Keyakinan: rendah/);
    expect(root.querySelector(".insight-narrative .empty-state").textContent).toMatch(/≥7 hari/);
    expect(root.querySelector(".insight-weekly table.sr-only tbody").children.length).toBe(8);
    expect(root.querySelectorAll(".insight-bar-row progress").length).toBe(16);
    expect(root.querySelector(".insight-scatter .placeholder").textContent).toMatch(/≥90 hari/);
    expect([...root.querySelectorAll("button")].some((b) => b.textContent === "Kenapa saya melihat ini?")).toBe(true);
    const ev = tracked.find((t) => t.name === "insight_viewed");
    expect(ev.props).toEqual({ period: "90d", has_scatter: false, confidence: "rendah" });

    // matikan lagi → kembali ke setup
    const sw = root.querySelector("#insight-optin");
    sw.click();
    await tick(80);
    expect((await g.getInsightPrefs()).optIn).toBe(false);
    expect(root.querySelector(".insight-setup")).toBeTruthy();
  });

  it("Celengan di layar: buat lewat sheet → kartu; 'Tabung hari ini' → Diproses… → Berhasil ✓ + toast 'Batalkan' 5 dtk → entri undone; saldo kurang → peringatan ramah (bukan error)", async () => {
    await seedIncome(15000);
    const { Insight } = await import("../src/views-insight.jsx");
    const g = await import("../src/insight.js");
    const root = document.getElementById("app");
    Insight(root, {});
    await tick(50);
    expect(root.querySelector(".goals-section .empty-state")).toBeTruthy();
    [...root.querySelectorAll("button")].find((b) => b.textContent === "+ Buat celengan").click();
    await tick(30);
    const sheet = document.getElementById("goal-create-sheet");
    expect(sheet).toBeTruthy();
    expect(sheet.querySelector("#goal-daily").value).toBe("10000");
    // nama kosong → error field, sheet tetap terbuka
    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Simpan").click();
    await tick(30);
    expect(sheet.querySelector("#goal-name-error").hidden).toBe(false);
    sheet.querySelector("#goal-name").value = "Dana darurat";
    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Simpan").click();
    await tick(400);
    const card = root.querySelector(".goal-card");
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/Dana darurat/);
    expect(card.textContent).toMatch(/Rp10\.000\/hari/);
    expect(card.textContent).toMatch(/Terkumpul: Rp••••••/); // dimasking tanpa re-auth

    const save = card.querySelector(".goal-allocate");
    save.click();
    await tick(60);
    const goals = await g.listGoals();
    expect(goals[0].ledger[0].status).toBe("done");
    expect(card.querySelector(".goal-today").textContent).toMatch(/^Berhasil ✓ \d\d\.\d\d/);
    const toast = document.getElementById("hw-toast");
    expect(toast.textContent).toMatch(/Rp10\.000 masuk celengan ✓/);
    const undoBtn = toast.querySelector(".toast-action");
    expect(undoBtn.textContent).toBe("Batalkan");
    undoBtn.click();
    await tick(60);
    const after = await g.listGoals();
    expect(after[0].ledger[0].status).toBe("undone");
    expect(g.goalTotal(after[0])).toBe(0);

    // Saldo tercatat 15.000 − (tidak ada) → tabung 10.000 OK; lalu ubah skenario: saldo kurang → peringatan ramah
    await tick(60);
    const card2 = root.querySelector(".goal-card");
    card2.querySelector(".goal-allocate").click();
    await tick(60);
    expect(g.goalTotal((await g.listGoals())[0])).toBe(10000);
    // Hari berikutnya dengan sisa 5.000 → INSUFFICIENT: notice warning, tanpa entri baru
    const d2 = new Date(T0); d2.setDate(d2.getDate() + 1); vi.setSystemTime(d2);
    root.querySelectorAll(".page").forEach((p) => p.remove());
    Insight(root, {});
    await tick(60);
    const card3 = root.querySelector(".goal-card");
    card3.querySelector(".goal-allocate").click();
    await tick(60);
    const n = card3.querySelector(".notice");
    expect(n.dataset.tone).toBe("warning");
    expect(n.textContent).toMatch(/Streak habit-mu tetap aman/);
    expect((await g.listGoals())[0].ledger.filter((e) => e.status !== "undone").length).toBe(1);
    expect(card3.querySelector(".goal-allocate").disabled).toBe(false);
  });

  it("StreakCelebration: hanya milestone 7/30/100, 1× per habit per milestone, tanpa nominal di share, event tanpa judul habit, 'Jangan tampilkan lagi' mematikan semua", async () => {
    const g = await import("../src/insight.js");
    const v = await import("../src/views-insight.jsx");
    const share = await import("../src/share.js");
    expect(await g.celebrationAllowed("h1", 6)).toBe(false);
    expect(await g.celebrationAllowed("h1", 7)).toBe(true);

    expect(await v.maybeCelebrate({ habitId: "h1", streak: 7, habitTitle: "Jalan pagi" })).toBe(true);
    await tick(40);
    const sheet = document.getElementById("celebrate-sheet");
    expect(sheet).toBeTruthy();
    expect(sheet.querySelector(".celebrate")).toBeTruthy();
    expect(sheet.querySelector(".sheet-title").textContent).toMatch(/7 hari berturut-turut/);
    expect(sheet.textContent).not.toMatch(/Rp\d/);
    const { vibrate } = await import("../src/feedback.js");
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith("success");

    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Bagikan").click();
    await tick(30);
    expect(share.shareStreakCard).toHaveBeenCalledWith({ streakDays: 7 });
    expect(document.getElementById("celebrate-sheet")).toBeTruthy(); // tetap terbuka
    expect(tracked.find((t) => t.name === "celebration_shared").props).toEqual({ streak_day: 7 });

    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Tutup").click();
    await tick(300);
    expect(document.getElementById("celebrate-sheet")).toBeNull();
    const dismissed = tracked.filter((t) => t.name === "celebration_dismissed");
    expect(dismissed.length).toBe(1);
    expect(dismissed[0].props).toEqual({ streak_day: 7, never_again: false });
    expect(JSON.stringify(tracked)).not.toMatch(/Jalan pagi/);

    // rate-limit: milestone yang sama tidak tampil lagi; milestone lain masih boleh
    expect(await v.maybeCelebrate({ habitId: "h1", streak: 7, habitTitle: "Jalan pagi" })).toBe(false);
    expect(await g.celebrationAllowed("h1", 30)).toBe(true);
    expect(await g.celebrationAllowed("h2", 7)).toBe(true);

    // Jangan tampilkan lagi
    expect(await v.maybeCelebrate({ habitId: "h2", streak: 7, habitTitle: "Minum air" })).toBe(true);
    await tick(40);
    const s2 = document.getElementById("celebrate-sheet");
    [...s2.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Jangan tampilkan lagi").click();
    await tick(300);
    expect((await g.getInsightPrefs()).celebrations.never).toBe(true);
    expect(tracked.filter((t) => t.name === "celebration_dismissed").pop().props).toEqual({ streak_day: 7, never_again: true });
    expect(await g.celebrationAllowed("h3", 100)).toBe(false);
  });

  it("Statik: views-insight/ui switchRow token-only (tanpa hex/inline style/alert/confirm); allowlist event T11 sama di klien dan 3 endpoint PHP; struktur .switch seragam", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/views-insight.jsx"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(src.match(/\.style\.[a-zA-Z]+\s*=/g)).toBeNull();
    expect(src).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(/);
    expect(src).not.toMatch(/location\.reload\(\)/);
    const notify = fs.readFileSync(path.resolve(__dirname, "../src/views-notify.jsx"), "utf8");
    expect(notify).not.toMatch(/switch-knob/);
    expect(notify).toMatch(/switchRow \} from "\.\/ui\.js"|switchRow, /);
    const ui = fs.readFileSync(path.resolve(__dirname, "../src/ui.js"), "utf8");
    expect(ui).toMatch(/export function switchRow/);
    expect(ui).toMatch(/className = "track"/);
    expect(ui).toMatch(/className = "thumb"/);

    const events = ["insight_viewed", "goal_created", "goal_completed", "goal_withdrawn", "celebration_shared", "celebration_dismissed"];
    const client = fs.readFileSync(path.resolve(__dirname, "../src/analytics.js"), "utf8");
    for (const f of ["../public_html/api/v1/analytics.php", "../public_html/api/v1/index.php", "../public_html/api/v1/reports.php"]) {
      const php = fs.readFileSync(path.resolve(__dirname, f), "utf8");
      for (const e of events) {
        expect(client).toContain(`"${e}"`);
        expect(php).toContain(`'${e}'`);
      }
    }
  });
});
