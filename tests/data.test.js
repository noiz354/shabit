// T13 lanjutan — undo habit, filter/sort transaksi, budget 80/100, export/delete/wipe butuh re-auth,
// drain outbox tanpa duplikat (idempotency key stabil), search ranking + history
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/analytics.js", () => ({ track: vi.fn(() => Promise.resolve(true)) }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(), playBlip: vi.fn() }));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function clearStores(names) {
  const { idbClear } = await import("../src/storage/db.js");
  for (const n of names) await idbClear(n).catch(() => {});
}

describe("Habit — undo + streak (spec 08)", () => {
  beforeEach(async () => clearStores(["habits", "habit_entries", "outbox"]));
  it("complete menaikkan streak + entry; undo menurunkan + menghapus entry; outbox berisi POST lalu DELETE", async () => {
    const h = await import("../src/habit.js");
    const { listOutbox } = await import("../src/storage/outbox.js");
    const habit = await h.createHabit({ title: "Minum air", goal_type: "check" });
    await h.completeHabit(habit.id, "2026-09-19");
    expect((await h.getHabit(habit.id)).streak).toBe(1);
    expect((await h.listEntries(habit.id))).toHaveLength(1);
    await h.undoComplete(habit.id, "2026-09-19");
    expect((await h.getHabit(habit.id)).streak).toBe(0);
    expect((await h.listEntries(habit.id))).toHaveLength(0);
    const ops = (await listOutbox()).map((o) => `${o.op} ${o.path}`);
    expect(ops).toContain("POST /habits");
    expect(ops).toContain("POST /habit-entries");
    expect(ops.some((o) => o.startsWith("DELETE /habit-entries/"))).toBe(true);
  });
  it("updateHabit/deleteHabit + template 3 buah dengan judul spec 08", async () => {
    const h = await import("../src/habit.js");
    expect(h.getTemplates().map((t) => t.title)).toEqual(["Minum 8 gelas air", "Jalan 10.000 langkah", "Baca 20 halaman"]);
    const habit = await h.createHabit(h.getTemplates()[0]);
    const up = await h.updateHabit(habit.id, { title: "Minum 9 gelas" });
    expect(up.title).toBe("Minum 9 gelas");
    await h.deleteHabit(habit.id);
    expect(await h.getHabit(habit.id)).toBeFalsy();
  });
});

describe("Uang — filter/sort/q + budget 80%/100% (spec 09)", () => {
  beforeEach(async () => clearStores(["transactions", "budgets", "outbox"]));
  it("listTransactions: from/to, cat, q (angka tanpa titik), sort amount asc", async () => {
    const m = await import("../src/money.js");
    await m.createTransaction({ kind: "expense", amount: 25000, category: "Kopi", date: "2026-09-01", note: "kopi susu" });
    await m.createTransaction({ kind: "expense", amount: 150000, category: "Listrik", date: "2026-09-10" });
    await m.createTransaction({ kind: "income", amount: 5000000, category: "Gaji", date: "2026-08-28" });
    expect((await m.listTransactions({ from: "2026-09-01", to: "2026-09-30" }))).toHaveLength(2);
    expect((await m.listTransactions({ cat: "Kopi" }))[0].category).toBe("Kopi");
    expect((await m.listTransactions({ q: "25.000" }))).toHaveLength(1);
    expect((await m.listTransactions({ q: "susu" }))[0].note).toBe("kopi susu");
    const asc = await m.listTransactions({ sort: "amount", order: "asc" });
    expect(asc.map((t) => t.amount)).toEqual([25000, 150000, 5000000]);
    const desc = await m.listTransactions({});
    expect(desc[0].date).toBe("2026-09-10"); // default terbaru dulu
  });
  it("getBudgetStatus: ok <80, warning ≥80, over ≥100; account_ref default dimasking", async () => {
    const m = await import("../src/money.js");
    const month = "2026-09";
    await m.setBudget("Kopi", 100000, month);
    await m.setBudget("Makan", 100000, month);
    await m.setBudget("Transport", 100000, month);
    const tx = await m.createTransaction({ kind: "expense", amount: 50000, category: "Kopi", date: `${month}-02` });
    expect(tx.account_ref).toMatch(/••••/);
    await m.createTransaction({ kind: "expense", amount: 85000, category: "Makan", date: `${month}-03` });
    await m.createTransaction({ kind: "expense", amount: 120000, category: "Transport", date: `${month}-04` });
    const st = Object.fromEntries((await m.getBudgetStatus(month)).map((b) => [b.category, b]));
    expect(st.Kopi.status).toBe("ok");
    expect(st.Makan).toMatchObject({ status: "warning", pct: 85 });
    expect(st.Transport).toMatchObject({ status: "over", pct: 120 });
  });
  it("getTransaction/deleteTransaction + clearReAuth", async () => {
    const m = await import("../src/money.js");
    const tx = await m.createTransaction({ amount: 1000, category: "X" });
    expect((await m.getTransaction(tx.id)).id).toBe(tx.id);
    await m.deleteTransaction(tx.id);
    expect(await m.getTransaction(tx.id)).toBeFalsy();
    await m.requestReAuth();
    expect(m.isReAuthed()).toBe(true);
    m.clearReAuth();
    expect(m.isReAuthed()).toBeFalsy();
    expect(localStorage.getItem("hw:re-auth:expires")).toBeNull();
  });
});

