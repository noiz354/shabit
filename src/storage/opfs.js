/**
 * HabitWealth OPFS helper — receipt staging + export file assembly
 * AUD-STORE-01: OPFS+fallback (IndexedDB opfs_fallback)
 * - OPFS via navigator.storage.getDirectory() where available (CA/FA/SI 15.2+)
 * - Fallback to IDB store opfs_fallback
 */

import { idbPut, idbGet, idbGetAll, idbDel, getDB } from "./db.js";

const FALLBACK_STORE = "opfs_fallback";
let opfsRootPromise = null;

async function getOPFSRoot() {
  if (opfsRootPromise) return opfsRootPromise;
  opfsRootPromise = (async () => {
    try {
      if (navigator.storage && navigator.storage.getDirectory) {
        const root = await navigator.storage.getDirectory();
        return root;
      }
    } catch (e) {
      console.warn("[opfs] getDirectory failed", e);
    }
    return null;
  })();
  return opfsRootPromise;
}

export async function isOPFSSupported() {
  const root = await getOPFSRoot();
  return !!root;
}

// Write file (Blob or string)
export async function writeFile(path, data) {
  // path: e.g. "receipts/xxx.jpg" or "exports/2026-09.json"
  const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: typeof data === "string" ? "text/plain" : "application/json" });

  const root = await getOPFSRoot();
  if (root) {
    try {
      const parts = path.split("/").filter(Boolean);
      const fileName = parts.pop();
      let dir = root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { path, size: blob.size, backend: "opfs" };
    } catch (e) {
      console.warn("[opfs] write fallback", e);
      // fall through to IDB
    }
  }

  // fallback IDB
  const id = `opfs:${path}`;
  await idbPut(FALLBACK_STORE, {
    id,
    path,
    blob,
    size: blob.size,
    createdAt: Date.now(),
  });
  return { path, size: blob.size, backend: "idb" };
}

export async function readFile(path) {
  const root = await getOPFSRoot();
  if (root) {
    try {
      const parts = path.split("/").filter(Boolean);
      const fileName = parts.pop();
      let dir = root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return file; // Blob
    } catch (e) {
      // try fallback
    }
  }

  // fallback
  try {
    const rec = await idbGet(FALLBACK_STORE, `opfs:${path}`);
    if (rec && rec.blob) return rec.blob;
  } catch {}
  return null;
}

export async function deleteFile(path) {
  const root = await getOPFSRoot();
  if (root) {
    try {
      const parts = path.split("/").filter(Boolean);
      const fileName = parts.pop();
      let dir = root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      await dir.removeEntry(fileName);
      return true;
    } catch {}
  }
  try {
    await idbDel(FALLBACK_STORE, `opfs:${path}`);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(prefix = "") {
  const results = [];
  const root = await getOPFSRoot();
  if (root) {
    try {
      // naive recursive list for prefix
      const parts = prefix.split("/").filter(Boolean);
      let dir = root;
      for (const part of parts) {
        // if prefix is directory, we want its contents; if it's partial file prefix, we handle after
        try {
          dir = await dir.getDirectoryHandle(part);
        } catch {
          // prefix may include file part — break and filter later
          break;
        }
      }
      // @ts-ignore — async iterator
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === "file" && name.startsWith(parts[parts.length - 1] || "")) {
          const full = prefix ? `${prefix.split("/").slice(0, -1).join("/")}/${name}`.replace(/^\/+/, "") : name;
          results.push({ path: full, backend: "opfs" });
        } else if (handle.kind === "directory") {
          // shallow only for now
          results.push({ path: (prefix ? `${prefix}/` : "") + name + "/", backend: "opfs", isDir: true });
        }
      }
    } catch {}
  }

  // include fallback
  try {
    const all = await idbGetAll(FALLBACK_STORE, null, undefined, 500);
    for (const rec of all) {
      if (!prefix || rec.path.startsWith(prefix)) {
        results.push({ path: rec.path, backend: "idb", size: rec.size });
      }
    }
  } catch {}

  return results;
}

// helper for export assembly — write JSON/CSV then return blob
export async function assembleExportFile(fileName, data, type = "json") {
  let blob;
  if (type === "json") {
    blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  } else if (type === "csv") {
    blob = new Blob([data], { type: "text/csv;charset=utf-8" });
  } else {
    blob = new Blob([data]);
  }
  const path = `exports/${fileName}`;
  await writeFile(path, blob);
  return { path, blob, size: blob.size };
}

// cleanup old files (e.g. after successful upload)
export async function cleanupOldFiles(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  try {
    const db = await getDB();
    const tx = db.transaction(FALLBACK_STORE, "readwrite");
    const store = tx.objectStore(FALLBACK_STORE);
    const idx = store.index("by_created");
    const range = IDBKeyRange.upperBound(cutoff);
    const req = idx.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch {}
  // OPFS cleanup is more expensive — skip for now, rely on manual delete
}
