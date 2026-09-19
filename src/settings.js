/**
 * HabitWealth settings — T8 + AUD-STORE-01 + AUD-THEME-01
 * Settings/Export/Delete mock + Help
 * Acceptance: confirm destruktif + re-auth
 */

import { getPrefs, setPrefs } from "./storage/prefs.js";
import { idbGetAll, idbClear, getDB } from "./storage/db.js";
import { requestReAuth, isReAuthed } from "./money.js";
import { track } from "./analytics.js";
import { buildExportJSON, buildExportCSV } from "./workers/index.js";
import { writeFile } from "./storage/opfs.js";

export async function getSettings() {
  return getPrefs();
}

export async function updateSetting(path, value) {
  const prefs = await getPrefs();
  const keys = path.split(".");
  let obj = prefs;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  await setPrefs(prefs);
  return prefs;
}

// Export mock
export async function requestExport(scope = "all") {
  // Check re-auth for sensitive export
  if (!isReAuthed()) {
    throw new Error("RE_AUTH_REQUIRED");
  }

  const id = `export_${Date.now()}`;
  const exportMeta = { id, scope, status: "processing", createdAt: Date.now() };

  try {
    const { idbPut } = await import("./storage/db.js");
    await idbPut("export_meta", exportMeta);
  } catch {}

  track("export_requested", { scope }).catch(() => {});

  // Build data in worker
  try {
    const [habits, transactions, budgets] = await Promise.all([
      idbGetAll("habits", null, undefined, 1000).catch(() => []),
      idbGetAll("transactions", null, undefined, 1000).catch(() => []),
      idbGetAll("budgets", null, undefined, 100).catch(() => []),
    ]);

    const data = { habits, transactions, budgets, exportedAt: new Date().toISOString(), scope };

    const result = await buildExportJSON(data, `${id}.json`);
    const fileName = `${id}.json`;
    await writeFile(`exports/${fileName}`, result.blob || new Blob([JSON.stringify(data, null, 2)]));

    exportMeta.status = "completed";
    exportMeta.fileName = fileName;
    exportMeta.size = result.size || 0;
    exportMeta.completedAt = Date.now();

    try {
      const { idbPut } = await import("./storage/db.js");
      await idbPut("export_meta", exportMeta);
    } catch {}

    return exportMeta;
  } catch (e) {
    exportMeta.status = "failed";
    exportMeta.error = String(e);
    try {
      const { idbPut } = await import("./storage/db.js");
      await idbPut("export_meta", exportMeta);
    } catch {}
    throw e;
  }
}

export async function listExports() {
  try {
    return await idbGetAll("export_meta", null, undefined, 50);
  } catch {
    return [];
  }
}

// Delete account mock
export async function requestDeleteAccount(reason = "") {
  if (!isReAuthed()) {
    throw new Error("RE_AUTH_REQUIRED");
  }

  // Confirm destruktif — caller should show confirm dialog
  const id = `del_${Date.now()}`;
  const delReq = { id, status: "pending", reason: reason.slice(0, 500), createdAt: Date.now() };

  try {
    const { idbPut } = await import("./storage/db.js");
    await idbPut("export_meta", { id, type: "deletion", ...delReq });
  } catch {}

  track("deletion_requested", { scope: "account" }).catch(() => {});

  // In real app, would call POST /account/deletion-requests with re-auth token
  // For MVP mock, we just return pending

  return delReq;
}

export async function cancelDeleteAccount(id) {
  try {
    const { idbDel } = await import("./storage/db.js");
    await idbDel("export_meta", id);
  } catch {}
  return true;
}

export async function wipeAllData() {
  // Destructive — requires re-auth + confirm
  if (!isReAuthed()) throw new Error("RE_AUTH_REQUIRED");

  try {
    const db = await getDB();
    const stores = ["habits", "habit_entries", "transactions", "budgets", "savings_goals", "search_index", "kv", "outbox", "export_meta", "opfs_fallback", "analytics_queue"];
    for (const store of stores) {
      try {
        if (db.objectStoreNames.contains(store)) {
          await idbClear(store);
        }
      } catch {}
    }
    // Clear LS
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("hw:"));
      keys.forEach((k) => {
        if (!k.includes("theme") && !k.includes("prefs")) localStorage.removeItem(k);
      });
    } catch {}
    return true;
  } catch (e) {
    console.warn("[settings] wipe failed", e);
    throw e;
  }
}

// Help FAQ (static for MVP)
const FAQ = [
  { q: "Bagaimana cara menambah habit?", a: "Buka tab Habit → Tambah → Isi judul, jadwal, dan simpan. Selesaikan <1 menit." },
  { q: "Kenapa saldo dimasking Rp••••?", a: "Untuk privasi. Tap ikon mata dan lakukan re-auth untuk melihat saldo penuh. Sesi re-auth 5 menit." },
  { q: "Apakah data saya offline?", a: "Ya, semua data tersimpan lokal dulu (IndexedDB) lalu sync otomatis saat online. Outbox menjamin tidak duplikat." },
  { q: "Bagaimana export data?", a: "Pengaturan → Data & Privasi → Export. Butuh re-auth. File JSON/CSV disimpan via OPFS + worker agar tidak jebol memori." },
  { q: "Bagaimana hapus akun?", a: "Pengaturan → Hapus Akun → re-auth → konfirmasi destruktif → jelaskan yang dihapus/disimpan. Tanpa klaim 14 hari final." },
];

export function getFAQ(q) {
  if (!q) return FAQ;
  const lower = q.toLowerCase();
  return FAQ.filter((item) => item.q.toLowerCase().includes(lower) || item.a.toLowerCase().includes(lower));
}

export const settingsHelpers = {
  getSettings,
  updateSetting,
  requestExport,
  listExports,
  requestDeleteAccount,
  cancelDeleteAccount,
  wipeAllData,
  getFAQ,
};
