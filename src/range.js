/**
 * HabitWealth date-range picker — T17 + AUD-ROUTER-01
 * Preset + custom + hash state
 * Acceptance: ganti range update semua panel tanpa reload, URL restore
 */

import { getRange, setRange } from "./storage/prefs.js";
import { openSheet } from "./ui.js";
import { track } from "./analytics.js";

const PRESETS = [
  { key: "today", label: "Hari ini", getRange: () => { const today = new Date().toISOString().slice(0,10); return { preset: "today", from: today, to: today }; } },
  { key: "7d", label: "7H", getRange: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate()-6); return { preset: "7d", from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; } },
  { key: "30d", label: "30H", getRange: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate()-29); return { preset: "30d", from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; } },
  { key: "month", label: "Bulan ini", getRange: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1); const to = new Date(now.getFullYear(), now.getMonth()+1, 0); return { preset: "month", from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; } },
  { key: "lastMonth", label: "Bulan lalu", getRange: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth()-1, 1); const to = new Date(now.getFullYear(), now.getMonth(), 0); return { preset: "lastMonth", from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }; } },
];

export function formatRangeLabel(range) {
  if (!range) return "";
  if (range.preset === "month") {
    try {
      const d = new Date(range.from);
      return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch { return "Bulan ini"; }
  }
  if (range.from && range.to) {
    // Spec 17: `19–30 Sep 2026` (bulan sama) / `25 Agu – 5 Sep 2026` (tahun sama) / `28 Des 2025 – 3 Jan 2026`
    try {
      const a = new Date(`${range.from}T00:00:00`);
      const b = new Date(`${range.to}T00:00:00`);
      const dm = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const dmy = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      if (range.from === range.to) return dmy(a);
      if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()}–${dmy(b)}`;
      if (a.getFullYear() === b.getFullYear()) return `${dm(a)} – ${dmy(b)}`;
      return `${dmy(a)} – ${dmy(b)}`;
    } catch {
      return `${range.from} – ${range.to}`;
    }
  }
  return range.preset || "";
}

/** Jumlah hari inklusif dalam range (untuk event `days`), null bila tidak lengkap. */
export function rangeDays(range) {
  if (!range || !range.from || !range.to) return null;
  return dayCount(range.from, range.to);
}

function dayCount(from, to) {
  return Math.round((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
}

function monthSpan(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * Validasi rentang kustom (spec 17). Dipakai sheet + tes.
 * @returns {{ok:true}|{ok:false, reason:string, message:string}}
 */
export function validateCustomRange(from, to) {
  if (!from || !to) return { ok: false, reason: "INCOMPLETE", message: "Pilih tanggal dari dan sampai." };
  if (from > to) return { ok: false, reason: "ORDER", message: "Tanggal dari harus ≤ sampai." };
  if (monthSpan(from, to) > 12) return { ok: false, reason: "TOO_LONG", message: "Maksimal 12 bulan." }; // OPEN spec 17
  return { ok: true };
}

function updateHashWithRange(range) {
  const current = location.hash.split("?")[0] || "#/beranda";
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  qs.set("preset", range.preset);
  qs.set("from", range.from);
  qs.set("to", range.to);
  location.hash = `${current}?${qs.toString()}`;
}

/**
 * Sheet pemilih rentang (token-only via ui.js openSheet; tanpa dialog sistem — error tampil inline role=alert).
 * @returns {{close:Function}|null}
 */
export function showRangePicker(currentRange, onApply) {
  const tz = (currentRange && currentRange.tz) || "Asia/Jakarta";
  let fromInput, toInput, errEl;

  function setError(msg) {
    errEl.textContent = msg ? `⚠️ ${msg}` : "";
    errEl.hidden = !msg;
    fromInput.setAttribute("aria-invalid", msg ? "true" : "false");
    toInput.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function apply(range, eventName, props, close) {
    setRange(range);
    track(eventName, props).catch(() => {});
    if (onApply) onApply(range);
    close("apply");
    updateHashWithRange(range);
  }

  const api = openSheet({
    id: "range-picker-sheet",
    title: "Rentang tanggal",
    build: (body, { close }) => {
      const presets = document.createElement("div");
      presets.className = "segmented range-presets";
      presets.setAttribute("role", "group");
      presets.setAttribute("aria-label", "Preset rentang");
      PRESETS.forEach((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary btn-small";
        b.dataset.preset = p.key;
        b.textContent = p.label;
        const active = currentRange && currentRange.preset === p.key;
        b.setAttribute("aria-pressed", String(!!active));
        if (active) b.setAttribute("aria-current", "true");
        b.addEventListener("click", () => {
          const range = { ...p.getRange(), tz };
          apply(range, "range_changed", { preset: p.key, days: dayCount(range.from, range.to), module: location.hash.split("?")[0] }, close);
        });
        presets.appendChild(b);
      });
      body.appendChild(presets);

      const row = document.createElement("div");
      row.className = "range-fields";
      function dateField(id, label, value) {
        const wrap = document.createElement("div");
        wrap.className = "field";
        const lab = document.createElement("label");
        lab.htmlFor = id;
        lab.textContent = label;
        const input = document.createElement("input");
        input.type = "date";
        input.id = id;
        input.className = "field-input";
        input.value = value || "";
        input.addEventListener("input", () => setError(""));
        wrap.append(lab, input);
        return { wrap, input };
      }
      const f = dateField("range-from", "Dari", currentRange && currentRange.from);
      const t = dateField("range-to", "Sampai", currentRange && currentRange.to);
      fromInput = f.input;
      toInput = t.input;
      row.append(f.wrap, t.wrap);
      body.appendChild(row);

      errEl = document.createElement("p");
      errEl.className = "field-error";
      errEl.id = "range-error";
      errEl.setAttribute("role", "alert");
      errEl.hidden = true;
      fromInput.setAttribute("aria-describedby", errEl.id);
      toInput.setAttribute("aria-describedby", errEl.id);
      body.appendChild(errEl);

      const tzLine = document.createElement("p");
      tzLine.className = "status-line range-tz";
      tzLine.textContent = `Zona waktu: ${tz}`;
      body.appendChild(tzLine);
    },
    actions: [
      {
        label: "Atur ulang",
        kind: "secondary",
        close: false,
        onClick: () => {
          const def = PRESETS.find((p) => p.key === "month").getRange();
          fromInput.value = def.from;
          toInput.value = def.to;
          setError("");
          return false;
        },
      },
      {
        label: "Terapkan",
        kind: "primary",
        close: false,
        onClick: ({ close }) => {
          const from = fromInput.value;
          const to = toInput.value;
          const v = validateCustomRange(from, to);
          if (!v.ok) {
            setError(v.message);
            (v.reason === "ORDER" || v.reason === "TOO_LONG" ? toInput : fromInput).focus();
            return false;
          }
          apply({ preset: "custom", from, to, tz }, "range_custom_applied", { days: dayCount(from, to) }, close);
          return false;
        },
      },
    ],
  });
  return api ? { close: api.close } : null;
}

export function initRangePickerButton(btnEl, onApply) {
  if (!btnEl) return () => {};
  const handler = () => {
    const range = getRange();
    showRangePicker(range, onApply);
  };
  btnEl.addEventListener("click", handler);
  return () => btnEl.removeEventListener("click", handler);
}

export const rangeHelpers = {
  PRESETS,
  formatRangeLabel,
  rangeDays,
  showRangePicker,
  initRangePickerButton,
  validateCustomRange,
};
