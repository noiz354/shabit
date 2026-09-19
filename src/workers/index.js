/**
 * HabitWealth workers facade — AUD-WORK-01
 * Manages worker pool sizing via hardwareConcurrency + MessageChannel + scheduler.postTask + rIC
 */

import { getWorkerPoolSize } from "../net.js";

let searchWorker = null;
let exportWorker = null;
let chartsWorker = null;

function createWorker(url) {
  try {
    return new Worker(new URL(url, import.meta.url), { type: "module" });
  } catch (e) {
    console.warn("[workers] create failed", url, e);
    return null;
  }
}

export function getSearchWorker() {
  if (!searchWorker) {
    searchWorker = createWorker("./search-indexer.js");
  }
  return searchWorker;
}

export function getExportWorker() {
  if (!exportWorker) {
    exportWorker = createWorker("./export-builder.js");
  }
  return exportWorker;
}

export function getChartsWorker() {
  if (!chartsWorker) {
    chartsWorker = createWorker("./charts-worker.js");
  }
  return chartsWorker;
}

// Helper: post task with scheduler.postTask fallback
export function postTask(task, opts = {}) {
  const { priority = "user-visible" } = opts;
  if (window.scheduler && window.scheduler.postTask) {
    return window.scheduler.postTask(task, { priority });
  }
  // fallback: setTimeout with priority mapping
  return new Promise((resolve) => {
    const delay = priority === "background" ? 100 : 0;
    setTimeout(async () => {
      try {
        const res = await task();
        resolve(res);
      } catch (e) {
        console.warn("[postTask] failed", e);
        resolve(null);
      }
    }, delay);
  });
}

// Helper: requestIdleCallback fallback
export function runIdle(task, opts = {}) {
  const { timeout = 2000 } = opts;
  if ("requestIdleCallback" in window) {
    return new Promise((resolve) => {
      requestIdleCallback(async (deadline) => {
        try {
          const res = await task(deadline);
          resolve(res);
        } catch (e) {
          console.warn("[rIC] failed", e);
          resolve(null);
        }
      }, { timeout });
    });
  }
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const res = await task({ timeRemaining: () => 50, didTimeout: false });
        resolve(res);
      } catch (e) {
        resolve(null);
      }
    }, 100);
  });
}

// Worker communication with structured clone + id
let msgId = 0;
function workerRequest(worker, type, payload) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("worker not available"));
      return;
    }
    const id = `${Date.now()}_${msgId++}`;
    const handler = (e) => {
      if (e.data && e.data.id === id) {
        worker.removeEventListener("message", handler);
        if (e.data.type === "error") reject(new Error(e.data.error));
        else resolve(e.data);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id, type, payload });
    // timeout 10s
    setTimeout(() => {
      worker.removeEventListener("message", handler);
      reject(new Error("worker timeout"));
    }, 10000);
  });
}

export async function indexSearchDocs(docs) {
  const worker = getSearchWorker();
  if (!worker) {
    // fallback main thread
    const { tokenize } = await import("../search.js").catch(() => ({ tokenize: (t) => [t] }));
    return null;
  }
  return workerRequest(worker, "index", { docs });
}

export async function searchInWorker(q, index) {
  const worker = getSearchWorker();
  if (!worker) return null;
  return workerRequest(worker, "search", { q, index });
}

export async function buildExportJSON(data, fileName) {
  const worker = getExportWorker();
  if (!worker) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    return { blob, size: blob.size, fileName };
  }
  const res = await workerRequest(worker, "build-json", { data, fileName });
  return res;
}

export async function buildExportCSV(rows, fileName, headers) {
  const worker = getExportWorker();
  if (!worker) {
    const csv = rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    return { blob, size: blob.size, fileName };
  }
  const res = await workerRequest(worker, "build-csv", { rows, fileName, headers });
  return res;
}

export async function crunchCashflow(transactions, range) {
  const worker = getChartsWorker();
  if (!worker) {
    // fallback main thread
    let totalIn = 0, totalOut = 0;
    const byCat = {};
    for (const tx of transactions) {
      const cat = tx.category || "Lainnya";
      byCat[cat] = (byCat[cat] || 0) + (tx.amount || 0);
      if (tx.kind === "income") totalIn += tx.amount || 0;
      else totalOut += tx.amount || 0;
    }
    return { byCategory: Object.entries(byCat).map(([k, v]) => ({ key: k, total: v })), totalIn, totalOut };
  }
  const res = await workerRequest(worker, "crunch-cashflow", { transactions, range });
  return res.result;
}

export const workers = {
  getSearchWorker,
  getExportWorker,
  getChartsWorker,
  postTask,
  runIdle,
  indexSearchDocs,
  searchInWorker,
  buildExportJSON,
  buildExportCSV,
  crunchCashflow,
  getPoolSize: getWorkerPoolSize,
};
