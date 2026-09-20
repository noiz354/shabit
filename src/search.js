/**
 * HabitWealth search — T19 + AUD-SEARCH-01
 * APIs 37,157,158: Input Events, Selection, Range
 * - Global search box + 4 scope tabs + ranking + history max-5 lokal + offline index
 * - Debounce 250ms, min 2 char, highlight <mark>, masking tetap berlaku
 * - History TIDAK di-sync, TIDAK masuk analytics (tanpa q mentah)
 */

import { getSearchHistory, addSearchHistory, removeHistoryItem, clearSearchHistory } from "./storage/prefs.js";
import { idbGetAll } from "./storage/db.js";
import { indexSearchDocs, searchInWorker, postTask, runIdle } from "./workers/index.js";
import { track } from "./analytics.js";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_RESULTS = 50;

let searchIndex = null; // {tokens, docs}
let debounceTimer = null;
let lastQuery = "";

async function buildIndexFromIDB() {
  try {
    const [habits, transactions, budgets] = await Promise.all([
      idbGetAll("habits", null, undefined, 2000).catch(() => []),
      idbGetAll("transactions", null, undefined, 2000).catch(() => []),
      idbGetAll("budgets", null, undefined, 200).catch(() => []),
    ]);

    const docs = [
      ...habits.map((h) => ({ id: h.id, type: "habit", title: h.title, note: h.category, category: h.category, updatedAt: h.updatedAt })),
      ...transactions.map((t) => ({ id: t.id, type: "uang", title: t.category, note: t.note, category: t.category, amount: t.amount, updatedAt: t.updatedAt })),
      ...budgets.map((b) => ({ id: b.id, type: "budget", title: b.category, category: b.category, updatedAt: b.updatedAt })),
    ];

    // Add FAQ static
    const faqDocs = [
      { id: "faq_1", type: "bantuan", title: "Cara menambah habit", note: "Buka tab Habit → Tambah", category: "bantuan", updatedAt: Date.now() },
      { id: "faq_2", type: "bantuan", title: "Saldo dimasking", note: "Rp•••• untuk privasi, re-auth untuk reveal", category: "bantuan", updatedAt: Date.now() },
      { id: "faq_3", type: "bantuan", title: "Data offline", note: "IndexedDB + outbox sync otomatis", category: "bantuan", updatedAt: Date.now() },
    ];

    const allDocs = [...docs, ...faqDocs].slice(0, 2000);

    const res = await indexSearchDocs(allDocs).catch(() => null);
    if (res && res.index) {
      searchIndex = res.index;
    } else {
      // Fallback main thread index
      searchIndex = buildIndexMainThread(allDocs);
    }

    try {
      localStorage.setItem("hw:search:index:ts", String(Date.now()));
    } catch {}

    return searchIndex;
  } catch (e) {
    console.warn("[search] build index failed", e);
    return null;
  }
}

function buildIndexMainThread(docs) {
  const tokenMap = {};
  const docMap = {};

  function tokenize(text) {
    if (!text) return [];
    const lower = String(text).toLowerCase().replace(/\./g, "").replace(/rp/g, "").trim();
    const tokens = lower.split(/[\s,;]+/).filter(Boolean);
    const ngrams = [];
    for (const token of tokens) {
      ngrams.push(token);
      for (let i = 1; i <= Math.min(8, token.length - 1); i++) ngrams.push(token.slice(0, i));
    }
    return [...new Set(ngrams)];
  }

  for (const doc of docs) {
    docMap[doc.id] = doc;
    const fields = [doc.title, doc.note, doc.category, doc.amount ? String(doc.amount).replace(/\./g, "") : ""].filter(Boolean).join(" ");
    const tokens = tokenize(fields);
    for (const token of tokens) {
      if (!tokenMap[token]) tokenMap[token] = [];
      if (!tokenMap[token].includes(doc.id)) tokenMap[token].push(doc.id);
    }
  }

  return { tokens: tokenMap, docs: docMap };
}

// Kualitas kecocokan per token query (spec 19: exact > prefix > substring), dihitung dari teks dokumen —
// bukan dari akumulasi n-gram (yang membuat "kopitiam" mengalahkan "kopi").
function docText(doc) {
  return [doc.title, doc.note, doc.category, doc.amount ? String(doc.amount).replace(/\./g, "") : "", doc.source, doc.merchant]
    .filter(Boolean).join(" ").toLowerCase().replace(/\./g, "");
}
function matchQuality(doc, qt) {
  const text = docText(doc);
  if (!text) return 0;
  const words = text.split(/[\s,;]+/).filter(Boolean);
  if (words.includes(qt)) return 3;
  if (words.some((w) => w.startsWith(qt))) return 2;
  if (text.includes(qt)) return 1;
  return 0;
}
function scoreCandidates(queryTokens, index) {
  const { tokens, docs } = index;
  const candidates = new Set();
  for (const qt of queryTokens) {
    for (const [token, ids] of Object.entries(tokens)) {
      if (token === qt || token.startsWith(qt) || token.includes(qt)) ids.forEach((id) => candidates.add(id));
    }
  }
  const results = [];
  for (const id of candidates) {
    const doc = docs[id];
    if (!doc) continue;
    let score = 0;
    for (const qt of queryTokens) score += matchQuality(doc, qt);
    if (score > 0) results.push({ id, score, doc, updatedAt: doc.updatedAt || 0 });
  }
  return results.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}

