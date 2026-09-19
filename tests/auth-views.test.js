// T5/T13 — layar auth (DOM): consent tanpa preselect, Nanti Saja tanpa dialog sistem, hub states, primer "Nanti" tidak memicu dialog
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/analytics.js", () => ({ track: vi.fn(() => Promise.resolve(true)) }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(), playBlip: vi.fn() }));

import * as auth from "../src/auth.js";
import { AuthConsent, AuthPasskey, AuthHub, AuthCarousel, AuthRecovery, showPermissionPrimer } from "../src/views-auth.jsx";
import { getDecision, canTriggerSystemDialog, clearPrimerDismissal } from "../src/permissions.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  auth.resetAuthState();
  document.body.innerHTML = '<div id="app"></div>';
});

describe("AuthConsent", () => {
  it("3 switch semua OFF saat render (tanpa preselect), dasar berlabel wajib, opsional berlabel opsional", () => {
    const root = document.getElementById("app");
    AuthConsent(root);
    const switches = root.querySelectorAll('input[role="switch"]');
    expect(switches).toHaveLength(3);
    switches.forEach((s) => expect(s.checked).toBe(false));
    expect(root.querySelectorAll(".badge-required")).toHaveLength(1);
    expect(root.querySelectorAll(".badge-optional")).toHaveLength(2);
  });

  it("lanjut tanpa dasar → pesan error (alert), tidak berpindah; dengan dasar → simpan + hash ke passkey", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    const root = document.getElementById("app");
    AuthConsent(root);
    const btn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Simpan"));
    btn.click();
    await tick();
    expect(root.querySelector('[role="alert"]').textContent).toMatch(/dasar/i);
    expect(auth.getConsentHistory()).toHaveLength(0);
    const dasar = root.querySelector('input[aria-label^="Dasar"]');
    dasar.click();
    dasar.dispatchEvent(new Event("change"));
    btn.click();
    await tick(20);
    expect(auth.getConsentHistory()).toHaveLength(1);
    expect(auth.getConsentHistory()[0]).toMatchObject({ dasar: true, kesehatan: false, finansial: false });
    expect(location.hash).toBe("#/auth/passkey");
  });
});

describe("AuthPasskey — Nanti Saja", () => {
  it("Nanti Saja tersedia, tidak memanggil navigator.credentials.create, set reminder + lanjut first-habit", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    await auth.saveConsent({ dasar: true });
    const create = vi.fn();
    Object.defineProperty(navigator, "credentials", { value: { create, get: vi.fn() }, configurable: true });
    const root = document.getElementById("app");
    AuthPasskey(root);
    await tick(10);
    const later = [...root.querySelectorAll("button")].find((b) => /Nanti Saja|Lanjut/.test(b.textContent));
    expect(later).toBeTruthy();
    expect(root.textContent).toContain("Wajahmu adalah kuncimu");
    later.click();
    await tick(10);
    expect(create).not.toHaveBeenCalled();
    expect(auth.hasPasskeyReminder()).toBe(true);
    expect(location.hash).toBe("#/auth/first-habit");
  });
});

describe("AuthHub", () => {
  it("email invalid → aria-invalid + error; email valid → sesi + hash ke consent; Google/Apple ditandai Belum tersedia", async () => {
    const root = document.getElementById("app");
    AuthHub(root, { query: {} });
    const input = root.querySelector("#auth-email");
    const form = root.querySelector("form");
    input.value = "salah";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await tick(10);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(root.querySelector(".field-error").hidden).toBe(false);
    expect(auth.isLoggedIn()).toBe(false);

    const disabled = root.querySelectorAll('.hub-btn[aria-disabled="true"]');
    expect(disabled.length).toBeGreaterThanOrEqual(2);
    expect(root.textContent).toContain("Belum tersedia");

    input.value = "budi@contoh.id";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await tick(400);
    expect(auth.isLoggedIn()).toBe(true);
    expect(location.hash).toBe("#/auth/consent");
  });

  it("state duplikat menawarkan masuk", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    await auth.logout();
    const root = document.getElementById("app");
    AuthHub(root, { query: {} });
    root.querySelector("#auth-email").value = "budi@contoh.id";
    root.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true }));
    await tick(20);
    expect(root.textContent).toContain("Akun sudah ada");
  });
});