describe("Pengaturan — export/delete/wipe butuh re-auth (spec 12)", () => {
  beforeEach(async () => clearStores(["export_meta", "habits", "transactions"]));
  it("tanpa re-auth → RE_AUTH_REQUIRED; dengan re-auth → export tercatat + file, delete pending, cancel menghapus", async () => {
    const s = await import("../src/settings.js");
    const m = await import("../src/money.js");
    m.clearReAuth();
    await expect(s.requestExport("all")).rejects.toThrow("RE_AUTH_REQUIRED");
    await expect(s.requestDeleteAccount("x")).rejects.toThrow("RE_AUTH_REQUIRED");
    await expect(s.wipeAllData()).rejects.toThrow("RE_AUTH_REQUIRED");
    await m.requestReAuth();
    const exp = await s.requestExport("all");
    expect(["completed", "failed"]).toContain(exp.status); // OPFS tidak ada di happy-dom → fallback IDB atau failed, keduanya tercatat
    expect((await s.listExports()).some((e) => e.id === exp.id)).toBe(true);
    const del = await s.requestDeleteAccount("tidak dipakai");
    expect(del.status).toBe("pending");
    await s.cancelDeleteAccount(del.id);
    expect((await s.listExports()).some((e) => e.id === del.id)).toBe(false);
  });
  it("FAQ ≥5 + filter q; updateSetting dot-path", async () => {
    const s = await import("../src/settings.js");
    expect(s.getFAQ().length).toBeGreaterThanOrEqual(5);
    expect(s.getFAQ("export").length).toBeGreaterThanOrEqual(1);
    await s.updateSetting("feedback.haptics", false);
    expect((await s.getSettings()).feedback.haptics).toBe(false);
  });
});

describe("Outbox — drain tanpa duplikat (spec 06/18 idempotency)", () => {
  beforeEach(async () => clearStores(["outbox"]));
  it("setiap entri dikirim sekali dengan Idempotency-Key yang sama saat retry; gagal → failed lalu retry pakai key sama; 409 dianggap replay sukses", async () => {
    const ob = await import("../src/storage/outbox.js");
    await ob.enqueue("POST", "/habits", { title: "A" });
    await ob.enqueue("POST", "/transactions", { amount: 1 });
    const seen = [];
    let failFirst = true;
    const apiClient = {
      post: vi.fn(async (path, body, opts) => {
        seen.push({ path, key: opts.idempotencyKey });
        if (failFirst && path === "/transactions") { failFirst = false; return { ok: false, status: 500 }; }
        return { ok: true, status: 201 };
      }),
    };
    const r1 = await ob.drainOutbox(apiClient);
    expect(r1.drained).toBe(1);
    expect(r1.failed).toBe(1);
    expect(await ob.listOutbox("failed")).toHaveLength(1);
    const r2 = await ob.drainOutbox(apiClient);
    expect(r2.drained).toBe(1);
    expect(await ob.listOutbox()).toHaveLength(0);
    // /transactions dikirim 2× (retry) tetapi dengan key identik → server dedup; /habits hanya 1×
    const txCalls = seen.filter((s) => s.path === "/transactions");
    expect(txCalls).toHaveLength(2);
    expect(txCalls[0].key).toBe(txCalls[1].key);
    expect(seen.filter((s) => s.path === "/habits")).toHaveLength(1);
    const keys = new Set(seen.map((s) => s.key));
    expect(keys.size).toBe(2);

    await ob.enqueue("POST", "/habits", { title: "B" });
    const replay = { post: vi.fn(async () => ({ ok: false, status: 409 })) };
    const r3 = await ob.drainOutbox(replay);
    expect(r3.drained).toBe(1); // 409 = idempotent replay → dianggap terkirim
  });
});

describe("Search — ranking exact>prefix>substring, grouping 4 scope, tanpa Worker (fallback main thread)", () => {
  beforeEach(async () => clearStores(["habits", "transactions", "budgets", "search_index"]));
  it("kopi multi-scope + urutan skor; <2 char → history", async () => {
    const h = await import("../src/habit.js");
    const m = await import("../src/money.js");
    await h.createHabit({ title: "Kurangi kopi", category: "kesehatan" });
    await m.createTransaction({ kind: "expense", amount: 25000, category: "Kopi", date: "2026-09-01", note: "kopi susu" });
    await m.createTransaction({ kind: "expense", amount: 12000, category: "Kopitiam", date: "2026-09-02" });
    await m.setBudget("Kopi", 100000, "2026-09");
    const s = await import("../src/search.js");
    const short = await s.searchGlobal("k");
    expect(short.isHistory).toBe(true);
    const r = await s.searchGlobal("kopi");
    expect(r.results.length).toBeGreaterThanOrEqual(3);
    expect(r.grouped.habit.length).toBe(1);
    expect(r.grouped.uang.length).toBe(2);
    expect(r.grouped.budget.length).toBe(1);
    // exact token "kopi" (skor 3) di atas prefix-only "kopitiam" (skor 2)
    const idx = (cat) => r.results.findIndex((x) => x.doc.category === cat);
    expect(idx("Kopi")).toBeLessThan(idx("Kopitiam"));
    // hasil tidak memuat saldo/nominal terformat penuh sebagai teks bebas selain field amount mentah untuk indeks
    expect(JSON.stringify(r.results)).not.toContain("Rp25.000");
  });
});
