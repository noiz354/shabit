// Syarat merge PR #2 (a): ui.js pengganti alert/confirm + views.jsx token-only (tanpa hex/inline style/reload)
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../src/analytics.js", () => ({ track: vi.fn(() => Promise.resolve(true)), initAnalytics: vi.fn() }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(), playBlip: vi.fn() }));
vi.mock("../src/charts.js", () => ({
  renderRingProgress: vi.fn(), renderStreakDots: vi.fn(),
  renderHabitBar: vi.fn(() => Promise.resolve()), renderDonutCategory: vi.fn(() => Promise.resolve()), renderCashflowBar: vi.fn(() => Promise.resolve()),
  tokenColor: () => "",
}));

import { showToast, confirmSheet, infoSheet, chooseSheet } from "../src/ui.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
});

describe("ui.js — toast + sheet (One UI, token-only)", () => {
  it("showToast: role=status, teks, aksi opsional, kelas show", async () => {
    const onAction = vi.fn();
    const t = showToast("Tersimpan", { actionLabel: "Batal", onAction, tone: "success" });
    expect(t.getAttribute("role")).toBe("status");
    expect(t.classList.contains("show")).toBe(true);
    expect(t.textContent).toContain("Tersimpan");
    t.querySelector(".toast-action").click();
    expect(onAction).toHaveBeenCalled();
    expect(t.classList.contains("show")).toBe(false);
  });

  it("confirmSheet destruktif: dialog + tombol destruktif ber-ikon; Batal → false, konfirmasi → true, scrim → false", async () => {
    let p = confirmSheet({ title: "Hapus?", desc: "x", confirmLabel: "Hapus", destructive: true, detail: ["A", "B"] });
    await tick();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const destructive = dialog.querySelector(".btn-destructive");
    expect(destructive.textContent).toContain("⚠️");
    expect(dialog.querySelectorAll(".sheet-list li")).toHaveLength(2);
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Batal").click();
    expect(await p).toBe(false);
    await tick(300);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    p = confirmSheet({ title: "Hapus?", confirmLabel: "Hapus", destructive: true });
    await tick();
    document.querySelector('[role="dialog"] .btn-destructive').click();
    expect(await p).toBe(true);
    await tick(300);

    p = confirmSheet({ title: "Yakin?" });
    await tick();
    document.querySelector(".scrim").click();
    expect(await p).toBe(false);
  });

  it("infoSheet resolve saat Oke; chooseSheet mengembalikan nilai pilihan / null saat batal", async () => {
    const p = infoSheet({ title: "Info", items: ["a"] });
    await tick();
    [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === "Oke").click();
    await expect(p).resolves.toBeUndefined();
    await tick(300);
    const c = chooseSheet({ title: "Tema", options: [{ value: "light", label: "Terang" }, { value: "dark", label: "Gelap" }], current: "light" });
    await tick();
    const radios = document.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    radios[1].click();
    expect(await c).toBe("dark");
  });
});

describe("views.jsx — utang Wave 2 lunas (statik)", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/views.jsx"), "utf8");
  it("tanpa hex, alert(), confirm(), prompt()", () => {
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
    expect(src).not.toMatch(/\balert\(/);
    expect(src).not.toMatch(/\bconfirm\(/);
    expect(src).not.toMatch(/\bprompt\(/);
  });
  it("tanpa inline style visual (hanya width data progress + token motion) dan reload hanya setelah wipe", () => {
    const styleUses = src.match(/\.style\.[a-zA-Z]+\s*=/g) || [];
    expect(styleUses).toEqual([".style.width ="]);
    expect((src.match(/location\.reload\(\)/g) || []).length).toBe(1);
    expect(src).not.toMatch(/style="/);
  });
  it("auth.css/app.css/tokens: hex hanya di tokens.css", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../src/styles/app.css"), "utf8");
    const auth = fs.readFileSync(path.resolve(__dirname, "../src/styles/auth.css"), "utf8");
    expect(app).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
    expect(auth).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
  });
});

describe("views.jsx — Pengaturan: aksi destruktif lewat confirmSheet + re-auth; Habit list re-render tanpa reload", () => {
  it("Hapus akun: batal di confirm → tidak ada permintaan; konfirmasi → sheet verifikasi (re-auth) → permintaan tercatat", async () => {
    const auth = await import("../src/auth.js");
    auth.resetAuthState();
    await auth.signup({ email: "budi@contoh.id" });
    const money = await import("../src/money.js");
    money.clearReAuth();
    const { Pengaturan } = await import("../src/views.jsx");
    const root = document.getElementById("app");
    Pengaturan(root);
    await tick(50);
    const rowDel = [...root.querySelectorAll(".settings-row")].find((b) => b.textContent.includes("Hapus akun"));
    expect(rowDel).toBeTruthy();
    expect(rowDel.tagName).toBe("BUTTON");
    rowDel.click();
    await tick(20);
    let dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Hapus akun?");
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Batal").click();
    await tick(300);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    rowDel.click();
    await tick(20);
    document.querySelector('[role="dialog"] .btn-destructive').click();
    await tick(300);
    dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Verifikasi ulang"); // re-auth gate sebelum aksi sensitif
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Verifikasi").click();
    await tick(400);
    expect(money.isReAuthed()).toBe(true);
    const { idbGetAll } = await import("../src/storage/db.js");
    const meta = await idbGetAll("export_meta", null, undefined, 50);
    expect(meta.some((m) => m.type === "deletion" && m.status === "pending")).toBe(true);
    expect(document.querySelector('[role="dialog"]').textContent).toContain("Permintaan diterima");
  });

  it("Habit: template → kartu muncul tanpa reload; toggle ✓ → Batal (undo) memakai completeHabit/undoComplete", async () => {
    const { Habit } = await import("../src/views.jsx");
    const { listHabits, listEntries } = await import("../src/habit.js");
    const { idbClear } = await import("../src/storage/db.js");
    await idbClear("habits");
    await idbClear("habit_entries");
    const root = document.getElementById("app");
    location.hash = "#/habit";
    Habit(root, { params: {}, query: {} });
    await tick(80);
    const tpl = root.querySelector(".tpl-chip");
    expect(tpl).toBeTruthy();
    tpl.click();
    await tick(120);
    expect((await listHabits()).length).toBe(1);
    const card = root.querySelector(".habit-card");
    expect(card).toBeTruthy();
    const toggle = card.querySelector("button");
    toggle.click();
    await tick(80);
    expect(card.querySelector(".check").classList.contains("done")).toBe(true);
    expect(toggle.textContent).toBe("Batal");
    const h = (await listHabits())[0];
    expect((await listEntries(h.id)).length).toBe(1);
    toggle.click();
    await tick(80);
    expect((await listEntries(h.id)).length).toBe(0);
    expect(toggle.textContent).toBe("✓");
    expect(root.querySelector(".habit-card .check").classList.contains("done")).toBe(false);
  });
});