function searchMainThread(q, index) {
  if (!q || q.trim().length < MIN_CHARS) return [];
  const queryTokens = q.toLowerCase().replace(/\./g, "").split(/[\s,;]+/).filter(Boolean);
  return scoreCandidates(queryTokens, index).slice(0, MAX_RESULTS);
}

export async function searchGlobal(q) {
  if (!q || q.trim().length < MIN_CHARS) {
    return { results: [], history: getSearchHistory(), isHistory: true };
  }

  if (!searchIndex) {
    await buildIndexFromIDB();
  }

  if (!searchIndex) return { results: [], q };

  try {
    // Try worker first
    const workerRes = await searchInWorker(q, searchIndex).catch(() => null);
    let results;
    if (workerRes && workerRes.results) {
      results = workerRes.results;
    } else {
      results = searchMainThread(q, searchIndex);
    }

    // Group by scope tabs: Semua | Habit | Uang | Budget | Bantuan
    const grouped = {
      semua: results,
      habit: results.filter((r) => r.doc.type === "habit"),
      uang: results.filter((r) => r.doc.type === "uang"),
      budget: results.filter((r) => r.doc.type === "budget"),
      bantuan: results.filter((r) => r.doc.type === "bantuan"),
    };

    return { results, grouped, q, offline: !navigator.onLine, ts: Date.now() };
  } catch (e) {
    console.warn("[search] failed", e);
    return { results: [], q, error: String(e) };
  }
}

