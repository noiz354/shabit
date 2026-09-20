// T13 sisa — PWA install sheet (spec 15): beforeinstallprompt ditunda sampai first habit, sheet One UI via ui.js (dialog + focus trap),
// Nanti → dismissed + tidak muncul lagi, Pasang → prompt() + userChoice → pwa_installed{source:"prompt"}; appinstalled tanpa duplikat.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const tracked = [];
vi.mock("../src/analytics.js", () => ({ track: vi.fn((name, props) => { tracked.push({ name, props }); return Promise.resolve(true); }), initAnalytics: vi.fn() }));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function fireBeforeInstallPrompt(outcome = "accepted") {
  const ev = new Event("beforeinstallprompt", { cancelable: true });
  ev.prompt = vi.fn();
  ev.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(ev);
  return ev;
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  tracked.length = 0;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
// Catatan: satu instance modul untuk seluruh file (listener window + state internal), urutan `it` disengaja.
afterEach(() => vi.useRealTimers());

describe("PWA install sheet (spec 15)", () => {
  it("sebelum first habit: prompt ditahan (preventDefault) dan sheet TIDAK muncul; setelah first habit: sheet muncul 2 dtk kemudian sebagai dialog ui.js", async () => {
    const pwa = await import("../src/pwa.js");
    pwa.initPWAInstall();
    const ev = fireBeforeInstallPrompt();
    expect(ev.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(2500);
    expect(document.getElementById("pwa-install-sheet")).toBeNull();

    localStorage.setItem("hw:first-habit:done", "1");
    fireBeforeInstallPrompt();
    expect(document.getElementById("pwa-install-sheet")).toBeNull(); // belum 2 dtk
    vi.advanceTimersByTime(2100);
    const sheet = document.getElementById("pwa-install-sheet");
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.querySelector(".sheet-title").textContent).toBe("Pasang HabitWealth?");
    expect(document.querySelector(".scrim")).toBeTruthy();
    const labels = [...sheet.querySelectorAll(".sheet-actions button")].map((b) => b.textContent);
    expect(labels).toEqual(["Nanti", "Pasang"]);

    // Nanti → dismissed flag + pwa_dismissed; prompt berikutnya tidak menampilkan sheet lagi
    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Nanti").click();
    await Promise.resolve();
    vi.advanceTimersByTime(400);
    expect(document.getElementById("pwa-install-sheet")).toBeNull();
    expect(localStorage.getItem("hw:pwa:install-dismissed")).toBe("1");
    expect(tracked.filter((t) => t.name === "pwa_dismissed").length).toBe(1);
    fireBeforeInstallPrompt();
    vi.advanceTimersByTime(2500);
    expect(document.getElementById("pwa-install-sheet")).toBeNull();
  });

  it("instal manual (appinstalled tanpa prompt) → pwa_installed{source:'manual'} sekali walau initPWAInstall dipanggil dua kali", async () => {
    const pwa = await import("../src/pwa.js");
    pwa.initPWAInstall();
    pwa.initPWAInstall(); // idempoten
    window.dispatchEvent(new Event("appinstalled"));
    expect(tracked).toEqual([{ name: "pwa_installed", props: { source: "manual" } }]);
    expect(localStorage.getItem("hw:pwa:installed")).toBe("1");
  });

  it("Pasang → deferredPrompt.prompt() + userChoice accepted → pwa_installed{source:'prompt'}; appinstalled sesudahnya tidak menduplikasi; ditolak → pwa_dismissed", async () => {
    const pwa = await import("../src/pwa.js");
    pwa.initPWAInstall();
    localStorage.setItem("hw:first-habit:done", "1");
    const ev = fireBeforeInstallPrompt("accepted");
    vi.advanceTimersByTime(2100);
    const sheet = document.getElementById("pwa-install-sheet");
    expect(sheet).toBeTruthy();
    [...sheet.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Pasang").click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(tracked.filter((t) => t.name === "pwa_installed")).toEqual([{ name: "pwa_installed", props: { source: "prompt" } }]);
    window.dispatchEvent(new Event("appinstalled"));
    expect(tracked.filter((t) => t.name === "pwa_installed").length).toBe(1); // tanpa duplikat
    vi.advanceTimersByTime(400);
    expect(document.getElementById("pwa-install-sheet")).toBeNull();

    // ditolak di dialog browser → pwa_dismissed (bukan pwa_installed)
    tracked.length = 0;
    localStorage.removeItem("hw:pwa:install-dismissed");
    fireBeforeInstallPrompt("dismissed");
    vi.advanceTimersByTime(2100);
    const sheet2 = document.getElementById("pwa-install-sheet");
    expect(sheet2).toBeTruthy();
    [...sheet2.querySelectorAll(".sheet-actions button")].find((b) => b.textContent === "Pasang").click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(tracked.filter((t) => t.name === "pwa_dismissed").length).toBe(1);
    expect(tracked.find((t) => t.name === "pwa_installed")).toBeUndefined();
    vi.advanceTimersByTime(400);
  });

  it("scrim/Esc = 'Nanti' (dismissed sekali, tidak ganda); sheet iOS punya satu aksi 'Mengerti' dan tanpa inline style; sudah standalone → tidak ada sheet", async () => {
    const pwa = await import("../src/pwa.js");
    localStorage.setItem("hw:first-habit:done", "1");
    pwa.showInstallSheet();
    const sheet = document.getElementById("pwa-install-sheet");
    expect(sheet).toBeTruthy();
    document.querySelector(".scrim").click();
    vi.advanceTimersByTime(400);
    expect(document.getElementById("pwa-install-sheet")).toBeNull();
    expect(tracked.filter((t) => t.name === "pwa_dismissed").length).toBe(1);
    expect(localStorage.getItem("hw:pwa:install-dismissed")).toBe("1");

    const ios = pwa.showIOSInstallInstruction();
    const iosSheet = document.getElementById("pwa-ios-sheet");
    expect(iosSheet.querySelector(".sheet-title").textContent).toBe("Pasang di iPhone");
    expect(iosSheet.textContent).toMatch(/Add to Home Screen/);
    expect(iosSheet.querySelectorAll("[style]").length).toBe(0);
    expect([...iosSheet.querySelectorAll(".sheet-actions button")].map((b) => b.textContent)).toEqual(["Mengerti"]);
    ios.close();
    vi.advanceTimersByTime(400);
    expect(document.getElementById("pwa-ios-sheet")).toBeNull();

    // standalone → tidak ada sheet
    const mm = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q.includes("standalone"), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    expect(pwa.showInstallSheet()).toBeNull();
    expect(document.getElementById("pwa-install-sheet")).toBeNull();
    window.matchMedia = mm;
  });
});
