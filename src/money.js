/**
 * HabitWealth money — T7 + AUD-STORE-01
 * MoneyOverview/Feed/Add + masking + re-auth mock
 * Acceptance: Rp•••• default
 */

import { idbGetAll, idbPut, idbDel, idbGet } from "./storage/db.js";
import { enqueue } from "./storage/outbox.js";
import { track } from "./analytics.js";
import { getPrefs } from "./storage/prefs.js";

const STORE = "transactions";
const BUDGET_STORE = "budgets";

export function formatRupiah(amount) {
  // amount integer minor (rupiah, tanpa desimal)
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount).replace("IDR", "Rp").replace(/\s/g, "");
  } catch {
    return `Rp${amount.toLocaleString("id-ID")}`;
  }
}

export function maskRupiah() {
  return "Rp••••••";
}

export function maskAccount(account) {
  // BCA •••• 4821
  if (!account) return "••••";
  const last4 = account.slice(-4);
  const bank = account.split(" ")[0] || "BCA";
  return `${bank} •••• ${last4}`;
}

let reAuthSession = null; // {expiresAt}

export function isReAuthed() {
  return reAuthSession && reAuthSession.expiresAt > Date.now();
}

export async function requestReAuth() {
  // Mock re-auth biometric/PIN — for MVP just set session 5 min
  // In real, would call POST /auth/re-auth
  reAuthSession = { expiresAt: Date.now() + 5 * 60 * 1000 };
  try {
    localStorage.setItem("hw:re-auth:expires", String(reAuthSession.expiresAt));
  } catch {}
  return true;
}

export function clearReAuth() {
  reAuthSession = null;
  try {
    localStorage.removeItem("hw:re-auth:expires");
  } catch {}
  return true;
}

export function checkReAuthFromStorage() {
  try {
    const exp = parseInt(localStorage.getItem("hw:re-auth:expires") || "0", 10);
    if (exp > Date.now()) {
      reAuthSession = { expiresAt: exp };
      return true;
    }
  } catch {}
  return false;
}

export function getDisplayAmount(amount) {
  const shouldMask = !isReAuthed();
  if (shouldMask) return maskRupiah();
  return formatRupiah(amount);
}

export async function listTransactions(filters = {}) {
  try {
    let all = await idbGetAll(STORE, null, undefined, 1000);
    // Apply filters: from/to/cat/source/q
    if (filters.from) all = all.filter((t) => t.date >= filters.from);
    if (filters.to) all = all.filter((t) => t.date <= filters.to);
    if (filters.cat) all = all.filter((t) => t.category === filters.cat);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      all = all.filter((t) => {
        return (t.note && t.note.toLowerCase().includes(q)) || (t.category && t.category.toLowerCase().includes(q)) || String(t.amount).includes(q.replace(/\./g, ""));
      });
    }
    // sort
    const sort = filters.sort || "date";
    const order = filters.order || "desc";
    all.sort((a, b) => {
      if (sort === "amount") return order === "asc" ? a.amount - b.amount : b.amount - a.amount;
      return order === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
    return all;
  } catch {
    return [];
  }
}

export async function createTransaction(data) {
  const id = data.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const tx = {
    id,
    kind: data.kind || "expense", // income/expense/transfer
    amount: Math.max(1, parseInt(data.amount, 10) || 0),
    category: data.category || "Lainnya",
    date: data.date || new Date().toISOString().slice(0, 10),
    account_ref: data.account_ref || "BCA •••• 4821",
    note: data.note?.slice(0, 200) || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // T12: ambang budget 80/100 — hitung pct sebelum & sesudah (sekali per kategori/bulan, dedup di notify)
  const month = tx.date.slice(0, 7);
  let pctBefore = null;
  if (tx.kind === "expense") {
    try {
      const st = await getBudgetStatus(month);
      const b = st.find((x) => x.category === tx.category);
      if (b) pctBefore = b.pct;
    } catch {}
  }

  await idbPut(STORE, tx);

  try {
    await enqueue("POST", "/transactions", tx);
  } catch {}

  track("transaction_created", { kind: tx.kind, category: tx.category, has_note: !!tx.note }).catch(() => {});

  if (pctBefore !== null) {
    try {
      const st = await getBudgetStatus(month);
      const a = st.find((x) => x.category === tx.category);
      if (a) {
        const { checkBudgetThresholds } = await import("./notify.js");
        await checkBudgetThresholds(tx.category, month, { before: pctBefore, after: a.pct });
      }
    } catch {}
  }

  return tx;
}

export async function getTransaction(id) {
  try {
    return await idbGet(STORE, id);
  } catch {
    return null;
  }
}

export async function updateTransaction(id, patch) {
  const existing = await idbGet(STORE, id);
  if (!existing) throw new Error("Transaksi tidak ditemukan");
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await idbPut(STORE, updated);
  try {
    await enqueue("PATCH", `/transactions/${id}`, patch);
  } catch {}
  track("category_corrected", { from_to_hash: `${existing.category}->${updated.category}` }).catch(() => {});
  return updated;
}

export async function deleteTransaction(id) {
  await idbDel(STORE, id);
  try {
    await enqueue("DELETE", `/transactions/${id}`, null);
  } catch {}
  return true;
}

// Budgets
export async function listBudgets(month) {
  try {
    let all = await idbGetAll(BUDGET_STORE, null, undefined, 100);
    if (month) all = all.filter((b) => b.month === month);
    return all;
  } catch {
    return [];
  }
}

export async function setBudget(category, limit, month) {
  const id = `${category}_${month}`;
  const budget = { id, category, limit: parseInt(limit, 10), month, updatedAt: Date.now(), createdAt: Date.now() };
  await idbPut(BUDGET_STORE, budget);
  try {
    await enqueue("PUT", "/budgets", budget);
  } catch {}
  return budget;
}

export async function getBudgetStatus(month) {
  const budgets = await listBudgets(month);
  const txs = await listTransactions({ from: `${month}-01`, to: `${month}-31` });

  const byCat = {};
  for (const tx of txs) {
    if (tx.kind === "expense") {
      byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount;
    }
  }

  return budgets.map((b) => {
    const spent = byCat[b.category] || 0;
    const pct = b.limit ? Math.round((spent / b.limit) * 100) : 0;
    let status = "ok";
    if (pct >= 100) status = "over";
    else if (pct >= 80) status = "warning";
    return { ...b, spent, pct, status };
  });
}

export const moneyHelpers = {
  formatRupiah,
  maskRupiah,
  maskAccount,
  isReAuthed,
  requestReAuth,
  clearReAuth,
  checkReAuthFromStorage,
  getDisplayAmount,
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listBudgets,
  setBudget,
  getBudgetStatus,
};
