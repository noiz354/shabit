/**
 * HabitWealth date-range picker — T17 + AUD-ROUTER-01
 * Preset + custom + hash state
 * Acceptance: ganti range update semua panel tanpa reload, URL restore
 */

import { getRange, setRange } from "./storage/prefs.js";
import { makeSheetDraggable } from "./gestures.js";
import { trapFocus } from "./motion.js";
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
    if (range.from === range.to) return range.from;
    return `${range.from} – ${range.to}`;
  }
  return range.preset || "";
}

export function showRangePicker(currentRange, onApply) {
  const existing = document.getElementById("range-picker-sheet");
  if (existing) existing.remove();
  document.getElementById("range-picker-scrim")?.remove();

  const scrim = document.createElement("div");
  scrim.id = "range-picker-scrim";
  scrim.className = "scrim";

  const sheet = document.createElement("div");
  sheet.id = "range-picker-sheet";
  sheet.className = "pwa-sheet sheet-bottom";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Pilih rentang tanggal");

  const presetsHTML = PRESETS.map((p) => {
    const active = currentRange.preset === p.key ? " aria-current='true' style='background:#0381FE;color:#fff'" : "";
    return `<button class="btn btn-secondary btn-small" data-preset="${p.key}"${active}>${p.label}</button>`;
  }).join("");

  sheet.innerHTML = `
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Rentang tanggal</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${presetsHTML}</div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1"><label style="font-size:12px">Dari</label><input type="date" id="range-from" value="${currentRange.from || ""}" style="width:100%;height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" /></div>
        <div style="flex:1"><label style="font-size:12px">Sampai</label><input type="date" id="range-to" value="${currentRange.to || ""}" style="width:100%;height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" /></div>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn btn-secondary" data-action="reset">Atur ulang</button>
        <button class="btn btn-primary" data-action="apply">Terapkan</button>
      </div>
      <p style="font-size:11px;color:#999;margin-top:12px">Zona waktu: ${currentRange.tz || "Asia/Jakarta"}</p>
    </div>
  `;

  document.body.append(scrim, sheet);
  sheet.classList.add("open");

  const cleanupFocus = trapFocus(sheet);

  function close() {
    cleanupFocus();
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 250);
  }

  scrim.addEventListener("click", close);

  sheet.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.preset;
      const preset = PRESETS.find((p) => p.key === key);
      if (preset) {
        const range = { ...preset.getRange(), tz: currentRange.tz || "Asia/Jakarta" };
        setRange(range);
        track("range_changed", { preset: key, days: range.from && range.to ? Math.round((new Date(range.to) - new Date(range.from))/(1000*60*60*24))+1 : 0, module: location.hash }).catch(()=>{});
        if (onApply) onApply(range);
        close();
        // Update URL hash
        const { buildHash, parseHash } = (() => { try { return require("./router.js"); } catch { return {}; } })();
        // Fallback: manually update hash
        const current = location.hash.split("?")[0];
        const qs = new URLSearchParams(location.hash.split("?")[1] || "");
        qs.set("preset", range.preset);
        qs.set("from", range.from);
        qs.set("to", range.to);
        location.hash = `${current}?${qs.toString()}`;
      }
    });
  });

  sheet.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    const def = PRESETS.find((p) => p.key === "month").getRange();
    document.getElementById("range-from").value = def.from;
    document.getElementById("range-to").value = def.to;
  });

  sheet.querySelector('[data-action="apply"]')?.addEventListener("click", () => {
    const from = document.getElementById("range-from").value;
    const to = document.getElementById("range-to").value;

    if (!from || !to) {
      alert("Pilih tanggal dari dan sampai");
      return;
    }
    if (from > to) {
      alert("Tanggal dari harus ≤ sampai");
      return;
    }
    // Max 12 months OPEN per spec 17
    const diffMonths = (new Date(to).getFullYear() - new Date(from).getFullYear()) * 12 + (new Date(to).getMonth() - new Date(from).getMonth());
    if (diffMonths > 12) {
      alert("Maksimal 12 bulan");
      return;
    }

    const range = { preset: "custom", from, to, tz: currentRange.tz || "Asia/Jakarta" };
    setRange(range);
    track("range_custom_applied", { days: Math.round((new Date(to) - new Date(from))/(1000*60*60*24))+1 }).catch(()=>{});
    if (onApply) onApply(range);
    close();

    const current = location.hash.split("?")[0];
    const qs = new URLSearchParams(location.hash.split("?")[1] || "");
    qs.set("preset", "custom");
    qs.set("from", from);
    qs.set("to", to);
    location.hash = `${current}?${qs.toString()}`;
  });

  makeSheetDraggable(sheet, scrim, { onDismiss: close });

  return { close };
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
  showRangePicker,
  initRangePickerButton,
};
