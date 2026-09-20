/**
 * HabitWealth UI primitives — One UI, token-only (tanpa hex/durasi hardcode)
 * Pengganti alert()/confirm() (utang Wave 2, syarat merge PR #2):
 *  - showToast(message)            → toast 1 baris (spec 11: pill, --toast-bg, 24dp), role=status
 *  - openSheet({...})              → bottom sheet generik (scrim + handle + focus trap + Esc + drag-to-dismiss)
 *  - confirmSheet({destructive})   → Promise<boolean>; destruktif = tombol --negative + ikon (non-color cue)
 *  - infoSheet({title, desc})      → Promise<void>
 *  - switchRow({id,label,...})     → baris switch One UI (label.switch > input[role=switch] + .track + .thumb; auth.css)
 * Motion: sheet dari bawah (sheet-in/out), reduced-motion fade (motion.css). Fokus kembali ke pemicu.
 */

import { trapFocus, prefersReducedMotion } from "./motion.js";
import { makeSheetDraggable } from "./gestures.js";

let toastTimer = null;

function exitMs() {
  return prefersReducedMotion() ? 150 : 250;
}

export function showToast(message, options = {}) {
  const { duration = 3000, actionLabel, onAction, tone = "neutral" } = options;
  let toast = document.getElementById("hw-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "hw-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.innerHTML = "";
  toast.dataset.tone = tone;
  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  toast.appendChild(text);
  if (actionLabel && typeof onAction === "function") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-flat btn-small toast-action";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      hideToast();
      onAction();
    });
    toast.appendChild(btn);
  }
  // reflow agar animasi ulang saat toast beruntun
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
  return toast;
}

export function hideToast() {
  const toast = document.getElementById("hw-toast");
  if (toast) toast.classList.remove("show");
}

/**
 * Bottom sheet generik.
 * @param {object} o
 * @param {string} [o.id]
 * @param {string} o.title
 * @param {string} [o.desc]
 * @param {(body:HTMLElement, api:{close:Function})=>void} [o.build]  isi kustom
 * @param {Array<{label:string, kind?:'primary'|'secondary'|'flat'|'destructive', onClick?:Function, close?:boolean, autofocus?:boolean}>} [o.actions]
 * @param {boolean} [o.tall]  maxHeight 90dvh + scroll
 * @param {boolean} [o.dismissible]  scrim/Esc/drag menutup (default true)
 * @param {(reason:string)=>void} [o.onClose]
 */
export function openSheet(o = {}) {
  const { id, title, desc, build, actions = [], tall = false, dismissible = true, onClose } = o;
  if (id && document.getElementById(id)) return null;

  const trigger = document.activeElement;
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sheet = document.createElement("div");
  if (id) sheet.id = id;
  sheet.className = `pwa-sheet sheet-bottom${tall ? " sheet-tall" : ""}`;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  const titleId = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;
  sheet.setAttribute("aria-labelledby", titleId);

  const content = document.createElement("div");
  content.className = "sheet-content";
  const handle = document.createElement("div");
  handle.className = "sheet-handle";
  handle.setAttribute("aria-hidden", "true");
  const h2 = document.createElement("h2");
  h2.className = "sheet-title";
  h2.id = titleId;
  h2.textContent = title || "";
  content.append(handle, h2);
  if (desc) {
    const p = document.createElement("p");
    p.className = "sheet-desc";
    p.textContent = desc;
    content.appendChild(p);
  }
  const body = document.createElement("div");
  body.className = "sheet-body";
  content.appendChild(body);

  let closed = false;
  let untrap = () => {};
  function close(reason = "close") {
    if (closed) return;
    closed = true;
    untrap();
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => {
      sheet.remove();
      scrim.remove();
      try {
        if (trigger && typeof trigger.focus === "function" && document.contains(trigger)) trigger.focus();
      } catch {}
      onClose && onClose(reason);
    }, exitMs());
  }
  const api = { close, sheet, body };
  if (typeof build === "function") build(body, api);

  let autofocusEl = null;
  if (actions.length) {
    const row = document.createElement("div");
    row.className = "sheet-actions";
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const kind = a.kind || "secondary";
      btn.className = `btn ${kind === "destructive" ? "btn-destructive" : `btn-${kind}`}`;
      if (kind === "destructive") {
        const ic = document.createElement("span");
        ic.setAttribute("aria-hidden", "true");
        ic.textContent = "⚠️ ";
        btn.appendChild(ic);
      }
      btn.appendChild(document.createTextNode(a.label));
      btn.addEventListener("click", async () => {
        if (a.onClick) {
          try {
            const r = await a.onClick(api);
            if (r === false) return; // aksi meminta sheet tetap terbuka
          } catch {}
        }
        if (a.close !== false) close(a.reason || "action");
      });
      if (a.autofocus) autofocusEl = btn;
      row.appendChild(btn);
    });
    content.appendChild(row);
  }
  sheet.appendChild(content);
  document.body.append(scrim, sheet);

  untrap = trapFocus(sheet);
  if (autofocusEl) setTimeout(() => autofocusEl.focus(), 30);

  if (dismissible) {
    scrim.addEventListener("click", () => close("scrim"));
    sheet.addEventListener("hw:close-sheet", () => close("esc"));
    makeSheetDraggable(sheet, scrim, { onDismiss: () => close("drag") });
  } else {
    sheet.addEventListener("hw:close-sheet", (e) => e.stopPropagation());
  }
  return api;
}