function highlightMatch(text, q) {
  if (!q || !text) return text;
  try {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${esc})`, "gi");
    const safe = String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safe.replace(regex, "<mark>$1</mark>");
  } catch {
    return text;
  }
}

// UI: search box + bottom-sheet full (mobile) / panel kanan (≥600dp)
export function createSearchUI(container, options = {}) {
  const { onResultClick } = options;

  const wrapper = document.createElement("div");
  wrapper.className = "search-ui";
  wrapper.innerHTML = `
    <div class="search-box" role="search">
      <input type="search" placeholder="Cari habit, transaksi, budget, bantuan..." aria-label="Cari" role="searchbox" aria-controls="search-results" style="width:100%;height:48px;border-radius:24px;border:1px solid #E0E0E0;padding:0 16px 0 44px;background:#EEEEEE" />
      <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%)" aria-hidden="true">🔍</span>
    </div>
    <div class="search-history" style="margin-top:12px"></div>
    <div class="search-tabs" style="display:flex;gap:8px;margin-top:12px;overflow:auto"></div>
    <div id="search-results" class="search-results" style="margin-top:12px" aria-live="polite"></div>
  `;

  const input = wrapper.querySelector('input[type="search"]');
  const historyEl = wrapper.querySelector(".search-history");
  const tabsEl = wrapper.querySelector(".search-tabs");
  const resultsEl = wrapper.querySelector("#search-results");

  let activeTab = "semua";

  function renderHistory() {
    const hist = getSearchHistory();
    if (!hist.length) {
      historyEl.innerHTML = `<p class="placeholder" style="font-size:12px">Saran cepat: kopi, listrik, air, jalan, baca</p>`;
      return;
    }
    historyEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:500">Riwayat</span><button class="btn btn-flat btn-small" data-action="clear-history">Hapus semua</button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${hist.map((q) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#F6F6F6;border-radius:16px;padding:4px 12px;font-size:12px">${q} <button data-remove="${q}" aria-label="Hapus ${q}" style="border:none;background:none;cursor:pointer">×</button></span>`).join("")}
      </div>
    `;

    historyEl.querySelector('[data-action="clear-history"]')?.addEventListener("click", () => {
      clearSearchHistory();
      renderHistory();
      track("search_history_cleared", {}).catch(()=>{});
    });
    historyEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = btn.dataset.remove;
        removeHistoryItem(q);
        renderHistory();
      });
    });
  }

  function renderTabs(grouped) {
    if (!grouped) {
      tabsEl.innerHTML = "";
      return;
    }
    const tabs = [
      { key: "semua", label: `Semua (${grouped.semua.length})` },
      { key: "habit", label: `Habit (${grouped.habit.length})` },
      { key: "uang", label: `Uang (${grouped.uang.length})` },
      { key: "budget", label: `Budget (${grouped.budget.length})` },
      { key: "bantuan", label: `Bantuan (${grouped.bantuan.length})` },
    ];
    tabsEl.innerHTML = tabs.map((t) => `<button class="btn btn-secondary btn-small ${activeTab===t.key?'active':''}" data-tab="${t.key}" style="${activeTab===t.key?'background:#0381FE;color:#fff':''}">${t.label}</button>`).join("");

    tabsEl.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        renderTabs(grouped);
        renderResults(grouped[activeTab] || [], lastQuery);
      });
    });
  }

  function renderResults(results, q) {
    if (!q || q.length < MIN_CHARS) {
      resultsEl.innerHTML = "";
      return;
    }

    if (!results.length) {
      resultsEl.innerHTML = `<p class="placeholder">Tidak ada hasil untuk '${q}' <button class="btn btn-flat btn-small" onclick="document.querySelector('.search-ui input').value='';document.querySelector('.search-ui input').dispatchEvent(new Event('input'))">Hapus pencarian</button></p>`;
      // SR announce
      announce(`Tidak ada hasil untuk ${q}`);
      return;
    }

    const offlineBadge = !navigator.onLine ? `<span style="font-size:11px;background:#FFB74D;color:#000;border-radius:8px;padding:2px 6px;margin-left:8px">Hasil offline — data sampai ${new Date().toLocaleTimeString("id-ID")}</span>` : "";

    resultsEl.innerHTML = `
      <p style="font-size:12px;margin-bottom:8px">${results.length} hasil untuk '${q}'${offlineBadge}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${results.map((r) => {
          const doc = r.doc;
          const title = highlightMatch(doc.title || doc.id, q);
          const note = highlightMatch(doc.note || doc.category || "", q);
          return `<div class="search-result" data-id="${doc.id}" data-type="${doc.type}" style="background:#F6F6F6;border-radius:16px;padding:12px;cursor:pointer">
            <div style="font-size:14px;font-weight:500">${title}</div>
            <div style="font-size:12px;color:#666">${note} • <span style="font-size:11px">${doc.type}</span></div>
          </div>`;
        }).join("")}
      </div>
    `;

    resultsEl.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const type = el.dataset.type;
        if (onResultClick) onResultClick({ id, type });
        else {
          // deep-link
          if (type === "habit") location.hash = `#/habit/${id}`;
          else if (type === "uang") location.hash = `#/uang/${id}`;
          else if (type === "budget") location.hash = `#/uang?cat=${encodeURIComponent(id)}`;
          else if (type === "bantuan") location.hash = `#/pengaturan`;
        }
        track("search_result_opened", { scope: type }).catch(()=>{});
      });
    });

    // SR announce once (debounced, not per keystroke)
    announce(`${results.length} hasil untuk ${q}`);
  }

  let announceTimer = null;
  function announce(msg) {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      let live = document.getElementById("hw-search-live");
      if (!live) {
        live = document.createElement("div");
        live.id = "hw-search-live";
        live.setAttribute("aria-live", "polite");
        live.setAttribute("aria-atomic", "true");
        live.style.position = "absolute";
        live.style.left = "-9999px";
        document.body.appendChild(live);
      }
      live.textContent = msg;
    }, 300);
  }

  function onInput() {
    const q = input.value.trim();
    lastQuery = q;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (q.length < MIN_CHARS) {
        renderHistory();
        tabsEl.innerHTML = "";
        resultsEl.innerHTML = "";
        return;
      }

      // Track without raw q
      track("search_executed", { scope: activeTab, result_count: 0, char_len: q.length, offline: !navigator.onLine }).catch(()=>{});

      const res = await searchGlobal(q);
      if (res.grouped) {
        renderTabs(res.grouped);
        renderResults(res.grouped[activeTab] || res.results, q);
        // Update history
        addSearchHistory(q);
        // Don't send q raw to analytics
      } else {
        renderResults([], q);
      }
    }, DEBOUNCE_MS);
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      onInput();
      input.blur();
      // focus back to trigger
      const trigger = document.querySelector("[data-search-trigger]");
      if (trigger) trigger.focus();
    }
  });

  // Initial history
  renderHistory();

  // Build index in idle
  runIdle(() => buildIndexFromIDB(), { timeout: 2000 });

  container.appendChild(wrapper);

  // Public API
  return {
    focus: () => input.focus(),
    clear: () => { input.value = ""; onInput(); },
    destroy: () => wrapper.remove(),
  };
}

export const searchHelpers = {
  searchGlobal,
  createSearchUI,
  buildIndexFromIDB,
};
