// T13 sisa — Search (spec 19): highlight <mark> berbasis DOM, jalur worker vs main thread (paritas), UI token-only,
// offline badge non-color, history chips, tabs, event tanpa q mentah + result_count nyata. happy-dom + fake-indexeddb.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const tracked = [];
vi.mock("../src/analytics.js", () => ({ track: vi.fn((name, props) => { tracked.push({ name, props }); return Promise.resolve(true); }), initAnalytics: vi.fn() }));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const DOCS = [
  { id: "h1", type: "habit", title: "Kopi <b>hitam</b> pagi", note: "Sehat", category: "Sehat", updatedAt: 3 },
  { id: "t1", type: "uang", title: "Kopi", note: "Kopitiam bareng tim", category: "Kopi", amount: 25000, updatedAt: 2 },
  { id: "t2", type: "uang", title: "Makan", note: "Nasi padang", category: "Makan", amount: 10000, updatedAt: 1 },
  { id: "b1", type: "budget", title: "Kopi", category: "Kopi", updatedAt: 1 },
  { id: "t3", type: "uang", title: "Jajan", note: "kopitiam sore", category: "Jajan", amount: 15000, updatedAt: 9 },
];

// Muat skrip worker klasik (self.onmessage) tanpa Worker nyata: evaluasi sumbernya dengan `self` palsu
function loadWorker() {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/workers/search-indexer.js"), "utf8");
  const posted = [];
  const self = { postMessage: (m) => posted.push(m) };
  new Function("self", src)(self);
  return { self, posted };
}

async function seed() {
  const { idbClear, idbPut } = await import("../src/storage/db.js");
  for (const s of ["habits", "transactions", "budgets", "search_index"]) await idbClear(s).catch(() => {});
  await idbPut("habits", { id: "h1", title: "Kopi <b>hitam</b> pagi", category: "Sehat", streak: 0, createdAt: 1, updatedAt: 3 });
  await idbPut("transactions", { id: "t1", kind: "expense", amount: 25000, category: "Kopi", note: "Kopitiam bareng tim", date: "2026-09-19", createdAt: 1, updatedAt: 2 });
  await idbPut("transactions", { id: "t2", kind: "expense", amount: 10000, category: "Makan", note: "Nasi padang", date: "2026-09-18", createdAt: 1, updatedAt: 1 });
  await idbPut("budgets", { id: "Kopi_2026-09", category: "Kopi", limit: 300000, month: "2026-09", updatedAt: 1 });
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  tracked.length = 0;
  localStorage.clear();
  const prefs = await import("../src/storage/prefs.js");
  prefs.clearSearchHistory();
  await seed();
});
afterEach(() => vi.useRealTimers());