/**
 * Konfirmasi. Destruktif: tombol merah + ikon + default fokus di Batal (mencegah tap tak sengaja).
 * @returns {Promise<boolean>}
 */
export function confirmSheet(o = {}) {
  const { title = "Yakin?", desc = "", confirmLabel = "Ya", cancelLabel = "Batal", destructive = false, detail } = o;
  return new Promise((resolve) => {
    let decided = false;
    const api = openSheet({
      title,
      desc,
      build: (body) => {
        if (detail) {
          const ul = document.createElement("ul");
          ul.className = "sheet-list";
          (Array.isArray(detail) ? detail : [detail]).forEach((t) => {
            const li = document.createElement("li");
            li.textContent = t;
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
      },
      actions: [
        { label: cancelLabel, kind: "secondary", autofocus: destructive, onClick: () => { decided = true; resolve(false); } },
        { label: confirmLabel, kind: destructive ? "destructive" : "primary", autofocus: !destructive, onClick: () => { decided = true; resolve(true); } },
      ],
      onClose: () => {
        if (!decided) resolve(false);
      },
    });
    if (!api) resolve(false);
  });
}

/** Pengganti alert() informatif. */
export function infoSheet(o = {}) {
  const { title = "Info", desc = "", okLabel = "Oke", items } = o;
  return new Promise((resolve) => {
    const api = openSheet({
      title,
      desc,
      build: (body) => {
        if (Array.isArray(items) && items.length) {
          const ul = document.createElement("ul");
          ul.className = "sheet-list";
          items.forEach((t) => {
            const li = document.createElement("li");
            li.textContent = t;
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
      },
      actions: [{ label: okLabel, kind: "primary", autofocus: true }],
      onClose: () => resolve(),
    });
    if (!api) resolve();
  });
}

/** Pilihan sederhana (pengganti prompt/alert berantai) → Promise<value|null> */
export function chooseSheet(o = {}) {
  const { title, desc, options = [], current } = o;
  return new Promise((resolve) => {
    let picked = null;
    openSheet({
      title,
      desc,
      build: (body, api) => {
        const list = document.createElement("div");
        list.className = "choice-list";
        list.setAttribute("role", "radiogroup");
        list.setAttribute("aria-label", title || "Pilihan");
        options.forEach((opt) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "choice-item";
          b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", String(opt.value === current));
          const dot = document.createElement("span");
          dot.className = "choice-dot";
          dot.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.className = "choice-label";
          label.textContent = opt.label;
          b.append(dot, label);
          if (opt.hint) {
            const hint = document.createElement("span");
            hint.className = "choice-hint";
            hint.textContent = opt.hint;
            b.appendChild(hint);
          }
          b.addEventListener("click", () => {
            picked = opt.value;
            api.close("pick");
          });
          list.appendChild(b);
        });
        body.appendChild(list);
      },
      actions: [{ label: "Batal", kind: "flat" }],
      onClose: () => resolve(picked),
    });
  });
}

/**
 * Baris switch bersama (T11/T12). Struktur mengikuti auth.css `.switch`:
 * <label class="switch"><input type=checkbox role=switch id=…><span class=track><span class=thumb></label>
 * (bug visual T12: <button class="switch"> tanpa .track/.thumb → track tak tampak; kini seragam di sini.)
 * @param {{id:string,label:string,desc?:string,note?:string,checked?:boolean,disabled?:boolean,onChange?:(v:boolean)=>any,className?:string}} o
 */
export function switchRow(o = {}) {
  const { id, label, desc, note, checked = false, disabled = false, onChange, className = "" } = o;
  const row = document.createElement("div");
  row.className = `consent-card notif-row${className ? ` ${className}` : ""}`;
  const text = document.createElement("div");
  text.className = "consent-text";
  const lab = document.createElement("label");
  lab.className = "consent-title";
  lab.textContent = label;
  lab.htmlFor = id;
  text.appendChild(lab);
  let descId = null;
  if (desc) {
    const d = document.createElement("div");
    d.className = "consent-desc";
    d.id = `${id}-desc`;
    d.textContent = desc;
    descId = d.id;
    text.appendChild(d);
  }
  if (note) {
    const n = document.createElement("div");
    n.className = "status-line mt-8";
    n.textContent = note;
    text.appendChild(n);
  }
  const sw = document.createElement("label");
  sw.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.setAttribute("role", "switch");
  input.checked = !!checked;
  input.setAttribute("aria-checked", String(!!checked));
  input.setAttribute("aria-label", label);
  if (descId) input.setAttribute("aria-describedby", descId);
  if (disabled) {
    input.disabled = true;
    input.setAttribute("aria-disabled", "true");
  }
  input.addEventListener("change", async () => {
    const next = input.checked;
    input.setAttribute("aria-checked", String(next));
    if (typeof onChange !== "function") return;
    try {
      await onChange(next);
    } catch {
      input.checked = !next;
      input.setAttribute("aria-checked", String(!next));
    }
  });
  const track = document.createElement("span");
  track.className = "track";
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  sw.append(input, track, thumb);
  row.append(text, sw);
  return row;
}

export const ui = { showToast, hideToast, openSheet, confirmSheet, infoSheet, chooseSheet, switchRow };
