// Guardrail permanen (syarat merge PR #2, 19 Sep 2026):
//  (b) paritas allowlist event analytics: klien `src/analytics.js` ALLOWED_EVENTS == 3 allowlist PHP (set identik, bukan sekadar subset)
//  (a) charts.js token-only: tanpa inline style/onclick/durasi hardcode; hex hanya di TOKEN_FALLBACK (fallback bila computed style kosong)
// Tes ini statik + DOM ringan; sengaja tanpa mock agar memeriksa modul asli.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

export function parseClientAllowlist(src = read("../src/analytics.js")) {
  const m = src.match(/const ALLOWED_EVENTS = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error("ALLOWED_EVENTS tidak ditemukan di src/analytics.js");
  return new Set([...m[1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]));
}

export function parsePhpAllowlist(src) {
  const m = src.match(/\$allowed\s*=\s*\[([^\]]*)\];/);
  if (!m) throw new Error("$allowed tidak ditemukan");
  return new Set([...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]));
}

const PHP_FILES = ["../public_html/api/v1/analytics.php", "../public_html/api/v1/index.php", "../public_html/api/v1/reports.php"];

describe("Paritas allowlist event analytics (klien == PHP ×3) — checklist permanen", () => {
  it("set event identik di src/analytics.js dan ketiga endpoint PHP; tidak ada event baru yang hanya ada di satu sisi", () => {
    const client = parseClientAllowlist();
    expect(client.size).toBeGreaterThan(20);
    for (const f of PHP_FILES) {
      const php = parsePhpAllowlist(read(f));
      const onlyClient = [...client].filter((e) => !php.has(e));
      const onlyPhp = [...php].filter((e) => !client.has(e));
      expect({ file: f, onlyClient, onlyPhp }).toEqual({ file: f, onlyClient: [], onlyPhp: [] });
    }
  });

  it("setiap literal track(\"x\") di src/ ada di allowlist (event yang tidak terdaftar di-drop diam-diam oleh analytics.js)", () => {
    const client = parseClientAllowlist();
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) return d.name === "workers" || d.name === "styles" ? [] : walk(full);
      return /\.(js|jsx)$/.test(d.name) ? [full] : [];
    });
    const used = new Map();
    for (const f of walk(path.resolve(__dirname, "../src"))) {
      for (const [, ev] of fs.readFileSync(f, "utf8").matchAll(/track\("([a-z0-9_]+)"/g)) used.set(ev, path.relative(path.resolve(__dirname, ".."), f));
    }
    const unregistered = [...used].filter(([ev]) => !client.has(ev));
    expect(unregistered).toEqual([]);
  });

  it("spec 05 = registry tunggal: SETIAP event di allowlist klien terdokumentasi di specs/05-analytics.md (notasi `a_b/c` diperluas)", () => {
    const spec = read("../specs/05-analytics.md");
    const documented = new Set();
    for (const [, tok] of spec.matchAll(/`([a-z0-9_]+(?:\/[a-z0-9_]+)*)`/g)) {
      const parts = tok.split("/");
      documented.add(parts[0]);
      const prefix = parts[0].includes("_") ? parts[0].slice(0, parts[0].lastIndexOf("_") + 1) : "";
      for (const alt of parts.slice(1)) documented.add(alt.includes("_") ? alt : prefix + alt);
    }
    const undocumented = [...parseClientAllowlist()].filter((e) => !documented.has(e));
    expect(undocumented).toEqual([]);
  });
});

describe("charts.js token-only (syarat merge (a))", () => {
  const src = read("../src/charts.js");
  it("tanpa .style.* assignment, tanpa atribut style= / onclick= inline, tanpa durasi/easing hardcode", () => {
    expect(src.match(/\.style\.[a-zA-Z]+\s*=/g)).toBeNull();
    expect(src).not.toMatch(/style="/);
    expect(src).not.toMatch(/onclick=/);
    expect(src).not.toMatch(/\d+ms\b/);
    expect(src).not.toMatch(/cubic-bezier/);
  });
  it("hex hanya di baris TOKEN_FALLBACK (fallback saat computed style kosong)", () => {
    const lines = src.split("\n");
    const hexLines = lines.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /#[0-9A-Fa-f]{3,6}\b/.test(l));
    expect(hexLines.map((x) => x.l.includes("TOKEN_FALLBACK"))).toEqual(hexLines.map(() => true));
    expect(hexLines.length).toBe(1);
  });
  it("renderRingProgress/renderStreakDots: DOM memakai class token (.ring-arc/.streak-dot), tanpa atribut style, dengan role=img + tabel data", async () => {
    const { renderRingProgress, renderStreakDots } = await import("../src/charts.js");
    const c1 = document.createElement("div");
    renderRingProgress(c1, 75, { srLabel: "3 dari 4 habit selesai hari ini" });
    expect(c1.querySelectorAll("[style]").length).toBe(0);
    expect(c1.querySelector(".ring-wrap").getAttribute("role")).toBe("img");
    expect(c1.querySelector(".ring-wrap").getAttribute("aria-label")).toBe("3 dari 4 habit selesai hari ini");
    expect(c1.querySelector(".ring-arc")).toBeTruthy();
    expect(c1.querySelector(".ring-track")).toBeTruthy();
    expect(c1.querySelector(".ring-label").textContent).toBe("75%");
    expect(c1.querySelector("details.chart-data table").textContent).toContain("75%");
    const arc = c1.querySelector(".ring-arc");
    const dash = parseFloat(arc.getAttribute("stroke-dasharray"));
    const off = parseFloat(arc.getAttribute("stroke-dashoffset"));
    expect(off / dash).toBeCloseTo(0.25, 2);

    const c2 = document.createElement("div");
    renderStreakDots(c2, 5, 30);
    expect(c2.querySelectorAll("[style]").length).toBe(0);
    expect(c2.querySelectorAll(".streak-dot").length).toBe(30);
    expect(c2.querySelectorAll(".streak-dot.filled").length).toBe(5);
    expect(c2.querySelector(".streak-dots").getAttribute("aria-label")).toBe("Streak 5 hari dari 30");
    expect(c2.querySelector(".sr-only").textContent).toBe("5 hari streak");
  });
  it("renderScatterIfNeeded <3 bulan: placeholder + tombol 'Perluas' via addEventListener (bukan onclick inline), tanpa memuat ECharts", async () => {
    const { renderScatterIfNeeded } = await import("../src/charts.js");
    const c = document.createElement("div");
    const r = await renderScatterIfNeeded(c, [{ streak: 1, impulsive: 2 }]);
    expect(r).toBeNull();
    const b = c.querySelector("button");
    expect(b.textContent).toBe("Perluas ke 3 bulan");
    expect(b.getAttribute("onclick")).toBeNull();
    location.hash = "";
    b.click();
    expect(location.hash).toBe("#/uang?preset=month");
  });
});