describe("Highlight <mark> berbasis DOM (tanpa innerHTML)", () => {
  it("menandai semua kecocokan case-insensitive; markup di teks pengguna tetap teks (tidak jadi elemen); karakter regex aman", async () => {
    const { renderHighlighted } = await import("../src/search.js");
    const el = document.createElement("div");
    renderHighlighted(el, "Kopi <b>hitam</b> kopi", "kopi");
    expect(el.querySelectorAll("mark").length).toBe(2);
    expect([...el.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["Kopi", "kopi"]);
    expect(el.querySelector("b")).toBeNull(); // markup pengguna tidak dieksekusi
    expect(el.textContent).toBe("Kopi <b>hitam</b> kopi");
    const el2 = document.createElement("div");
    expect(() => renderHighlighted(el2, "c++ (regex) [test]", "c++ (")).not.toThrow();
    expect(el2.querySelector("mark").textContent).toBe("c++ (");
    const el3 = document.createElement("div");
    renderHighlighted(el3, "tanpa kecocokan", "zzz");
    expect(el3.querySelector("mark")).toBeNull();
    expect(el3.textContent).toBe("tanpa kecocokan");
  });
});

describe("Jalur worker (skrip asli) vs main thread — paritas ranking & normalisasi", () => {
  it("worker: index → search 'kopi' urut exact>prefix>substring; 'Rp25.000' menemukan transaksi (awalan Rp + titik dibuang) — sama dengan main thread", async () => {
    const { self, posted } = loadWorker();
    self.onmessage({ data: { id: 1, type: "index", payload: { docs: DOCS } } });
    expect(posted[0].type).toBe("indexed");
    expect(posted[0].count).toBe(DOCS.length);
    const index = posted[0].index;

    self.onmessage({ data: { id: 2, type: "search", payload: { q: "kopi", index } } });
    const w = posted[1];
    expect(w.type).toBe("results");
    const wIds = w.results.map((r) => r.id);
    // exact "kopi" (h1/t1/b1 — seri skor → updatedAt terbaru dulu) SEBELUM substring "kopitiam" (t3, walau paling baru)
    expect(wIds).toEqual(["h1", "t1", "b1", "t3"]);
    expect(wIds).not.toContain("t2");

    const s = await import("../src/search.js");
    const m = s.searchMainThread("kopi", index);
    expect(m.map((r) => r.id)).toEqual(wIds);

    // Normalisasi angka/awalan Rp identik di kedua jalur
    expect(s.normalizeQuery("Rp25.000")).toEqual(["25000"]);
    self.onmessage({ data: { id: 3, type: "search", payload: { q: "Rp25.000", index } } });
    expect(posted[2].results.map((r) => r.id)).toEqual(["t1"]);
    expect(s.searchMainThread("Rp25.000", index).map((r) => r.id)).toEqual(["t1"]);

    // <2 karakter → kosong di kedua jalur; error worker dilaporkan sebagai pesan (bukan throw)
    self.onmessage({ data: { id: 4, type: "search", payload: { q: "k", index } } });
    expect(posted[3].results).toEqual([]);
    expect(s.searchMainThread("k", index)).toEqual([]);
    self.onmessage({ data: { id: 5, type: "search", payload: { q: "kopi", index: null } } });
    expect(posted[4].type).toBe("error");
  });
});

describe("createSearchUI — token-only, highlight di hasil, tabs, history, offline badge, event", () => {
  it("ketik 'kopi' → hasil dengan <mark>, tab Semua/Habit/Uang/Budget/Bantuan (aria-pressed), history tersimpan; search_executed tanpa q + result_count nyata; klik hasil → deep-link + search_result_opened", async () => {
    const { createSearchUI } = await import("../src/search.js");
    const root = document.getElementById("app");
    const ui = createSearchUI(root);
    const input = root.querySelector("input.search-input");
    expect(input.getAttribute("aria-controls")).toBe("search-results");
    expect(root.querySelectorAll("[style]").length).toBe(0);
    expect(root.querySelector(".search-history").textContent).toMatch(/Saran cepat/);

    input.value = "kopi";
    input.dispatchEvent(new Event("input"));
    await tick(700); // debounce 250 + index idle + render
    const results = root.querySelectorAll(".search-result");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(root.querySelectorAll(".search-result mark").length).toBeGreaterThan(0);
    expect(root.querySelector(".search-result b")).toBeNull(); // judul habit "<b>" tetap teks
    expect(root.querySelectorAll("[style]").length).toBe(0);
    const tabs = [...root.querySelectorAll(".search-tabs button")];
    expect(tabs.map((b) => b.dataset.tab)).toEqual(["semua", "habit", "uang", "budget", "bantuan"]);
    expect(tabs[0].getAttribute("aria-pressed")).toBe("true");
    expect(tabs[1].textContent).toBe("Habit (1)");
    expect(tabs[2].textContent).toBe("Uang (1)");
    expect(tabs[3].textContent).toBe("Budget (1)");

    const ev = tracked.find((t) => t.name === "search_executed");
    expect(ev.props.q).toBeUndefined();
    expect(ev.props).toMatchObject({ scope: "semua", char_len: 4, offline: false });
    expect(ev.props.result_count).toBeGreaterThanOrEqual(3);

    // filter tab Uang → hanya transaksi
    tabs[2].click();
    await tick(10);
    expect(ui.activeTab).toBe("uang");
    const uang = [...root.querySelectorAll(".search-result")];
    expect(uang.length).toBe(1);
    expect(uang[0].dataset.type).toBe("uang");
    expect(root.querySelector('.search-tabs button[data-tab="uang"]').getAttribute("aria-pressed")).toBe("true");
    // tidak menampilkan nominal (masking tetap berlaku — hasil hanya judul/catatan)
    expect(root.querySelector(".search-results").textContent).not.toMatch(/25\.000|25000/);

    location.hash = "";
    uang[0].click();
    expect(location.hash).toBe("#/uang/t1");
    expect(tracked.find((t) => t.name === "search_result_opened").props).toEqual({ scope: "uang" });

    // history
    const prefs = await import("../src/storage/prefs.js");
    expect(prefs.getSearchHistory()).toEqual(["kopi"]);
    input.value = "";
    input.dispatchEvent(new Event("input"));
    await tick(300);
    expect(root.querySelector(".search-chip-label").textContent).toBe("kopi");
    root.querySelector(".search-chip-remove").click();
    expect(prefs.getSearchHistory()).toEqual([]);
    expect(root.querySelector(".search-history").textContent).toMatch(/Saran cepat/);
    ui.destroy();
  });

  it("tanpa hasil → 'Hapus pencarian' via listener (bukan onclick inline) mengosongkan; offline → badge ikon+teks; SR live region .sr-only", async () => {
    const { createSearchUI } = await import("../src/search.js");
    const root = document.getElementById("app");
    createSearchUI(root);
    const input = root.querySelector("input.search-input");
    input.value = "zzzz";
    input.dispatchEvent(new Event("input"));
    await tick(700);
    const empty = root.querySelector(".search-empty");
    expect(empty.textContent).toMatch(/Tidak ada hasil untuk 'zzzz'/);
    const clearBtn = empty.querySelector("button");
    expect(clearBtn.getAttribute("onclick")).toBeNull();
    clearBtn.click();
    expect(input.value).toBe("");
    await tick(300);
    expect(root.querySelector(".search-results").children.length).toBe(0);

    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    input.value = "kopi";
    input.dispatchEvent(new Event("input"));
    await tick(700);
    const badge = root.querySelector(".search-offline");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toMatch(/📴/);
    expect(badge.textContent).toMatch(/Hasil offline — data sampai/);
    expect(tracked.filter((t) => t.name === "search_executed").pop().props.offline).toBe(true);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    await tick(350);
    const live = document.getElementById("hw-search-live");
    expect(live.className).toBe("sr-only");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toMatch(/hasil untuk kopi/);
  });

  it("statik: search.js tanpa inline style/hex/onclick/innerHTML; CSS .search-* ada di app.css", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/search.js"), "utf8");
    expect(src.match(/\.style\.[a-zA-Z]+\s*=/g)).toBeNull();
    expect(src).not.toMatch(/style="/);
    expect(src).not.toMatch(/onclick=/);
    expect(src).not.toMatch(/\.innerHTML\s*=/);
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
    const css = fs.readFileSync(path.resolve(__dirname, "../src/styles/app.css"), "utf8");
    for (const c of [".search-input", ".search-result mark", ".search-offline", ".search-chip-remove"]) expect(css).toContain(c);
  });
});
