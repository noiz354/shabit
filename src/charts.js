/**
 * HabitWealth charts — T16 + AUD-WORK-01 + AUD-ORIENT-01 + AUD-NET-01
 * ECharts core+Bar/Pie, ring/streak SVG, donut-tap-filter, lazy scatter
 * Acceptance: bundle awal <200KB gzip, tiap chart ada SR-summary
 */

import { getAdaptiveTier } from "./net.js";
import { getRange } from "./storage/prefs.js";
import { onOrientationChange, makeChartFullscreenable } from "./orientation.js";

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

// Ring progress SVG hand-rolled (murah, no ECharts)
export function renderRingProgress(container, percent, options = {}) {
  const { size = 120, stroke = 10, color = "#0381FE", bg = "#EEEEEE" } = options;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;

  container.innerHTML = `
    <div role="img" aria-label="${options.srLabel || `${percent}% selesai`}" style="position:relative;width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${bg}" stroke-width="${stroke}" />
        <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition: stroke-dashoffset 350ms cubic-bezier(0,0,0,1)" />
      </svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px">${percent}%</div>
    </div>
    <details style="margin-top:8px"><summary style="font-size:12px;color:#666">Data tabel</summary><table style="font-size:12px"><tr><td>Selesai</td><td>${percent}%</td></tr></table></details>
  `;

  return container;
}

// Streak dots SVG
export function renderStreakDots(container, streakDays, max = 30) {
  const dots = [];
  for (let i = 0; i < max; i++) {
    const filled = i < streakDays;
    dots.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${filled ? "#0381FE" : "#EEEEEE"};margin:2px" aria-hidden="true"></span>`);
  }
  container.innerHTML = `
    <div role="img" aria-label="Streak ${streakDays} hari dari ${max}">
      ${dots.join("")}
      <span class="sr-only">${streakDays} hari streak</span>
    </div>
  `;
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
    tooltip: { trigger: "axis", backgroundColor: "#FFFFFF", borderRadius: 16, textStyle: { fontSize: 14 } },
    grid: { left: 16, right: 16, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0 },
    series: [{ type: "bar", data: data.map((d) => d.done), itemStyle: { color: "#0381FE", borderRadius: [8,8,0,0] }, animation: !options.reduceMotion }],
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
    tooltip: { trigger: "item", backgroundColor: "#FFFFFF", borderRadius: 16 },
    legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 12 } },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
        data: data.map((d) => ({ name: d.key, value: d.total, itemStyle: { color: d.color || "#0381FE" } })),
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
      { name: "Masuk", type: "bar", data: data.map((d) => d.in), itemStyle: { color: "#0AA64E" } },
      { name: "Keluar", type: "bar", data: data.map((d) => d.out), itemStyle: { color: "#D93B30" } },
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
    container.innerHTML = `<p class="placeholder">Butuh ≥3 bulan untuk scatter. Data sekarang ${months} bulan. <button class="btn btn-secondary btn-small" onclick="location.hash='#/uang?preset=month'">Perluas ke 3 bulan</button></p>`;
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
    series: [{ type: "scatter", data: data.map((d) => [d.streak, d.impulsive]), symbolSize: 12, itemStyle: { color: "#0381FE" } }],
  };

  chart.setOption(option);
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(container);
  makeChartFullscreenable(container);

  // Disclaimer korelasi≠kausalitas
  const disclaimer = document.createElement("p");
  disclaimer.className = "placeholder";
  disclaimer.style.fontSize = "11px";
  disclaimer.style.marginTop = "8px";
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
