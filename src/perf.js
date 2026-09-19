/**
 * HabitWealth perf — AUD-PERF-01
 * APIs 140,161-168: PerformanceObserver, Performance, Navigation Timing, Resource Timing, User Timing, Long Tasks, Event Timing, LCP, CLS
 * - LCP/CLS/INP/longtask observation feeding QA budgets (spec 13,14: LCP<2.5s/CLS<0.1)
 * - Beacon on pagehide (ID 60)
 */

let observers = [];
let marks = {};

function isPerformanceObserverSupported() {
  return typeof PerformanceObserver !== "undefined";
}

export function mark(name) {
  try {
    performance.mark(name);
    marks[name] = performance.now();
  } catch {}
}

export function measure(name, startMark, endMark) {
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, "measure");
    return entries[entries.length - 1];
  } catch {
    return null;
  }
}

export function initPerfObserver(options = {}) {
  const { onLCP, onCLS, onINP, onLongTask } = options;
  if (!isPerformanceObserverSupported()) {
    console.warn("[perf] PerformanceObserver not supported");
    return [];
  }

  // LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      // console.debug("[perf] LCP", last.startTime, last.element);
      if (onLCP) onLCP(last);
      // Store for QA
      try {
        localStorage.setItem("hw:perf:lcp", JSON.stringify({ value: last.startTime, at: Date.now() }));
      } catch {}
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch (e) {
    console.warn("[perf] LCP observer failed", e);
  }

  // CLS
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          if (onCLS) onCLS({ value: clsValue, entry });
          try {
            localStorage.setItem("hw:perf:cls", JSON.stringify({ value: clsValue, at: Date.now() }));
          } catch {}
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    observers.push(clsObserver);
  } catch (e) {
    console.warn("[perf] CLS observer failed", e);
  }

  // INP / Event Timing
  try {
    const inpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (onINP) onINP(last);
      try {
        localStorage.setItem("hw:perf:inp", JSON.stringify({ value: last.duration, at: Date.now() }));
      } catch {}
    });
    // event timing with duration threshold
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
    observers.push(inpObserver);
  } catch (e) {
    // Fallback: first-input
    try {
      const fiObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const first = entries[0];
        if (onINP) onINP(first);
      });
      fiObserver.observe({ type: "first-input", buffered: true });
      observers.push(fiObserver);
    } catch {}
  }

  // Long Tasks
  try {
    const ltObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (onLongTask) onLongTask(entry);
        // console.debug("[perf] longtask", entry.duration);
      }
    });
    ltObserver.observe({ type: "longtask", buffered: true });
    observers.push(ltObserver);
  } catch (e) {
    console.warn("[perf] longtask observer failed", e);
  }

  // Resource Timing for ECharts chunk weight (ID 163)
  try {
    const resObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes("echarts") || entry.name.includes("chunk")) {
          try {
            localStorage.setItem(`hw:perf:resource:${entry.name}`, JSON.stringify({ duration: entry.duration, size: entry.transferSize, at: Date.now() }));
          } catch {}
        }
      }
    });
    resObserver.observe({ type: "resource", buffered: true });
    observers.push(resObserver);
  } catch {}

  // Navigation Timing (ID 162)
  try {
    const navEntries = performance.getEntriesByType("navigation");
    if (navEntries.length) {
      const nav = navEntries[0];
      try {
        localStorage.setItem("hw:perf:navigation", JSON.stringify({ domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, at: Date.now() }));
      } catch {}
    }
  } catch {}

  return observers;
}

export function getPerfMetrics() {
  try {
    const lcp = JSON.parse(localStorage.getItem("hw:perf:lcp") || "null");
    const cls = JSON.parse(localStorage.getItem("hw:perf:cls") || "null");
    const inp = JSON.parse(localStorage.getItem("hw:perf:inp") || "null");
    const nav = JSON.parse(localStorage.getItem("hw:perf:navigation") || "null");
    return { lcp, cls, inp, nav };
  } catch {
    return {};
  }
}

export function checkBudgets() {
  const metrics = getPerfMetrics();
  const budgets = {
    lcp: 2500, // ms
    cls: 0.1,
    inp: 200,
  };
  const result = {
    lcp: { value: metrics.lcp?.value, budget: budgets.lcp, pass: metrics.lcp ? metrics.lcp.value < budgets.lcp : null },
    cls: { value: metrics.cls?.value, budget: budgets.cls, pass: metrics.cls ? metrics.cls.value < budgets.cls : null },
    inp: { value: metrics.inp?.value, budget: budgets.inp, pass: metrics.inp ? metrics.inp.value < budgets.inp : null },
  };
  return result;
}

// Beacon perf on pagehide
export function initPerfBeacon() {
  function sendBeacon() {
    try {
      const metrics = getPerfMetrics();
      const budgets = checkBudgets();
      const payload = { metrics, budgets, ts: new Date().toISOString(), url: location.href };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/v1/reports", blob);
      }
    } catch {}
  }

  window.addEventListener("pagehide", sendBeacon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendBeacon();
  });
}

export const perfHelpers = {
  mark,
  measure,
  initPerfObserver,
  getPerfMetrics,
  checkBudgets,
  initPerfBeacon,
};
