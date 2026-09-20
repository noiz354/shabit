/**
 * HabitWealth charts — T16 + AUD-WORK-01 + AUD-ORIENT-01 + AUD-NET-01
 * ECharts core+Bar/Pie, ring/streak SVG, donut-tap-filter, lazy scatter
 * Acceptance: bundle awal <200KB gzip, tiap chart ada SR-summary
 */

import { getAdaptiveTier } from "./net.js";
import { getRange } from "./storage/prefs.js";
import { onOrientationChange, makeChartFullscreenable } from "./orientation.js";

// Warna dari token CSS (canvas/SVG butuh nilai riil; sumber tetap tokens.css, bukan hex di fitur)
const TOKEN_FALLBACK = { "--primary": "#0381FE", "--surface-variant": "#EEEEEE", "--surface-elevated": "#FFFFFF", "--positive": "#0AA64E", "--negative": "#D93B30", "--on-background": "#000000" };
export function tokenColor(name) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) return v;
  } catch {}
  return TOKEN_FALLBACK[name] || "";
}


let echartsCore = null;

async function loadECharts() {
  if (echartsCore) return echartsCore;
  try {
    // Dynamic import core + components (budget <200KB)
    const echarts = await import("echarts/core");
    const { BarChart, PieChart, HeatmapChart, ScatterChart } = await import("echarts/charts");
    const { GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent } = await import("echarts/components");
    const { CanvasRenderer, SVGRenderer } = await import("echarts/renderers");

    echarts.use([BarChart, PieChart, HeatmapChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent, CanvasRenderer, SVGRenderer]);

    echartsCore = echarts;
    return echarts;
  } catch (e) {
    console.warn("[charts] ECharts load failed", e);
    return null;
  }
}

// Ring progress SVG hand-rolled (murah, no ECharts). Token-only: warna/durasi dari CSS (.ring-*), bukan inline style.
export function renderRingProgress(container, percent, options = {}) {
  const { size = 120, stroke = 10 } = options;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const NS = "http://www.w3.org/2000/svg";

  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "ring-wrap";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", options.srLabel || `${pct}% selesai`);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ring-svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(NS, "circle");
  track.setAttribute("class", "ring-track");
  const arc = document.createElementNS(NS, "circle");
  arc.setAttribute("class", "ring-arc");
  for (const c of [track, arc]) {
    c.setAttribute("cx", String(size / 2));
    c.setAttribute("cy", String(size / 2));
    c.setAttribute("r", String(radius));
    c.setAttribute("fill", "none");
    c.setAttribute("stroke-width", String(stroke));
  }
  arc.setAttribute("stroke-linecap", "round");
  arc.setAttribute("stroke-dasharray", String(circ));
  arc.setAttribute("stroke-dashoffset", String(offset));
  svg.append(track, arc);
  const label = document.createElement("div");
  label.className = "ring-label";
  label.textContent = `${pct}%`;
  wrap.append(svg, label);

  // Tabel data (aksesibilitas): <details> token-only
  const details = document.createElement("details");
  details.className = "chart-data";
  const summary = document.createElement("summary");
  summary.className = "chart-data-summary";
  summary.textContent = "Data tabel";
  const table = document.createElement("table");
  table.className = "chart-data-table";
  const tr = document.createElement("tr");
  const td1 = document.createElement("td");
  td1.textContent = "Selesai";
  const td2 = document.createElement("td");
  td2.textContent = `${pct}%`;
  tr.append(td1, td2);
  table.appendChild(tr);
  details.append(summary, table);

  container.append(wrap, details);
  return container;
}

// Streak dots (token-only: .streak-dot / .filled)
export function renderStreakDots(container, streakDays, max = 30) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "streak-dots";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", `Streak ${streakDays} hari dari ${max}`);
  for (let i = 0; i < max; i++) {
    const dot = document.createElement("span");
    dot.className = i < streakDays ? "streak-dot filled" : "streak-dot";
    dot.setAttribute("aria-hidden", "true");
    wrap.appendChild(dot);
  }
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = `${streakDays} hari streak`;
  wrap.appendChild(sr);
  container.appendChild(wrap);
  return container;
}

// Bar 7 hari habit (ECharts)
export async function renderHabitBar(container, data, options = {}) {
  const echarts = await loadECharts();
  if (!echarts) {
    container.innerHTML = `<p class="placeholder">Chart tidak tersedia</p>`;
    return null;
  }

  const tier = getAdaptiveTier();
  const points = tier.fidelity.chartPoints;

  // Don't render hidden tabs (spec 16: defer until visible)
  if (container.offsetParent === null) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderHabitBar(container, data, options);
      }
    });
    observer.observe(container);
    return null;
  }

  const chart = echarts.init(container, null, { renderer: "canvas" });

  const option = {
    tooltip: { trigger: "axis", backgroundColor: tokenColor("--surface-elevated"), borderRadius: 16, textStyle: { fontSize: 14 } },
    grid: { left: 16, right: 16, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0 },
    series: [{ type: "bar", data: data.map((d) => d.done), itemStyle: { color: tokenColor("--primary"), borderRadius: [8,8,0,0] }, animation: !options.reduceMotion }],
  };

  chart.setOption(option);

  // Resize observer per container (spec 16)
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(container);

  // Tap bar → filter histori hari itu (spec 16)
  chart.on("click", (params) => {
    const date = params.name;
    location.hash = `#/habit?from=${date}&to=${date}`;
    if (options.onSlice) options.onSlice({ chart: "habit-bar", key: date });
  });

  // Fullscreen
  makeChartFullscreenable(container);

  // Orientation adaptive
  onOrientationChange(() => chart.resize());

  // SR summary
  const srSummary = document.createElement("p");
  srSummary.className = "sr-only";
  srSummary.textContent = `Bar 7 hari: ${data.map((d) => `${d.date} ${d.done} selesai`).join(", ")}`;
  container.appendChild(srSummary);

  return chart;
}

