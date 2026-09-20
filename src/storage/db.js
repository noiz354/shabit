/**
 * HabitWealth — versioned IndexedDB layer (AUD-STORE-01)
 * DB: habitwealth-v1, version 3 (v-guard: old code ignores new stores)
 * Stores:
 *  v1: kv, outbox, habits, habit_entries, transactions, budgets, search_index
 *  v2: savings_goals, export_meta, opfs_fallback
 *  v3: inbox (T12 notifikasi in-app: dedup id, deliver_after, read/archived/expires)
 *
 * Acceptance:
 *  - migration v1→v2 + quota-full path
 *  - old code ignores new stores (v-guard)
 *  - persist() post-onboarding via prefs module
 */

const DB_NAME = "habitwealth-v1";
export const DB_VERSION = 3;

let dbPromise = null;

function createStoreIfMissing(db, name, opts) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, opts);
  }
  return null;
}

function openIDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unsupported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const oldV = ev.oldVersion;
      // console.debug("[db] upgrade", oldV, "->", ev.newVersion);

      // v1 baseline
      if (oldV < 1) {
        const kv = createStoreIfMissing(db, "kv", { keyPath: "k" });
        // kv: {k, v, updatedAt}
        const outbox = createStoreIfMissing(db, "outbox", { keyPath: "id" });
        if (outbox) {
          outbox.createIndex("by_created", "createdAt");
          outbox.createIndex("by_status", "status");
        }
        const habits = createStoreIfMissing(db, "habits", { keyPath: "id" });
        if (habits) habits.createIndex("by_updated", "updatedAt");

        const entries = createStoreIfMissing(db, "habit_entries", { keyPath: "id" });
        if (entries) {
          entries.createIndex("by_habit", "habit_id");
          entries.createIndex("by_date", "date");
        }

        const tx = createStoreIfMissing(db, "transactions", { keyPath: "id" });
        if (tx) {
          tx.createIndex("by_date", "date");
          tx.createIndex("by_category", "category");
        }

        const budgets = createStoreIfMissing(db, "budgets", { keyPath: "id" });
        if (budgets) budgets.createIndex("by_month", "month");

        const search = createStoreIfMissing(db, "search_index", { keyPath: "id" });
        if (search) {
          // token field may be array -> multiEntry would help but keep simple; query via getAll then filter
          search.createIndex("by_type", "type");
          search.createIndex("by_updated", "updatedAt");
        }
      }

      // v2 additions — v-guard: old code ignores new stores
      if (oldV < 2) {
        const goals = createStoreIfMissing(db, "savings_goals", { keyPath: "id" });
        if (goals) goals.createIndex("by_updated", "updatedAt");

        const exp = createStoreIfMissing(db, "export_meta", { keyPath: "id" });
        if (exp) exp.createIndex("by_created", "createdAt");

        // OPFS fallback: when OPFS unavailable, store blobs as {id, path, blob, createdAt}
        const fallback = createStoreIfMissing(db, "opfs_fallback", { keyPath: "id" });
        if (fallback) {
          fallback.createIndex("by_path", "path", { unique: false });
          fallback.createIndex("by_created", "createdAt");
        }

        // analytics queue store (for AUD-ANAL-01)
        const analytics = createStoreIfMissing(db, "analytics_queue", { keyPath: "id" });
        if (analytics) analytics.createIndex("by_created", "createdAt");
      }

      // v3 — T12 inbox notifikasi (spec 11 amandemen). v-guard: kode lama mengabaikan store ini.
      if (oldV < 3) {
        const inbox = createStoreIfMissing(db, "inbox", { keyPath: "id" });
        if (inbox) {
          inbox.createIndex("by_created", "created_at");
          inbox.createIndex("by_category", "category");
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      // eslint-disable-next-line no-console
      console.warn("[db] blocked — close other tabs");
    };
  });

  return dbPromise;
}

export async function getDB() {
  return openIDB();
}

export async function closeDB() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {}
    dbPromise = null;
  }
}