describe("AuthCarousel", () => {
  it("3 slide, tombol Lewati jelas, Lewati → hub dengan skipped=true", async () => {
    const root = document.getElementById("app");
    AuthCarousel(root);
    expect(root.querySelectorAll('.carousel-dots [role="tab"]')).toHaveLength(3);
    const skip = [...root.querySelectorAll("button")].find((b) => b.textContent === "Lewati");
    skip.click();
    await tick();
    expect(auth.getOnboardingState().carousel_skipped).toBe(true);
    expect(location.hash).toBe("#/auth/hub");
  });
});

describe("AuthRecovery", () => {
  it("menawarkan masuk ulang via email; PIN/tautan email jujur belum tersedia", () => {
    const root = document.getElementById("app");
    AuthRecovery(root);
    expect(root.textContent).toContain("Masuk ulang dengan email");
    expect(root.querySelectorAll('.hub-btn[aria-disabled="true"]')).toHaveLength(2);
  });
});

describe("Permission primer — SATU per momen", () => {
  it("'Nanti' → decision later, canTriggerSystemDialog=false, onAllow tidak dipanggil", async () => {
    const onAllow = vi.fn(() => Promise.resolve({ state: "granted" }));
    const onDone = vi.fn();
    showPermissionPrimer({ scope: "notifications", title: "Ingatkan?", desc: "x", onAllow, onDone });
    const later = document.querySelector("[data-later]");
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    later.click();
    await tick(300);
    expect(onAllow).not.toHaveBeenCalled();
    expect(getDecision("notifications").lastDecision).toBe("later");
    expect(canTriggerSystemDialog("notifications")).toBe(false);
    expect(onDone).toHaveBeenCalledWith({ decision: "later" });
    // Tidak tampil lagi dalam 24 jam (cooldown "later")
    const again = showPermissionPrimer({ scope: "notifications", title: "x", desc: "y", onAllow, onDone });
    expect(again).toBeNull();
  });

  it("'Izinkan' → decision granted dulu, lalu onAllow; deny → copy fallback 'Tidak apa-apa!'", async () => {
    clearPrimerDismissal("notifications"); // cache in-memory dari test sebelumnya
    const onAllow = vi.fn(() => Promise.resolve({ state: "denied" }));
    showPermissionPrimer({ scope: "notifications", title: "Ingatkan?", desc: "x", onAllow });
    document.querySelector("[data-allow]").click();
    await tick(20);
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(document.querySelector("#primer-status").textContent).toContain("Tidak apa-apa!");
  });
});

describe("AuthFirstHabit — first habit + first completion (<3 menit happy path)", () => {
  it("template → Simpan → Tandai selesai → onboarding done + primer notifikasi tampil (satu) + tombol Ke Beranda", async () => {
    const { AuthFirstHabit } = await import("../src/views-auth.jsx");
    const { listHabits, listEntries } = await import("../src/habit.js");
    await auth.signup({ email: "budi@contoh.id" });
    await auth.saveConsent({ dasar: true });
    auth.deferPasskey();
    const root = document.getElementById("app");
    AuthFirstHabit(root);
    // CTA sticky ada dan input draft
    expect(root.querySelector(".auth-cta .btn")).toBeTruthy();
    const tpl = root.querySelector(".tpl-chip");
    tpl.click();
    expect(root.querySelector("#first-habit-title").value).toBe(tpl.textContent);
    const cta = root.querySelector(".auth-cta .btn");
    cta.click();
    await tick(50);
    const habits = await listHabits();
    expect(habits).toHaveLength(1);
    expect(root.querySelector(".habit-preview")).toBeTruthy();
    // Tandai selesai
    root.querySelector(".habit-preview .check-btn").click();
    await tick(100);
    const entries = await listEntries(habits[0].id);
    expect(entries).toHaveLength(1);
    expect(auth.isOnboardingComplete()).toBe(true);
    expect(auth.getNextStep()).toBe("done");
    expect(root.querySelector(".celebrate")).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1); // SATU primer
    expect(document.querySelector("#primer-title").textContent).toContain("Ingatkan");
    expect(localStorage.getItem("hw:first-habit:done")).toBe("1");
    const home = [...root.querySelectorAll("button")].find((b) => b.textContent === "Ke Beranda");
    expect(home).toBeTruthy();
    // Draf dibersihkan setelah tersimpan
    expect(localStorage.getItem("hw:draft:first-habit")).toBeNull();
  });
});
