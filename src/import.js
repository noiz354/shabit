/**
 * HabitWealth import — AUD-IMPORT-01
 * APIs 185,192,193: DOMParser, Streams, Compression Streams
 * - CSV import + streamed/gzipped export
 * - Needs P12 amendment for import screen (flagged) — implemented as optional
 */

import { idbPut } from "./storage/db.js";

export function parseCSV(text) {
  // Simple CSV parser, handles quoted fields
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx]?.trim() || "";
    });
    rows.push(obj);
  }

  return { headers, rows };
}

export async function importTransactionsFromCSV(text) {
  // Expected headers: date, kind, amount, category, note, account_ref
  const { headers, rows } = parseCSV(text);

  // Validate headers
  const required = ["date", "amount", "category"];
  for (const req of required) {
    if (!headers.includes(req)) {
      throw new Error(`Header wajib tidak ada: ${req}`);
    }
  }

  const results = { imported: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Validate date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Baris ${i+2}: format date harus YYYY-MM-DD`);
      const amount = parseInt(row.amount.replace(/\./g, ""), 10);
      if (isNaN(amount) || amount <= 0) throw new Error(`Baris ${i+2}: amount harus >0`);

      const tx = {
        id: `tx_import_${Date.now()}_${i}`,
        kind: ["income","expense","transfer"].includes(row.kind) ? row.kind : "expense",
        amount,
        category: row.category.slice(0,50),
        date: row.date,
        account_ref: row.account_ref || "BCA •••• 4821",
        note: (row.note || "").slice(0,200),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await idbPut("transactions", tx);
      results.imported++;
    } catch (e) {
      results.failed++;
      results.errors.push(String(e).slice(0,200));
      if (results.errors.length > 10) break; // limit errors
    }
  }

  return results;
}

// Streamed export via ReadableStream (API 192)
export function createExportStream(dataArray) {
  // dataArray: array of objects
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    start(controller) {
      // header
      if (dataArray.length) {
        const headers = Object.keys(dataArray[0]);
        controller.enqueue(encoder.encode(headers.join(",") + "\n"));
      }
    },
    pull(controller) {
      if (index >= dataArray.length) {
        controller.close();
        return;
      }
      // Chunk 100 rows at a time to avoid memory spike
      const chunk = dataArray.slice(index, index + 100);
      const lines = chunk.map((row) => Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
      controller.enqueue(encoder.encode(lines));
      index += 100;
    },
  });
}

// Gzipped export via CompressionStream (API 193)
export async function createGzippedExport(dataArray) {
  const stream = createExportStream(dataArray);
  if ("CompressionStream" in self) {
    try {
      const cs = new CompressionStream("gzip");
      const gzipped = stream.pipeThrough(cs);
      const blob = await new Response(gzipped).blob();
      return blob;
    } catch (e) {
      console.warn("[import] gzip failed, fallback uncompressed", e);
    }
  }
  // Fallback uncompressed
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new Blob(chunks, { type: "text/csv" });
}