// generic helpers with quota handling
async function withStore(storeName, mode, fn) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = fn(store, tx);
    } catch (e) {
      reject(e);
      return;
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("tx abort"));
  });
}

export async function kvGet(key) {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const store = tx.objectStore("kv");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.v : undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // fallback to localStorage if IDB fails
    try {
      const raw = localStorage.getItem(`hw:kv:${key}`);
      return raw ? JSON.parse(raw).v : undefined;
    } catch {
      return undefined;
    }
  }
}

export async function kvSet(key, value) {
  const record = { k: key, v: value, updatedAt: Date.now() };
  try {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (e) {
    if (isQuotaError(e)) {
      const cleaned = await handleQuotaFull();
      if (cleaned) return kvSet(key, value);
    }
    // fallback localStorage
    try {
      localStorage.setItem(`hw:kv:${key}`, JSON.stringify(record));
      return true;
    } catch (err) {
      if (isQuotaError(err)) {
        await handleQuotaFull();
      }
      throw err;
    }
  }
}

export async function kvDel(key) {
  try {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
  try {
    localStorage.removeItem(`hw:kv:${key}`);
  } catch {}
}

function isQuotaError(e) {
  if (!e) return false;
  return (
    e.name === "QuotaExceededError" ||
    e.code === 22 ||
    (e.message && e.message.toLowerCase().includes("quota"))
  );
}

async function handleQuotaFull() {
  // Strategy: delete oldest search_index, then export_meta, then opfs_fallback
  // Return true if something was deleted
  try {
    const db = await getDB();
    // try search_index first
    const deleted = await new Promise((resolve) => {
      const tx = db.transaction(["search_index"], "readwrite");
      const store = tx.objectStore("search_index");
      const idx = store.index("by_updated");
      const req = idx.openCursor(null, "next");
      let count = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && count < 50) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count > 0);
        }
      };
      req.onerror = () => resolve(false);
    });
    if (deleted) {
      console.warn("[db] quota — cleaned search_index");
      return true;
    }

    const deleted2 = await new Promise((resolve) => {
      const tx = db.transaction(["export_meta"], "readwrite");
      if (!db.objectStoreNames.contains("export_meta")) {
        resolve(false);
        return;
      }
      const store = tx.objectStore("export_meta");
      const req = store.openCursor(null, "next");
      let count = 0;
      req.onsuccess = () => {
        const c = req.result;
        if (c && count < 10) {
          c.delete();
          count++;
          c.continue();
        } else {
          resolve(count > 0);
        }
      };
      req.onerror = () => resolve(false);
    });
    if (deleted2) {
      console.warn("[db] quota — cleaned export_meta");
      return true;
    }

    // fallback storage cleanup
    try {
      // remove oldest localStorage hw:* keys beyond 5 histories
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("hw:"));
      if (keys.length > 20) {
        // keep prefs
        const sorted = keys
          .filter((k) => k.includes("history") || k.includes("search"))
          .slice(0, 5);
        sorted.forEach((k) => localStorage.removeItem(k));
        return sorted.length > 0;
      }
    } catch {}
  } catch {}
  return false;
}

// CRUD helpers for typed stores
export async function idbGet(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(storeName, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put({ ...value, updatedAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      if (isQuotaError(req.error)) {
        handleQuotaFull().then((cleaned) => {
          if (cleaned) {
            // retry once
            idbPut(storeName, value).then(resolve).catch(reject);
          } else {
            reject(req.error);
          }
        });
      } else {
        reject(req.error);
      }
    };
  });
}

export async function idbDel(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAll(storeName, indexName, query, limit = 1000) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const req = query !== undefined ? source.getAll(query, limit) : source.getAll(null, limit);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbClear(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// estimate storage (AUD-STORE-01 uses StorageManager.estimate)
export async function estimateStorage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      return await navigator.storage.estimate();
    }
  } catch {}
  return { quota: 0, usage: 0, usageDetails: {} };
}

// persist request (post-onboarding)
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      // console.debug("[db] persist", persisted);
      return persisted;
    }
  } catch (e) {
    console.warn("[db] persist failed", e);
  }
  return false;
}
