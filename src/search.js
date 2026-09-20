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

/**
 * Normalisasi query — HARUS identik dengan `search()` di workers/search-indexer.js (paritas jalur worker vs main thread):
 * lowercase, titik ribuan dibuang, awalan "rp" dibuang ("Rp10.000" → "10000"), pisah spasi/koma/titik-koma.
 */
export function normalizeQuery(q) {
  return String(q || "").toLowerCase().replace(/\./g, "").replace(/rp/g, "").trim().split(/[\s,;]+/).filter(Boolean);
}

export function searchMainThread(q, index) {
  if (!q || q.trim().length < MIN_CHARS) return [];
  const queryTokens = normalizeQuery(q);
  if (!queryTokens.length) return [];
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

/**
 * Highlight <mark> berbasis DOM (spec 19): teks dipecah per kecocokan (case-insensitive) → text node + <mark>.
 * Tidak memakai innerHTML, jadi markup di judul/catatan pengguna tidak pernah dieksekusi.
 */
export function renderHighlighted(target, text, q) {
  const str = String(text ?? "");
  target.textContent = "";
  const needle = String(q || "").trim();
  if (!needle) {
    target.appendChild(document.createTextNode(str));
    return target;
  }
  const lower = str.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0;
  let idx = lower.indexOf(n, i);
  while (idx !== -1) {
    if (idx > i) target.appendChild(document.createTextNode(str.slice(i, idx)));
    const mark = document.createElement("mark");
    mark.textContent = str.slice(idx, idx + n.length);
    target.appendChild(mark);
    i = idx + n.length;
    idx = lower.indexOf(n, i);
  }
  if (i < str.length) target.appendChild(document.createTextNode(str.slice(i)));
  return target;
}

function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// UI: search box + bottom-sheet full (mobile) / panel kanan (≥600dp)
export function createSearchUI(container, options = {}) {
  const { onResultClick } = options;

  const wrapper = h("div", "search-ui");
  const box = h("div", "search-box");
  box.setAttribute("role", "search");
  const input = h("input", "search-input");
  input.type = "search";
  input.placeholder = "Cari habit, transaksi, budget, bantuan...";
  input.setAttribute("aria-label", "Cari");
  input.setAttribute("aria-controls", "search-results");
  input.autocomplete = "off";
  const icon = h("span", "search-icon", "🔍");
  icon.setAttribute("aria-hidden", "true");
  box.append(icon, input);
  const historyEl = h("div", "search-history");
  const tabsEl = h("div", "segmented search-tabs");
  tabsEl.setAttribute("role", "group");
  tabsEl.setAttribute("aria-label", "Cakupan pencarian");
  const resultsEl = h("div", "search-results");
  resultsEl.id = "search-results";
  resultsEl.setAttribute("aria-live", "polite");
  wrapper.append(box, historyEl, tabsEl, resultsEl);

  let activeTab = "semua";
  let lastGrouped = null;

  function renderHistory() {
    historyEl.textContent = "";
    const hist = getSearchHistory();
    if (!hist.length) {
      historyEl.appendChild(h("p", "placeholder text-sm", "Saran cepat: kopi, listrik, air, jalan, baca"));
      return;
    }
    const head = h("div", "row-between");
    head.appendChild(h("span", "label-sm", "Riwayat"));
    const clearBtn = h("button", "btn btn-flat btn-small", "Hapus semua");
    clearBtn.type = "button";
    clearBtn.dataset.action = "clear-history";
    clearBtn.addEventListener("click", () => {
      clearSearchHistory();
      renderHistory();
      track("search_history_cleared", {}).catch(() => {});
    });
    head.appendChild(clearBtn);
    const chips = h("div", "chip-row search-chips");
    hist.forEach((q) => {
      const chip = h("span", "search-chip");
      const use = h("button", "search-chip-label", q);
      use.type = "button";
      use.setAttribute("aria-label", `Cari lagi ${q}`);
      use.addEventListener("click", () => { input.value = q; onInput(); input.focus(); });
      const rm = h("button", "search-chip-remove", "×");
      rm.type = "button";
      rm.dataset.remove = q;
      rm.setAttribute("aria-label", `Hapus ${q}`);
      rm.addEventListener("click", () => { removeHistoryItem(q); renderHistory(); });
      chip.append(use, rm);
      chips.appendChild(chip);
    });
    historyEl.append(head, chips);
  }

  function renderTabs(grouped) {
    tabsEl.textContent = "";
    if (!grouped) return;
    const tabs = [
      { key: "semua", label: `Semua (${grouped.semua.length})` },
      { key: "habit", label: `Habit (${grouped.habit.length})` },
      { key: "uang", label: `Uang (${grouped.uang.length})` },
      { key: "budget", label: `Budget (${grouped.budget.length})` },
      { key: "bantuan", label: `Bantuan (${grouped.bantuan.length})` },
    ];
    tabs.forEach((t) => {
      const b = h("button", "btn btn-secondary btn-small", t.label);
      b.type = "button";
      b.dataset.tab = t.key;
      b.setAttribute("aria-pressed", String(activeTab === t.key));
      b.addEventListener("click", () => {
        activeTab = t.key;
        renderTabs(grouped);
        renderResults(grouped[activeTab] || [], lastQuery);
      });
      tabsEl.appendChild(b);
    });
  }

  function renderResults(results, q) {
    resultsEl.textContent = "";
    if (!q || q.length < MIN_CHARS) return;

    if (!results.length) {
      const p = h("p", "placeholder search-empty");
      p.appendChild(document.createTextNode(`Tidak ada hasil untuk '${q}' `));
      const clear = h("button", "btn btn-flat btn-small", "Hapus pencarian");
      clear.type = "button";
      clear.addEventListener("click", () => { input.value = ""; onInput(); input.focus(); });
      p.appendChild(clear);
      resultsEl.appendChild(p);
      announce(`Tidak ada hasil untuk ${q}`);
      return;
    }

    const meta = h("p", "search-meta", `${results.length} hasil untuk '${q}'`);
    if (!navigator.onLine) {
      // Non-color cue: ikon + teks (bukan warna saja)
      const badge = h("span", "search-offline");
      const ic = h("span", "", "📴 ");
      ic.setAttribute("aria-hidden", "true");
      badge.append(ic, document.createTextNode(`Hasil offline — data sampai ${new Date().toLocaleTimeString("id-ID")}`));
      meta.appendChild(badge);
    }
    resultsEl.appendChild(meta);

    const list = h("div", "search-list");
    results.forEach((r) => {
      const doc = r.doc;
      const item = h("button", "search-result");
      item.type = "button";
      item.dataset.id = doc.id;
      item.dataset.type = doc.type;
      const title = h("div", "search-result-title");
      renderHighlighted(title, doc.title || doc.id, q);
      const sub = h("div", "search-result-sub");
      const note = h("span", "");
      renderHighlighted(note, doc.note || doc.category || "", q);
      sub.append(note, document.createTextNode(" • "), h("span", "search-result-type", doc.type));
      item.append(title, sub);
      item.addEventListener("click", () => {
        const { id, type } = item.dataset;
        if (onResultClick) onResultClick({ id, type });
        else {
          if (type === "habit") location.hash = `#/habit/${id}`;
          else if (type === "uang") location.hash = `#/uang/${id}`;
          else if (type === "budget") location.hash = `#/uang?cat=${encodeURIComponent(id)}`;
          else if (type === "bantuan") location.hash = `#/pengaturan`;
        }
        track("search_result_opened", { scope: type }).catch(() => {});
      });
      list.appendChild(item);
    });
    resultsEl.appendChild(list);

    // SR announce once (debounced, not per keystroke)
    announce(`${results.length} hasil untuk ${q}`);
  }

  let announceTimer = null;
  function announce(msg) {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      let live = document.getElementById("hw-search-live");
      if (!live) {
        live = h("div", "sr-only");
        live.id = "hw-search-live";
        live.setAttribute("aria-live", "polite");
        live.setAttribute("aria-atomic", "true");
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
        renderTabs(null);
        renderResults([], q);
        return;
      }
      const res = await searchGlobal(q);
      lastGrouped = res.grouped || null;
      // Track tanpa q mentah, dengan result_count nyata (sebelumnya selalu 0 karena dikirim sebelum hasil ada)
      track("search_executed", { scope: activeTab, result_count: res.results ? res.results.length : 0, char_len: q.length, offline: !navigator.onLine }).catch(() => {});
      if (res.grouped) {
        renderTabs(res.grouped);
        renderResults(res.grouped[activeTab] || res.results, q);
        addSearchHistory(q);
      } else {
        renderTabs(null);
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
      const trigger = document.querySelector("[data-search-trigger]");
      if (trigger) trigger.focus();
    }
  });

  renderHistory();
  runIdle(() => buildIndexFromIDB(), { timeout: 2000 });
  container.appendChild(wrapper);

  return {
    focus: () => input.focus(),
    clear: () => { input.value = ""; onInput(); },
    destroy: () => wrapper.remove(),
    get activeTab() { return activeTab; },
    get grouped() { return lastGrouped; },
  };
}

export const searchHelpers = {
  searchGlobal,
  createSearchUI,
  buildIndexFromIDB,
  normalizeQuery,
  renderHighlighted,
};
