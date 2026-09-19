/**
 * HabitWealth print — AUD-PRINT-01
 * API 190: window.print()
 * - Print monthly report/budget summary (natural HabitWealth artifact)
 * - Needs P09/P10 amendment for button (flagged) — implemented as optional
 * - Print CSS light, ink-friendly, masked values
 */

// Print CSS injected via JS for CSR (also via app.css @media print)
const PRINT_CSS = `
@media print {
  body { background: #fff !important; color: #000 !important; }
  .bottom-tabs, .offline-banner, .pwa-sheet, .scrim, .update-prompt, .toast, .search-ui, .chart-fs-btn { display: none !important; }
  .page { max-width: 100% !important; margin: 0 !important; }
  .viewing-area, .appbar { position: static !important; padding: 16px !important; }
  .interaction-area { padding: 16px !important; }
  /* Masked values remain masked unless re-authed — print respects masking */
  .skeleton { display: none !important; }
  @page { margin: 16mm; }
  /* Ink-friendly */
  * { box-shadow: none !important; }
}
`;

function ensurePrintCSS() {
  let el = document.getElementById("hw-print-css");
  if (!el) {
    el = document.createElement("style");
    el.id = "hw-print-css";
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
  }
}

export function printReport() {
  ensurePrintCSS();
  try {
    window.print();
    return { ok: true };
  } catch (e) {
    console.warn("[print] failed", e);
    return { ok: false, error: String(e) };
  }
}

export function createPrintButton(container, options = {}) {
  const { label = "Cetak", onBeforePrint } = options;
  const btn = document.createElement("button");
  btn.className = "btn btn-secondary btn-small";
  btn.textContent = label;
  btn.setAttribute("aria-label", "Cetak laporan");
  btn.addEventListener("click", () => {
    if (onBeforePrint) onBeforePrint();
    printReport();
  });
  if (container) container.appendChild(btn);
  return btn;
}

export const printHelpers = {
  printReport,
  createPrintButton,
};
