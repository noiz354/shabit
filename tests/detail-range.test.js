// T13 sisa — Range picker sheet (spec 17) tanpa alert() + token-only; detail habit & transaksi (hapus destruktif via confirmSheet, masking).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const tracked = [];
vi.mock("../src/analytics.js", () => ({ track: vi.fn((name, props) => { tracked.push({ name, props }); return Promise.resolve(true); }), initAnalytics: vi.fn() }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(() => Promise.resolve()), playBlip: vi.fn() }));
vi.mock("../src/charts.js", () => ({
  renderRingProgress: vi.fn(), renderStreakDots: vi.fn(), renderHabitBar: vi.fn(() => Promise.resolve()), renderDonutCategory: vi.fn(() => Promise.resolve()),
  renderCashflowBar: vi.fn(() => Promise.resolve()), renderScatterIfNeeded: vi.fn(() => Promise.resolve(null)), tokenColor: () => "",
}));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  tracked.length = 0;
  const { idbClear } = await import("../src/storage/db.js");
  for (const s of ["habits", "habit_entries", "transactions", "outbox", "kv"]) await idbClear(s).catch(() => {});
  const money = await import("../src/money.js");
  money.clearReAuth();
  window.alert = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe("Range picker (spec 17) — sheet ui.js, validasi inline, tanpa alert()", () => {
  it("preset aktif aria-pressed; Terapkan dari>sampai → error inline role=alert (alert() TIDAK dipanggil), onApply tidak dipanggil; kustom valid → setRange + range_custom_applied{days} + hash; preset 7H → range_changed", async () => {
    const { showRangePicker, validateCustomRange } = await import("../src/range.js");
    const prefs = await import("../src/storage/prefs.js");
    const onApply = vi.fn();
    location.hash = "#/beranda";
    showRangePicker({ preset: "month", from: "2026-09-01", to: "2026-09-30", tz: "Asia/Jakarta" }, onApply);
    await tick(20);
    const sheet = document.getElementById("range-picker-sheet");
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.querySelectorAll("[style]").length).toBe(0);
    const presets = [...sheet.querySelectorAll("[data-preset]")];
    expect(presets.map((b) => b.dataset.preset)).toEqual(["today", "7d", "30d", "month", "lastMonth"]);
    expect(sheet.querySelector('[data-preset="month"]').getAttribute("aria-pressed")).toBe("true");
    expect(sheet.querySelector(".range-tz").textContent).toBe("Zona waktu: Asia/Jakarta");

    const from = sheet.querySelector("#range-from");
    const to = sheet.querySelector("#range-to");
    const applyBtn = [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Terapkan");
    from.value = "2026-09-20";
    to.value = "2026-09-10";
    applyBtn.click();
    await tick(20);
    const err = sheet.querySelector("#range-error");
    expect(err.hidden).toBe(false);
    expect(err.getAttribute("role")).toBe("alert");
    expect(err.textContent).toMatch(/dari harus ≤ sampai/);
    expect(to.getAttribute("aria-invalid")).toBe("true");
    expect(window.alert).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    expect(document.getElementById("range-picker-sheet")).toBeTruthy(); // sheet tetap terbuka

    from.value = "";
    applyBtn.click();
    await tick(10);
    expect(err.textContent).toMatch(/Pilih tanggal dari dan sampai/);
    expect(validateCustomRange("2025-01-01", "2026-06-30")).toMatchObject({ ok: false, reason: "TOO_LONG" });
    expect(validateCustomRange("2026-01-01", "2026-12-31").ok).toBe(true);

    from.value = "2026-09-01";
    to.value = "2026-09-07";
    applyBtn.click();
    await tick(350);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({ preset: "custom", from: "2026-09-01", to: "2026-09-07", tz: "Asia/Jakarta" });
    expect(prefs.getRange()).toMatchObject({ preset: "custom", from: "2026-09-01", to: "2026-09-07" });
    expect(tracked.find((t) => t.name === "range_custom_applied").props).toEqual({ days: 7 });
    expect(location.hash).toBe("#/beranda?preset=custom&from=2026-09-01&to=2026-09-07");
    expect(document.getElementById("range-picker-sheet")).toBeNull();

    // preset
    showRangePicker(prefs.getRange(), onApply);
    await tick(20);
    document.querySelector('#range-picker-sheet [data-preset="7d"]').click();
    await tick(350);
    const ev = tracked.find((t) => t.name === "range_changed");
    expect(ev.props).toMatchObject({ preset: "7d", days: 7, module: "#/beranda" });
    expect(prefs.getRange().preset).toBe("7d");
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(document.getElementById("range-picker-sheet")).toBeNull();
  });

  it("statik: range.js tanpa alert/confirm/prompt, inline style, hex, require()", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/range.js"), "utf8");
    expect(src).not.toMatch(/\balert\(|\bconfirm\(|\bprompt\(/);
    expect(src.match(/\.style\.[a-zA-Z]+\s*=/g)).toBeNull();
    expect(src).not.toMatch(/style=/);
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
    expect(src).not.toMatch(/require\(/);
  });
});

describe("Detail habit & transaksi (spec 08/09) — hapus destruktif lewat confirmSheet, masking nominal", () => {
  it("Detail habit: judul + Riwayat(n) + Hapus → confirmSheet destruktif (Batal = tidak terhapus; Hapus = deleteHabit + toast + kembali)", async () => {
    const { idbPut, idbGet } = await import("../src/storage/db.js");
    await idbPut("habits", { id: "h9", title: "Baca 10 menit", category: "Belajar", goal_type: "check", streak: 2, createdAt: 1, updatedAt: 1 });
    await idbPut("habit_entries", { id: "h9_2026-09-18", habit_id: "h9", date: "2026-09-18", status: "done", source: "manual", createdAt: 1, updatedAt: 1 });
    await idbPut("habit_entries", { id: "h9_2026-09-19", habit_id: "h9", date: "2026-09-19", status: "done", source: "manual", createdAt: 1, updatedAt: 1 });
    const { Habit } = await import("../src/views.jsx");
    const root = document.getElementById("app");
    location.hash = "#/habit/h9";
    Habit(root, { params: { id: "h9" } });
    await tick(60);
    expect(root.querySelector(".card-title").textContent).toBe("Baca 10 menit");
    expect(root.querySelector(".card-sub").textContent).toMatch(/Streak 2 hari • Belajar/);
    expect(root.querySelector(".settings-heading").textContent).toBe("Riwayat (2)");
    expect(root.querySelectorAll(".entry-item").length).toBe(2);
    expect(root.querySelector(".entry-item").textContent).toMatch(/✓ selesai/);

    const del = [...root.querySelectorAll("button")].find((b) => b.textContent === "Hapus habit");
    expect(del.className).toContain("btn-destructive");
    del.click();
    await tick(20);
    let dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Hapus "Baca 10 menit"?');
    expect(dialog.textContent).toContain("2 catatan riwayat ikut terhapus");
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Batal").click();
    await tick(300);
    expect(await idbGet("habits", "h9")).toBeTruthy();

    del.click();
    await tick(20);
    dialog = document.querySelector('[role="dialog"]');
    dialog.querySelector(".btn-destructive").click();
    await tick(350);
    expect(await idbGet("habits", "h9")).toBeFalsy();
    expect(document.getElementById("hw-toast").textContent).toBe("Habit dihapus");
    expect(location.hash).toBe("#/habit");

    // tidak ditemukan → empty state + Kembali
    document.body.innerHTML = '<div id="app"></div>';
    Habit(document.getElementById("app"), { params: { id: "nope" } });
    await tick(40);
    expect(document.querySelector(".empty-state").textContent).toBe("Habit tidak ditemukan.");
  });

  it("Detail transaksi: nominal dimasking tanpa re-auth, tampil setelah re-auth; Hapus → confirm → deleteTransaction + outbox DELETE + toast", async () => {
    const { idbPut, idbGet } = await import("../src/storage/db.js");
    await idbPut("transactions", { id: "t9", kind: "expense", amount: 25000, category: "Kopi", note: "Kopi susu", date: "2026-09-19", account_ref: "Tunai", createdAt: 1, updatedAt: 1 });
    const { Uang } = await import("../src/views.jsx");
    const money = await import("../src/money.js");
    let root = document.getElementById("app");
    location.hash = "#/uang/t9";
    Uang(root, { params: { id: "t9" } });
    await tick(60);
    expect(root.querySelector(".card-title").textContent).toBe("Kopi • Pengeluaran");
    expect(root.querySelector(".tx-amount").textContent).toBe("Rp••••••");
    expect(root.querySelector(".tx-amount").dataset.kind).toBe("expense");
    expect(root.textContent).toContain("Kopi susu");
    expect(root.textContent).toContain("19 Sep 2026");

    await money.requestReAuth();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById("app");
    Uang(root, { params: { id: "t9" } });
    await tick(60);
    expect(root.querySelector(".tx-amount").textContent).toBe("Rp25.000");

    const del = [...root.querySelectorAll("button")].find((b) => b.textContent === "Hapus");
    del.click();
    await tick(20);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Hapus transaksi ini?");
    dialog.querySelector(".btn-destructive").click();
    await tick(350);
    expect(await idbGet("transactions", "t9")).toBeFalsy();
    const { listOutbox } = await import("../src/storage/outbox.js");
    expect((await listOutbox()).some((o) => o.op === "DELETE" && o.path === "/transactions/t9")).toBe(true);
    expect(document.getElementById("hw-toast").textContent).toBe("Transaksi dihapus");
    expect(location.hash).toBe("#/uang");
  });
});