// Donut kategori (Pie) — tap slice → filter feed
export async function renderDonutCategory(container, data, options = {}) {
  const echarts = await loadECharts();
  if (!echarts) {
    container.innerHTML = `<p class="placeholder">Chart tidak tersedia</p>`;
    return null;
  }

  if (container.offsetParent === null) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderDonutCategory(container, data, options);
      }
    });
    observer.observe(container);
    return null;
  }

  const chart = echarts.init(container, null, { renderer: "canvas" });

  const option = {
    tooltip: { trigger: "item", backgroundColor: tokenColor("--surface-elevated"), borderRadius: 16 },
    legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 12 } },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: tokenColor("--surface-elevated"), borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
        data: data.map((d) => ({ name: d.key, value: d.total, itemStyle: { color: d.color || tokenColor("--primary") } })),
        animation: !options.reduceMotion,
      },
    ],
  };

  chart.setOption(option);

  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(container);

  chart.on("click", (params) => {
    const cat = params.name;
    location.hash = `#/uang?cat=${encodeURIComponent(cat)}`;
    if (options.onSlice) options.onSlice({ chart: "donut-category", key: cat });
  });

  makeChartFullscreenable(container);
  onOrientationChange(() => chart.resize());

  const srSummary = document.createElement("p");
  srSummary.className = "sr-only";
  srSummary.textContent = `Donut kategori: ${data.map((d) => `${d.key} ${d.total}`).join(", ")}`;
  container.appendChild(srSummary);

  return chart;
}

// Cashflow bar in vs out
export async function renderCashflowBar(container, data, options = {}) {
  const echarts = await loadECharts();
  if (!echarts) return null;

  if (container.offsetParent === null) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderCashflowBar(container, data, options);
      }
    });
    observer.observe(container);
    return null;
  }

  const chart = echarts.init(container);

  const option = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Masuk", "Keluar"] },
    grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.month) },
    yAxis: { type: "value" },
    series: [
      { name: "Masuk", type: "bar", data: data.map((d) => d.in), itemStyle: { color: tokenColor("--positive") } },
      { name: "Keluar", type: "bar", data: data.map((d) => d.out), itemStyle: { color: tokenColor("--negative") } },
    ],
  };

  chart.setOption(option);
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(container);
  makeChartFullscreenable(container);
  return chart;
}

// Lazy scatter — only when data >=3 months (spec 16)
export async function renderScatterIfNeeded(container, data, options = {}) {
  const range = getRange();
  const months = data.length;

  if (months < 3) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = `Butuh ≥3 bulan untuk scatter. Data sekarang ${months} bulan. `;
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "btn btn-secondary btn-small";
    expand.textContent = "Perluas ke 3 bulan";
    expand.addEventListener("click", () => { location.hash = "#/uang?preset=month"; });
    p.appendChild(expand);
    container.appendChild(p);
    return null;
  }

  const tier = getAdaptiveTier();
  if (!tier.fidelity.enableScatter) {
    container.innerHTML = `<p class="placeholder">Scatter dinonaktifkan di mode hemat (tier ${tier.tier}).</p>`;
    return null;
  }

  // Lazy import scatter
  const echarts = await loadECharts();
  if (!echarts) return null;

  if (container.offsetParent === null) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        renderScatterIfNeeded(container, data, options);
      }
    });
    observer.observe(container);
    return null;
  }

  const chart = echarts.init(container);

  const option = {
    tooltip: { trigger: "item" },
    xAxis: { name: "Streak", type: "value" },
    yAxis: { name: "Impulsif", type: "value" },
    series: [{ type: "scatter", data: data.map((d) => [d.streak, d.impulsive]), symbolSize: 12, itemStyle: { color: tokenColor("--primary") } }],
  };

  chart.setOption(option);
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(container);
  makeChartFullscreenable(container);

  // Disclaimer korelasi≠kausalitas (token-only: .chart-disclaimer, tanpa inline style)
  const disclaimer = document.createElement("p");
  disclaimer.className = "placeholder chart-disclaimer";
  disclaimer.textContent = "Korelasi ≠ kausalitas. Data deskriptif saja.";
  container.appendChild(disclaimer);

  return chart;
}

export const charts = {
  renderRingProgress,
  renderStreakDots,
  renderHabitBar,
  renderDonutCategory,
  renderCashflowBar,
  renderScatterIfNeeded,
};
