// Wave 2 — Full MVP views: Beranda, Habit, Uang, Pengaturan + search, range, charts, habit/money/settings logic
// T6: HabitToday/Editor/Detail + IndexedDB queue
// T7: MoneyOverview/Feed/Add + masking+re-auth mock
// T8: Settings/Export/Delete mock + Help
// T16: Visualization ECharts core+Bar/Pie, ring/streak SVG, donut-tap-filter, lazy scatter
// T17: Date-range picker global preset+custom+hash state
// T19: Search global box+4 scope tabs+ranking+history max-5 lokal+offline index
// AUD-* Wave 2: API/WORK/HAPT/NOTIF/SEARCH/CHARTS/ORIENT/SHARE/PERF/NET + PRINT/CAP/IMPORT (with amendments)
// Refactor (syarat merge PR #2): token-only (class CSS, tanpa inline style/hex), alert/confirm → ui.js sheet/toast,
// tanpa reload halaman (re-render lokal; satu-satunya pengecualian: setelah wipe data), data Beranda dari IDB (bukan mock acak).

import { createAppBarController, transitionFor, prefersReducedMotion } from "./motion.js";
import { makeSheetDraggable } from "./gestures.js";
import { getRange } from "./storage/prefs.js";
import { setTheme } from "./theme.js";
import { showInstallSheet, isStandalone } from "./pwa.js";
import { listHabits, getHabit, createHabit, deleteHabit, completeHabit, undoComplete, listEntries, getTemplates } from "./habit.js";
import { listTransactions, getTransaction, createTransaction, deleteTransaction, getDisplayAmount, requestReAuth, clearReAuth, isReAuthed, checkReAuthFromStorage, getBudgetStatus } from "./money.js";
import { getSettings, updateSetting, requestExport, requestDeleteAccount, getFAQ } from "./settings.js";
import { renderRingProgress, renderStreakDots, renderHabitBar, renderDonutCategory } from "./charts.js";
import { showRangePicker, formatRangeLabel } from "./range.js";
import { createSearchUI } from "./search.js";
import { track } from "./analytics.js";
import { feedbackHabitComplete } from "./feedback.js";
import { shareStreakCard, copyToClipboard } from "./share.js";
import { speak, cancelSpeak } from "./speech.js";
import { printReport } from "./print.js";
import { getPerfMetrics, checkBudgets } from "./perf.js";
import { getAdaptiveTier } from "./net.js";
import { api } from "./api.js";
import { getSession, maskEmail, logout, hasPasskeyReminder, dismissPasskeyReminder, getConsentHistory, revokeConsent, getPasskeyState } from "./auth.js";
import { getPasskeyCapability, PASSKEY_REASON_COPY } from "./webauthn.js";
import { showToast, openSheet, confirmSheet, infoSheet, chooseSheet } from "./ui.js";
const unreadCount = () => import("./notify.js").then((m) => m.unreadCount()); // T12 lazy

const TABS = [
  ["#/beranda", "Beranda"],
  ["#/habit", "Habit"],
  ["#/uang", "Uang"],
  ["#/pengaturan", "Pengaturan"]
];

// ---------- helpers (diekspor untuk views-notify.jsx) ----------
export function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
export function btn(label, className = "btn btn-secondary", onClick) {
  const b = el("button", className, label);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
function field(id, { label, type = "text", placeholder = "", value = "", inputMode, autocomplete = "off" } = {}) {
  const wrap = el("div", "field");
  const lab = el("label", "", label);
  lab.htmlFor = id;
  const input = el("input", "field-input");
  input.id = id;
  input.name = id;
  input.type = type;
  input.placeholder = placeholder;
  input.value = value;
  input.autocomplete = autocomplete;
  if (inputMode) input.inputMode = inputMode;
  wrap.append(lab, input);
  return { wrap, input };
}
function selectField(id, label, options, value) {
  const wrap = el("div", "field");
  const lab = el("label", "", label);
  lab.htmlFor = id;
  const sel = el("select", "field-input");
  sel.id = id;
  options.forEach(([v, l]) => {
    const o = el("option", "", l);
    o.value = v;
    if (v === value) o.selected = true;
    sel.appendChild(o);
  });
  wrap.append(lab, sel);
  return { wrap, select: sel };
}
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
export function formatDateId(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
export function skeleton(kind = "card") {
  const s = el("div", `skeleton skeleton-${kind}`);
  s.setAttribute("aria-busy", "true");
  s.setAttribute("aria-label", "Memuat…");
  return s;
}
export function goBack(root, fallbackHash) {
  const page = root.querySelector(".page");
  if (page && !prefersReducedMotion()) {
    page.classList.add("nav-back-exit");
    setTimeout(() => (location.hash = fallbackHash), 200);
  } else {
    location.hash = fallbackHash;
  }
}

function bottomNav(currentHash) {
  const nav = document.createElement("nav");
  nav.className = "bottom-tabs";
  nav.setAttribute("aria-label", "Navigasi utama");
  TABS.forEach(([href, label]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (currentHash === href || (currentHash.startsWith(href) && href !== "#/beranda") || (href === "#/beranda" && (currentHash === "#/beranda" || currentHash === ""))) {
      a.setAttribute("aria-current", "page");
    }
    a.addEventListener("click", () => {
      const t = transitionFor("peer");
      document.documentElement.style.setProperty("--motion-duration", `${t.duration}ms`);
    });
    nav.appendChild(a);
  });
  return nav;
}

function appBar(title, options = {}) {
  const { collapsible = true, rangeLabel = "", showSearch = false, showRange = false, showInbox = false } = options;
  const header = document.createElement("header");
  header.className = "appbar viewing-area";
  header.dataset.state = "expanded";

  const h1 = el("h1", "appbar-title", title);
  header.appendChild(h1);

  if (rangeLabel) header.appendChild(el("p", "appbar-sub", rangeLabel));

  if (showSearch || showRange || showInbox) {
    const actions = el("div", "appbar-actions");
    if (showInbox) {
      // T12: lonceng Kotak Masuk + jumlah belum dibaca (non-color cue: angka)
      const bell = btn("", "btn btn-secondary btn-small inbox-bell", () => { location.hash = "#/notifikasi"; });
      const setCount = (n) => {
        bell.textContent = n > 0 ? `🔔 ${n}` : "🔔";
        bell.setAttribute("aria-label", n > 0 ? `Kotak masuk, ${n} belum dibaca` : "Kotak masuk");
      };
      setCount(0);
      unreadCount().then(setCount).catch(() => {});
      const onChange = (e) => setCount(e.detail && typeof e.detail.unread === "number" ? e.detail.unread : 0);
      window.addEventListener("hw:inbox-changed", onChange);
      header._cleanupInbox = () => window.removeEventListener("hw:inbox-changed", onChange);
      actions.appendChild(bell);
    }
    if (showSearch) {
      const searchBtn = btn("🔍 Cari", "btn btn-secondary btn-small", () => showSearchSheet());
      searchBtn.dataset.searchTrigger = "1";
      searchBtn.setAttribute("aria-label", "Cari");
      actions.appendChild(searchBtn);
    }
    if (showRange) {
      const rangeBtn = btn(`📅 ${formatRangeLabel(getRange())}`, "btn btn-secondary btn-small");
      rangeBtn.setAttribute("aria-label", "Ubah rentang tanggal");
      rangeBtn.addEventListener("click", () => {
        showRangePicker(getRange(), (newRange) => {
          rangeBtn.textContent = `📅 ${formatRangeLabel(newRange)}`;
          window.dispatchEvent(new CustomEvent("hw:range-changed", { detail: newRange }));
        });
      });
      actions.appendChild(rangeBtn);
    }
    header.appendChild(actions);
  }

  if (collapsible) {
    const controller = createAppBarController(header);
    let lastScrollY = 0;
    let ticking = false;
    function onScroll() {
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollY;
      lastScrollY = scrollY;
      if (!ticking) {
        requestAnimationFrame(() => {
          controller.setProgress(Math.min(scrollY / 96, 1), false);
          ticking = false;
        });
        ticking = true;
      }
      clearTimeout(header._snapTimeout);
      header._snapTimeout = setTimeout(() => controller.settle(delta > 0 ? -500 : 500), 150);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    header._cleanup = () => {
      window.removeEventListener("scroll", onScroll);
      header._cleanupInbox && header._cleanupInbox();
    };
  } else if (header._cleanupInbox) {
    header._cleanup = () => header._cleanupInbox();
  }
  return header;
}

export function shell(root, title, bodyBuilder, options = {}) {
  const { showRange = false, showSearch = false, collapsible = true, showInbox = false } = options;
  const wrap = el("div", "page");
  const range = getRange();
  const rangeLabel = showRange ? `${formatRangeLabel(range)} • ${range.tz}` : "";
  const header = appBar(title, { collapsible, rangeLabel, showSearch, showRange, showInbox });
  const main = el("div", "interaction-area");

  if (typeof bodyBuilder === "function") {
    const r = bodyBuilder(main);
    if (r && typeof r.catch === "function") r.catch((e) => console.warn("[view]", e));
  } else {
    main.appendChild(el("p", "placeholder", bodyBuilder));
  }

  const nav = bottomNav(location.hash);
  wrap.append(header, main, nav);
  wrap._cleanup = () => header._cleanup && header._cleanup();
  root.appendChild(wrap);

  if (!prefersReducedMotion()) {
    wrap.classList.add("nav-deeper-enter");
    wrap.addEventListener("animationend", () => wrap.classList.remove("nav-deeper-enter"), { once: true });
  }
  return { wrap, main };
}

// ---------- Search sheet (T19) ----------
function showSearchSheet() {
  track("search_opened", { entry: "appbar" }).catch(() => {}); // spec 19 (tanpa q)
  const api = openSheet({
    id: "search-sheet",
    title: "Cari",
    tall: true,
    build: (body, { close }) => {
      const container = el("div", "");
      container.id = "search-container";
      body.appendChild(container);
      const searchUI = createSearchUI(container, {
        onResultClick: ({ id, type }) => {
          close("result");
          if (type === "habit") location.hash = `#/habit/${id}`;
          else if (type === "uang") location.hash = `#/uang/${id}`;
          else if (type === "budget") location.hash = `#/uang?cat=${encodeURIComponent(id)}`;
          else location.hash = "#/pengaturan";
        }
      });
      setTimeout(() => searchUI.focus && searchUI.focus(), 100);
    },
    actions: [{ label: "Tutup", kind: "secondary" }],
  });
  return api;
}

// ---------- Habit add sheet ----------
function showAddHabitSheet(onCreated) {
  openSheet({
    title: "Tambah Habit",
    build: (body, { close }) => {
      const form = el("form", "form-stack");
      form.noValidate = true;
      const title = field("habit-title", { label: "Judul habit", placeholder: "mis. Minum air" });
      const type = selectField("habit-type", "Jenis target", [["check", "Centang"], ["count", "Hitungan"], ["duration", "Durasi"]], "check");
      const err = el("p", "field-error");
      err.hidden = true;
      err.setAttribute("role", "alert");
      const tplLabel = el("p", "label-sm", "Template cepat:");
      const tpl = el("div", "chip-row");
      let picked = null;
      getTemplates().forEach((t) => {
        const b = btn(t.title, "tpl-chip", () => {
          title.input.value = t.title;
          type.select.value = t.goal_type;
          picked = t;
          tpl.querySelectorAll(".tpl-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        });
        b.setAttribute("aria-pressed", "false");
        tpl.appendChild(b);
      });
      const row = el("div", "btn-row");
      const cancel = btn("Batal", "btn btn-secondary", () => close("cancel"));
      const save = btn("Simpan", "btn btn-primary");
      save.type = "submit";
      row.append(cancel, save);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const t = title.input.value.trim();
        if (!t) {
          err.hidden = false;
          err.textContent = "Judul wajib diisi.";
          title.input.setAttribute("aria-invalid", "true");
          title.input.focus();
          return;
        }
        save.disabled = true;
        const habit = await createHabit({ title: t, goal_type: type.select.value, category: picked && picked.title === t ? picked.category : undefined, schedule: picked && picked.title === t ? picked.schedule : undefined });
        close("saved");
        showToast(`Habit "${habit.title}" ditambahkan`, { tone: "success" });
        onCreated && onCreated(habit);
      });
      form.append(title.wrap, type.wrap, err, row, tplLabel, tpl);
      body.appendChild(form);
      setTimeout(() => title.input.focus(), 100);
    },
  });
}

// ---------- Transaction add sheet ----------
function showAddTransactionSheet(onCreated) {
  openSheet({
    title: "Catat Transaksi",
    tall: true,
    build: (body, { close }) => {
      const form = el("form", "form-stack");
      form.noValidate = true;
      const kind = selectField("tx-kind", "Jenis", [["expense", "Pengeluaran"], ["income", "Pemasukan"], ["transfer", "Transfer (catatan manual)"]], "expense");
      const amount = field("tx-amount", { label: "Nominal (Rp)", type: "number", placeholder: "mis. 25000", inputMode: "numeric" });
      amount.input.min = "1";
      const category = field("tx-category", { label: "Kategori", placeholder: "mis. Kopi" });
      const date = field("tx-date", { label: "Tanggal", type: "date", value: todayStr() });
      const note = field("tx-note", { label: "Catatan (opsional)", placeholder: "" });
      const err = el("p", "field-error");
      err.hidden = true;
      err.setAttribute("role", "alert");
      const row = el("div", "btn-row");
      const cancel = btn("Batal", "btn btn-secondary", () => close("cancel"));
      const save = btn("Simpan", "btn btn-primary");
      save.type = "submit";
      row.append(cancel, save);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const amt = parseInt(amount.input.value, 10);
        if (!amt || amt <= 0) {
          err.hidden = false;
          err.textContent = "Nominal harus lebih dari 0.";
          amount.input.setAttribute("aria-invalid", "true");
          amount.input.focus();
          return;
        }
        save.disabled = true;
        const tx = await createTransaction({ kind: kind.select.value, amount: amt, category: category.input.value.trim() || "Lainnya", date: date.input.value, note: note.input.value.trim() });
        close("saved");
        showToast("Transaksi tersimpan", { tone: "success" });
        onCreated && onCreated(tx);
      });
      form.append(kind.wrap, amount.wrap, category.wrap, date.wrap, note.wrap, err, row);
      body.appendChild(form);
      setTimeout(() => amount.input.focus(), 100);
    },
  });
}

// ---------- Re-auth helper (spec 07/09): jalankan aksi sensitif setelah re-auth ----------
export async function withReAuth(action, { reason = "Aksi ini butuh verifikasi ulang." } = {}) {
  if (!isReAuthed()) {
    const ok = await confirmSheet({ title: "Verifikasi ulang", desc: `${reason} Sesi verifikasi berlaku 5 menit.`, confirmLabel: "Verifikasi", cancelLabel: "Batal" });
    if (!ok) return null;
    const granted = await requestReAuth();
    if (!granted) {
      showToast("Verifikasi gagal", { tone: "warning" });
      return null;
    }
  }
  return action();
}

// ---------- Beranda ----------
export function Beranda(root, ctx = {}) {
  shell(root, "HabitWealth", async (container) => {
    const range = getRange();

    // T5 handoff: first-use vs returning dibedakan (spec 02 Gate B)
    if (ctx.query && ctx.query.first === "1") {
      const first = el("div", "notice mb-16");
      first.dataset.tone = "success";
      first.setAttribute("role", "status");
      const ic = el("span", "notice-icon", "🎉");
      ic.setAttribute("aria-hidden", "true");
      const body = el("div", "notice-body");
      body.append(el("div", "notice-title", "Habit pertamamu tercatat"), el("div", "", "Ini Beranda sederhanamu. Besok cukup buka tab Habit dan centang lagi. Uang bisa dicatat kapan saja di tab Uang."));
      first.append(ic, body);
      container.appendChild(first);
      try { history.replaceState(null, "", "#/beranda"); } catch {}
    }

    container.appendChild(el("p", "placeholder mb-16", `Ringkasan ${formatRangeLabel(range)} • ${range.tz} — offline-ready, data terakhir tetap tampil.`));

    const adaptive = getAdaptiveTier();
    const perf = getPerfMetrics();
    const budgets = checkBudgets();
    const lcp = perf.lcp && perf.lcp.value ? `${perf.lcp.value.toFixed(0)}ms${budgets.lcp && budgets.lcp.pass === false ? " ⚠️" : ""}` : "-";
    const cls = perf.cls && typeof perf.cls.value === "number" ? `${perf.cls.value.toFixed(3)}${budgets.cls && budgets.cls.pass === false ? " ⚠️" : ""}` : "-";
    container.appendChild(el("p", "meta-line", `Tier ${adaptive.tier} • Mem ${adaptive.memory}GB • Conc ${adaptive.concurrency} • LCP ${lcp} • CLS ${cls}`));

    const ringWrap = el("div", "ring-row");
    const ringContainer = el("div", "");
    const streakContainer = el("div", "");
    ringWrap.append(ringContainer, streakContainer);
    container.appendChild(ringWrap);

    // Data nyata dari IDB: selesai hari ini + 7 hari terakhir (bukan mock acak)
    const habits = await listHabits().catch(() => []);
    const today = todayStr();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const perDay = Object.fromEntries(days.map((d) => [d, 0]));
    let doneToday = 0;
    for (const h of habits) {
      const entries = await listEntries(h.id, { from: days[0], to: days[6] }).catch(() => []);
      for (const e of entries) {
        if (e.status === "done" && perDay[e.date] !== undefined) perDay[e.date] += 1;
        if (e.status === "done" && e.date === today) doneToday += 1;
      }
    }
    const percent = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
    renderRingProgress(ringContainer, percent, { srLabel: `${doneToday} dari ${habits.length} habit selesai hari ini` });
    const bestStreak = habits.reduce((a, h) => Math.max(a, h.streak || 0), 0);
    renderStreakDots(streakContainer, Math.min(bestStreak, 30), 30);

    const barContainer = el("div", "chart-card chart-200");
    barContainer.appendChild(skeleton("card"));
    const donutContainer = el("div", "chart-card chart-240");
    donutContainer.appendChild(skeleton("card"));
    container.append(barContainer, donutContainer);

    try {
      const txs = await listTransactions({ from: range.from, to: range.to }).catch(() => []);
      const byCat = {};
      for (const tx of txs) if (tx.kind === "expense") byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount;
      const catData = Object.entries(byCat).map(([k, v]) => ({ key: k, total: v }));
      barContainer.innerHTML = "";
      donutContainer.innerHTML = "";
      const habitEntries = days.map((d) => ({ date: d.slice(5), done: perDay[d] }));
      renderHabitBar(barContainer, habitEntries, { reduceMotion: prefersReducedMotion() }).catch(() => {});
      if (catData.length) {
        renderDonutCategory(donutContainer, catData, { reduceMotion: prefersReducedMotion() }).catch(() => {});
      } else {
        donutContainer.appendChild(el("p", "empty-state", "Belum ada pengeluaran di rentang ini."));
      }
      const summary = await api.get(`/dashboard/summary?from=${range.from || ""}&to=${range.to || ""}&tz=${range.tz}`).catch(() => null);
      if (summary && summary.ok && summary.data) {
        container.appendChild(el("p", "status-line", `Server: ${summary.data.habits.done}/${summary.data.habits.total} habit • masuk ${getDisplayAmount(summary.data.cashflow.in)} • keluar ${getDisplayAmount(summary.data.cashflow.out)}`));
      }
    } catch (e) {
      console.warn("[beranda] charts failed", e);
      barContainer.innerHTML = "";
      donutContainer.innerHTML = "";
      barContainer.appendChild(el("p", "empty-state", "Gagal memuat grafik."));
    }

    const actions = el("div", "btn-row wrap mt-16");
    actions.append(
      btn("Insight & Celengan", "btn btn-secondary btn-small insight-link", () => { location.hash = "#/insight"; }),
      btn("Bagikan Streak", "btn btn-secondary btn-small", () => shareStreakCard({ streakDays: bestStreak }).catch(() => {})),
      btn("Bacakan Ringkasan", "btn btn-secondary btn-small", () => speak(`Ringkasan ${formatRangeLabel(range)}: ${habits.length} habit, ${percent} persen selesai hari ini.`, { lang: "id-ID" })),
      btn("Cetak", "btn btn-secondary btn-small", () => printReport()),
    );
    container.appendChild(actions);
  }, { showRange: true, showSearch: true, showInbox: true, collapsible: true });
}

// ---------- Habit ----------
function habitDetail(root, id) {
  shell(root, "Detail Habit", async (c) => {
    c.appendChild(skeleton("card"));
    const habit = await getHabit(id);
    c.innerHTML = "";
    if (!habit) {
      c.appendChild(el("p", "empty-state", "Habit tidak ditemukan."));
      c.appendChild(btn("Kembali", "btn btn-secondary", () => goBack(root, "#/habit")));
      return;
    }
    const head = el("div", "card");
    head.append(el("div", "card-title", habit.title), el("div", "card-sub", `Streak ${habit.streak || 0} hari • ${habit.category} • ${habit.goal_type}`));
    c.appendChild(head);

    const entries = await listEntries(habit.id).catch(() => []);
    c.appendChild(el("h3", "settings-heading", `Riwayat (${entries.length})`));
    const list = el("div", "entry-list");
    if (!entries.length) list.appendChild(el("p", "empty-state", "Belum ada catatan. Centang di tab Habit."));
    entries.slice(0, 30).forEach((e) => {
      const item = el("div", "entry-item");
      item.append(el("span", "", formatDateId(e.date)), el("span", "", e.status === "done" ? "✓ selesai" : e.status));
      list.appendChild(item);
    });
    c.appendChild(list);

    const actions = el("div", "btn-row wrap mt-16");
    actions.append(
      btn("Kembali", "btn btn-secondary", () => goBack(root, "#/habit")),
      btn("Hapus habit", "btn btn-destructive", async () => {
        const ok = await confirmSheet({
          title: `Hapus "${habit.title}"?`,
          desc: "Tindakan ini permanen di perangkat ini dan akan disinkronkan.",
          detail: [`${entries.length} catatan riwayat ikut terhapus`, "Streak tidak bisa dipulihkan"],
          confirmLabel: "Hapus",
          destructive: true,
        });
        if (!ok) return;
        await deleteHabit(habit.id);
        showToast("Habit dihapus");
        goBack(root, "#/habit");
      }),
    );
    c.appendChild(actions);
  }, { collapsible: false });
}

export function Habit(root, ctx = {}) {
  if (ctx.params && ctx.params.id) return habitDetail(root, ctx.params.id);

  shell(root, "Habit", async (container) => {
    const list = el("div", "habit-list");
    container.appendChild(list);
    const addBtn = btn("+ Tambah Habit", "btn btn-primary btn-block mt-16", () => showAddHabitSheet(() => loadHabits()));
    container.appendChild(addBtn);

    async function loadHabits() {
      list.innerHTML = "";
      for (let i = 0; i < 3; i++) list.appendChild(skeleton("card"));
      const habits = await listHabits().catch(() => []);
      const today = todayStr();
      list.innerHTML = "";
      if (!habits.length) {
        list.appendChild(el("p", "empty-state", "Belum ada habit. Coba template di bawah."));
        const tplWrap = el("div", "chip-row");
        getTemplates().forEach((t) => {
          tplWrap.appendChild(btn(t.title, "tpl-chip", async () => {
            const h = await createHabit(t);
            showToast(`Habit "${h.title}" ditambahkan`, { tone: "success" });
            loadHabits();
          }));
        });
        list.appendChild(tplWrap);
        return;
      }
      for (const h of habits) {
        const entriesToday = await listEntries(h.id, { from: today, to: today }).catch(() => []);
        let done = entriesToday.some((e) => e.status === "done");
        const card = el("div", "habit-card");
        const check = el("div", `check${done ? " done" : ""}`);
        check.setAttribute("aria-hidden", "true");
        const info = el("div", "info");
        const title = el("div", "title", h.title);
        const sub = el("div", "subtitle", `Streak ${h.streak || 0} hari • ${h.category}`);
        info.append(title, sub);
        const toggle = btn(done ? "Batal" : "✓", "btn btn-secondary btn-small");
        toggle.setAttribute("aria-label", done ? `Batalkan ${h.title} hari ini` : `Tandai ${h.title} selesai hari ini`);
        toggle.setAttribute("aria-pressed", String(done));
        toggle.addEventListener("click", async (e) => {
          e.stopPropagation();
          toggle.disabled = true;
          if (!done) {
            await completeHabit(h.id, today);
            feedbackHabitComplete();
            done = true;
            h.streak = (h.streak || 0) + 1;
            showToast("Selesai! Streak bertambah.", { tone: "success", actionLabel: "Batal", onAction: () => toggle.click() });
            // T11: StreakCelebration 7/30/100 (lazy; 1× per habit per milestone; bisa dimatikan)
            import("./views-insight.jsx").then((m) => m.maybeCelebrate({ habitId: h.id, streak: h.streak, habitTitle: h.title })).catch(() => {});
          } else {
            await undoComplete(h.id, today);
            done = false;
            h.streak = Math.max(0, (h.streak || 1) - 1);
          }
          check.classList.toggle("done", done);
          toggle.textContent = done ? "Batal" : "✓";
          toggle.setAttribute("aria-pressed", String(done));
          toggle.setAttribute("aria-label", done ? `Batalkan ${h.title} hari ini` : `Tandai ${h.title} selesai hari ini`);
          sub.textContent = `Streak ${h.streak || 0} hari • ${h.category}`;
          toggle.disabled = false;
        });
        card.append(check, info, toggle);
        card.addEventListener("click", (e) => {
          if (e.target === toggle) return;
          location.hash = `#/habit/${h.id}`;
        });
        list.appendChild(card);
      }
    }
    await loadHabits();
  }, { showRange: true, showSearch: true, collapsible: true });
}

// ---------- Uang ----------
function transactionDetail(root, id) {
  shell(root, "Detail Transaksi", async (c) => {
    c.appendChild(skeleton("card"));
    checkReAuthFromStorage();
    const tx = await getTransaction(id);
    c.innerHTML = "";
    if (!tx) {
      c.appendChild(el("p", "empty-state", "Transaksi tidak ditemukan."));
      c.appendChild(btn("Kembali", "btn btn-secondary", () => goBack(root, "#/uang")));
      return;
    }
    const kindLabel = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" }[tx.kind] || tx.kind;
    const card = el("div", "card");
    const amt = el("div", "tx-amount", getDisplayAmount(tx.amount));
    amt.dataset.kind = tx.kind;
    card.append(el("div", "card-title", `${tx.category} • ${kindLabel}`), el("div", "card-sub", `${formatDateId(tx.date)} • ${tx.account_ref}`), amt);
    if (tx.note) card.appendChild(el("div", "card-sub mt-8", tx.note));
    c.appendChild(card);
    c.appendChild(el("p", "status-line", "Rekategori, split, dan refund menyusul (spec 09)."));
    const actions = el("div", "btn-row wrap mt-16");
    actions.append(
      btn("Kembali", "btn btn-secondary", () => goBack(root, "#/uang")),
      btn("Hapus", "btn btn-destructive", async () => {
        const ok = await confirmSheet({ title: "Hapus transaksi ini?", desc: "Catatan manual dihapus dari perangkat dan disinkronkan.", confirmLabel: "Hapus", destructive: true });
        if (!ok) return;
        await deleteTransaction(tx.id);
        showToast("Transaksi dihapus");
        goBack(root, "#/uang");
      }),
    );
    c.appendChild(actions);
  }, { collapsible: false });
}

export function Uang(root, ctx = {}) {
  if (ctx.params && ctx.params.id) return transactionDetail(root, ctx.params.id);

  shell(root, "Uang", async (container) => {
    checkReAuthFromStorage();
    const topRow = el("div", "row-between mb-12");
    const balance = el("div", "balance");
    const eye = btn("", "btn btn-flat btn-small");
    const addBtn = btn("+ Catat", "btn btn-primary btn-small", () => showAddTransactionSheet(() => loadMoney()));
    topRow.append(balance, addBtn);
    container.appendChild(topRow);

    const budgetWrap = el("div", "mb-16");
    const feed = el("div", "feed");
    const donutContainer = el("div", "chart-card chart-240 mt-16");
    container.append(budgetWrap, feed, donutContainer);

    async function renderBalance() {
      // T11: saldo tercatat manual (Σ pemasukan − Σ pengeluaran − celengan virtual) menggantikan nilai mock Wave 2
      let bal = { available: 0, goals: 0 };
      try {
        const { getRecordedBalance } = await import("./insight.js");
        bal = await getRecordedBalance();
      } catch {}
      balance.innerHTML = "";
      const strong = el("strong", "", getDisplayAmount(bal.available));
      balance.append(document.createTextNode("Saldo tercatat (manual): "), strong, eye);
      if (bal.goals > 0) {
        const goalLink = btn(`Celengan virtual: ${getDisplayAmount(bal.goals)} ›`, "btn btn-flat btn-small", () => { location.hash = "#/insight"; });
        balance.appendChild(goalLink);
      }
      eye.textContent = isReAuthed() ? "🙈" : "👁️";
      eye.setAttribute("aria-label", isReAuthed() ? "Sembunyikan saldo" : "Tampilkan saldo (verifikasi ulang)");
      eye.setAttribute("aria-pressed", String(!!isReAuthed()));
    }
    eye.addEventListener("click", async () => {
      if (isReAuthed()) {
        clearReAuth();
        showToast("Saldo dimasking lagi");
        await loadMoney();
        return;
      }
      const r = await withReAuth(() => true, { reason: "Untuk melihat saldo penuh." });
      if (r) {
        showToast("Saldo ditampilkan 5 menit", { tone: "success" });
        await loadMoney();
      }
    });

    async function loadMoney() {
      checkReAuthFromStorage();
      await renderBalance();
      // Budget status
      budgetWrap.innerHTML = "";
      budgetWrap.appendChild(skeleton("card"));
      const month = todayStr().slice(0, 7);
      const status = await getBudgetStatus(month).catch(() => []);
      budgetWrap.innerHTML = "";
      if (!status.length) {
        budgetWrap.appendChild(el("p", "status-line", `Belum ada budget bulan ${month}.`));
      } else {
        status.forEach((b) => {
          const card = el("div", "card budget-card");
          const head = el("div", "budget-head");
          const statusText = b.status === "over" ? "⚠️ lewat" : b.status === "warning" ? "⚠️ 80%+" : "aman";
          head.append(el("span", "", b.category), el("span", "", `${b.pct}% • ${statusText}`));
          const prog = el("div", "progress");
          prog.setAttribute("role", "progressbar");
          prog.setAttribute("aria-valuemin", "0");
          prog.setAttribute("aria-valuemax", "100");
          prog.setAttribute("aria-valuenow", String(Math.min(100, b.pct)));
          prog.setAttribute("aria-label", `Budget ${b.category} ${b.pct}%`);
          const bar = el("div", "progress-bar");
          bar.dataset.status = b.status;
          bar.style.width = `${Math.min(100, b.pct)}%`; // nilai data, bukan token visual
          prog.appendChild(bar);
          card.append(head, prog, el("div", "budget-foot", `${getDisplayAmount(b.spent)} / ${getDisplayAmount(b.limit)}`));
          budgetWrap.appendChild(card);
        });
      }
      // Feed
      feed.innerHTML = "";
      feed.append(skeleton("list"), skeleton("list"));
      const range = getRange();
      const txs = await listTransactions({ from: range.from, to: range.to, cat: ctx.query && ctx.query.cat ? ctx.query.cat : undefined }).catch(() => []);
      feed.innerHTML = "";
      if (!txs.length) {
        const empty = el("div", "empty-state");
        empty.appendChild(el("p", "", `Tidak ada transaksi ${range.from ? `${formatDateId(range.from)} – ${formatDateId(range.to)}` : ""}.`));
        empty.appendChild(btn("Kembali ke Bulan ini", "btn btn-flat btn-small", () => { location.hash = "#/uang?preset=month"; }));
        feed.appendChild(empty);
      } else {
        txs.slice(0, 20).forEach((tx) => {
          const item = el("button", "tx-item");
          item.type = "button";
          const left = el("div", "");
          left.append(el("div", "tx-main", `${tx.category} • ${{ expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" }[tx.kind] || tx.kind}`), el("div", "tx-sub", `${formatDateId(tx.date)} • ${tx.account_ref}`));
          const amt = el("div", "tx-amount", getDisplayAmount(tx.amount));
          amt.dataset.kind = tx.kind;
          item.append(left, amt);
          item.addEventListener("click", () => { location.hash = `#/uang/${tx.id}`; });
          feed.appendChild(item);
        });
      }
      // Donut
      donutContainer.innerHTML = "";
      const byCat = {};
      for (const tx of txs) if (tx.kind === "expense") byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount;
      const catData = Object.entries(byCat).map(([k, v]) => ({ key: k, total: v }));
      if (catData.length) renderDonutCategory(donutContainer, catData, { reduceMotion: prefersReducedMotion() }).catch(() => {});
      else donutContainer.appendChild(el("p", "empty-state", "Grafik kategori muncul setelah ada pengeluaran."));
    }
    await loadMoney();
  }, { showRange: true, showSearch: true });
}

// ---------- Pengaturan ----------
export function Pengaturan(root, ctx = {}) {
  if (ctx.params && ctx.params.sub === "notifikasi") {
    // T12: NotificationPreferences (lazy agar views.jsx tidak membengkak)
    import("./views-notify.jsx").then((m) => m.NotifPrefs(root, ctx)).catch((e) => console.warn("[views] notif prefs", e));
    return;
  }
  const rerender = () => {
    root.querySelectorAll(".page").forEach((p) => {
      try { p._cleanup && p._cleanup(); } catch {}
      p.remove();
    });
    Pengaturan(root);
  };
  shell(root, "Pengaturan", async (container) => {
    const settings = await getSettings().catch(() => ({}));
    const session = getSession();
    const passkeyState = getPasskeyState();
    const consentHist = getConsentHistory();
    const lastConsent = consentHist[0] || null;

    function row(label, { value, badge = false, onClick, destructive = false } = {}) {
      const b = el("button", "settings-row");
      b.type = "button";
      const lab = el("span", "settings-label", label);
      if (badge) {
        const dot = el("span", "badge-dot");
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", "Pengingat");
        lab.appendChild(dot);
      }
      b.appendChild(lab);
      if (value !== undefined) b.appendChild(el("span", "settings-value", value));
      const chev = el("span", "settings-chevron", "›");
      chev.setAttribute("aria-hidden", "true");
      b.appendChild(chev);
      if (destructive) b.classList.add("settings-row-destructive");
      if (onClick) b.addEventListener("click", () => onClick(b));
      else b.disabled = true;
      return b;
    }
    function heading(text) {
      return el("h3", "settings-heading", text);
    }
    function setValue(b, v) {
      const span = b.querySelector(".settings-value");
      if (span) span.textContent = v;
    }

    // Akun
    container.appendChild(heading("Akun"));
    container.appendChild(row(session ? `Masuk sebagai ${maskEmail(session.email)}` : "Belum masuk", { value: session && session.offline_created ? "dibuat offline" : undefined }));
    const passkeyRow = row("Passkey", {
      value: passkeyState.status === "enrolled" ? "aktif" : passkeyState.status === "deferred" ? "belum diatur (Nanti Saja)" : "belum diatur",
      badge: hasPasskeyReminder(),
      onClick: async (b) => {
        const cap = await getPasskeyCapability();
        const msg = cap.canEnroll ? "Passkey siap diaktifkan." : cap.offerPasskey ? PASSKEY_REASON_COPY.RP_NOT_CONFIGURED : PASSKEY_REASON_COPY[cap.supported ? (cap.secureContext ? "NO_PLATFORM_AUTHENTICATOR" : "INSECURE_CONTEXT") : "UNSUPPORTED"];
        await infoSheet({ title: "Passkey", desc: msg });
        if (hasPasskeyReminder()) {
          dismissPasskeyReminder();
          b.querySelector(".badge-dot")?.remove();
        }
      },
    });
    container.appendChild(passkeyRow);
    container.appendChild(row("Keluar", {
      onClick: async () => {
        const ok = await confirmSheet({ title: "Keluar dari akun ini?", desc: "Data habit dan uang tetap tersimpan di perangkat.", confirmLabel: "Keluar" });
        if (!ok) return;
        await logout();
        location.hash = "#/auth";
      },
    }));

    // Notifikasi (T12)
    container.appendChild(heading("Notifikasi"));
    container.appendChild(row("Preferensi notifikasi", { value: "kategori • jam tenang", onClick: () => { location.hash = "#/pengaturan/notifikasi"; } }));
    const inboxRow = row("Kotak masuk", { value: "…", onClick: () => { location.hash = "#/notifikasi"; } });
    unreadCount().then((n) => setValue(inboxRow, n > 0 ? `${n} belum dibaca` : "kosong")).catch(() => setValue(inboxRow, "—"));
    container.appendChild(inboxRow);

    // Insight & Celengan (T11) — opt-in, dihitung di perangkat
    container.appendChild(heading("Insight"));
    container.appendChild(row("Insight & Celengan virtual", { value: "opt-in • di perangkat", onClick: () => { location.hash = "#/insight"; } }));

    // Tampilan
    container.appendChild(heading("Tampilan"));
    const themeRow = row("Tema", {
      value: settings.theme || "system",
      onClick: async (b) => {
        const picked = await chooseSheet({ title: "Tema", options: [["system", "Ikuti sistem"], ["light", "Terang"], ["dark", "Gelap"]].map(([value, label]) => ({ value, label })), current: settings.theme || "system" });
        if (!picked) return;
        setTheme(picked);
        settings.theme = picked;
        setValue(b, picked);
        showToast(`Tema: ${picked}`);
      },
    });
    container.appendChild(themeRow);
    const hapticsRow = row("Getar (haptics)", {
      value: settings.feedback && settings.feedback.haptics ? "ON" : "OFF",
      onClick: async (b) => {
        const next = !(settings.feedback && settings.feedback.haptics);
        await updateSetting("feedback.haptics", next);
        settings.feedback = { ...(settings.feedback || {}), haptics: next };
        setValue(b, next ? "ON" : "OFF");
        showToast(`Getar ${next ? "aktif" : "nonaktif"}`);
      },
    });
    container.appendChild(hapticsRow);
    container.appendChild(row("Suara (default OFF)", {
      value: settings.feedback && settings.feedback.sound ? "ON" : "OFF",
      onClick: async (b) => {
        const next = !(settings.feedback && settings.feedback.sound);
        await updateSetting("feedback.sound", next);
        settings.feedback = { ...(settings.feedback || {}), sound: next };
        setValue(b, next ? "ON" : "OFF");
        showToast(`Suara ${next ? "aktif" : "nonaktif"}`);
      },
    }));

    // Data & Privasi
    container.appendChild(heading("Data & Privasi"));
    const consentValue = lastConsent ? `v${lastConsent.version} • kesehatan ${lastConsent.kesehatan ? "✓" : "–"} • finansial ${lastConsent.finansial ? "✓" : "–"}` : "belum tercatat";
    container.appendChild(row("Riwayat persetujuan", {
      value: consentValue,
      onClick: () => {
        openSheet({
          title: "Riwayat persetujuan",
          desc: lastConsent ? `${consentHist.length} catatan. Opsional bisa dicabut kapan saja; data manual tidak dihapus.` : "Belum ada riwayat persetujuan.",
          tall: true,
          build: (body, { close }) => {
            consentHist.slice(0, 10).forEach((c) => {
              const n = el("div", "notice mb-8");
              const ic = el("span", "notice-icon", c.revoked ? "↩️" : "📝");
              ic.setAttribute("aria-hidden", "true");
              const nb = el("div", "notice-body");
              const when = new Date(c.granted_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
              nb.append(el("div", "notice-title", c.revoked ? `Cabut ${c.revoked}` : `Persetujuan v${c.version}`), el("div", "", `${when} • dasar ${c.dasar ? "✓" : "–"} • kesehatan ${c.kesehatan ? "✓" : "–"} • finansial ${c.finansial ? "✓" : "–"}`));
              n.append(ic, nb);
              body.appendChild(n);
            });
            const rowBtns = el("div", "btn-row wrap mt-8");
            ["kesehatan", "finansial"].forEach((scope) => {
              if (!lastConsent || !lastConsent[scope]) return;
              rowBtns.appendChild(btn(`Cabut ${scope}`, "btn btn-secondary btn-small", async () => {
                const ok = await confirmSheet({ title: `Cabut persetujuan ${scope}?`, desc: "Sinkron terkait berhenti; riwayat manual tidak dihapus.", confirmLabel: "Cabut", destructive: true });
                if (!ok) return;
                await revokeConsent(scope);
                close("revoked");
                showToast(`Persetujuan ${scope} dicabut`);
                rerender();
              }));
            });
            body.appendChild(rowBtns);
          },
          actions: [{ label: "Tutup", kind: "secondary" }],
        });
      },
    }));
    container.appendChild(row("Export data", {
      value: "butuh verifikasi",
      onClick: async () => {
        const res = await withReAuth(() => requestExport("all"), { reason: "Export berisi seluruh data habit dan uang." });
        if (res) await infoSheet({ title: "Export diproses", desc: `ID ${res.id} • status ${res.status}${res.fileName ? ` • ${res.fileName}` : ""}` });
      },
    }));
    container.appendChild(row("Hapus akun", {
      value: "permanen",
      destructive: true,
      onClick: async () => {
        const ok = await confirmSheet({
          title: "Hapus akun?",
          desc: "Tindakan permanen. Kami akan menjelaskan apa yang dihapus dan disimpan.",
          detail: ["Dihapus: habit, catatan uang, preferensi", "Disimpan sementara: log audit teredaksi (tanpa isi data)", "Pihak ketiga: tidak ada (belum ada integrasi)"],
          confirmLabel: "Ajukan penghapusan",
          destructive: true,
        });
        if (!ok) return;
        const res = await withReAuth(() => requestDeleteAccount("user request"), { reason: "Penghapusan akun bersifat permanen." });
        if (res) await infoSheet({ title: "Permintaan diterima", desc: `ID ${res.id} • status ${res.status || "pending"}. Kamu bisa membatalkan selama permintaan masih diproses.` });
      },
    }));
    container.appendChild(row("Hapus data lokal", {
      value: "IndexedDB + preferensi",
      destructive: true,
      onClick: async () => {
        const ok = await confirmSheet({ title: "Hapus semua data lokal?", desc: "Habit, uang, antrean sinkron, dan sesi di perangkat ini akan dihapus.", confirmLabel: "Hapus lokal", destructive: true });
        if (!ok) return;
        const done = await withReAuth(async () => {
          const { wipeAllData } = await import("./settings.js");
          await wipeAllData();
          return true;
        }, { reason: "Menghapus seluruh data di perangkat." });
        if (done) {
          showToast("Data lokal dihapus");
          setTimeout(() => location.reload(), 400); // reset cache memori (prefs/permissions) — satu-satunya reload yang disengaja
        }
      },
    }));

    // Bantuan
    container.appendChild(heading("Bantuan"));
    container.appendChild(row("FAQ", {
      onClick: () => {
        openSheet({
          title: "FAQ",
          tall: true,
          build: (body) => {
            getFAQ().forEach((f) => {
              const item = el("div", "faq-item");
              item.append(el("div", "faq-q", f.q), el("div", "faq-a", f.a));
              body.appendChild(item);
            });
          },
          actions: [
            { label: "Bacakan", kind: "flat", close: false, onClick: () => { speak(getFAQ().map((f) => `${f.q} ${f.a}`).join(". "), { lang: "id-ID" }); return false; } },
            { label: "Hentikan", kind: "flat", close: false, onClick: () => { cancelSpeak(); return false; } },
            { label: "Tutup", kind: "secondary" },
          ],
        });
      },
    }));
    container.appendChild(row("Cetak laporan", { value: "nilai tetap dimasking", onClick: () => printReport() }));
    container.appendChild(row("Bagikan streak", { onClick: () => shareStreakCard({ streakDays: 7 }).catch(() => {}) }));
    container.appendChild(row("Salin kode referral", {
      onClick: async () => {
        const ok = await copyToClipboard("REF123");
        showToast(ok ? "Kode referral disalin" : "Gagal menyalin", { tone: ok ? "success" : "warning" });
      },
    }));

    // Tentang
    container.appendChild(heading("Tentang"));
    container.appendChild(row("Versi", { value: `${settings.v || 2} • PWA ${isStandalone() ? "standalone" : "browser"}` }));
    container.appendChild(row("Pasang aplikasi", {
      onClick: () => {
        if (isStandalone()) showToast("Sudah terpasang");
        else showInstallSheet();
      },
    }));
    container.appendChild(row("Cek performa", {
      value: "LCP/CLS",
      onClick: () => {
        const m = getPerfMetrics();
        const b = checkBudgets();
        infoSheet({ title: "Performa (perangkat ini)", items: [
          `LCP ${m.lcp && m.lcp.value ? `${m.lcp.value.toFixed(0)} ms` : "-"} • budget 2500 ms • ${b.lcp && b.lcp.pass === false ? "LEWAT" : b.lcp && b.lcp.pass ? "lolos" : "belum terukur"}`,
          `CLS ${m.cls && typeof m.cls.value === "number" ? m.cls.value.toFixed(3) : "-"} • budget 0.1 • ${b.cls && b.cls.pass === false ? "LEWAT" : b.cls && b.cls.pass ? "lolos" : "belum terukur"}`,
        ] });
      },
    }));
    container.appendChild(row("Tier adaptif", {
      onClick: () => {
        const t = getAdaptiveTier();
        infoSheet({ title: "Tier adaptif (petunjuk, tidak membatasi fitur)", items: [`Tier ${t.tier}`, `Memori ${t.memory} GB`, `Konkurensi ${t.concurrency}`, `Jaringan ${t.network && t.network.effectiveType ? t.network.effectiveType : "-"}`] });
      },
    }));
  }, { collapsible: false });
}

export function NotFound(root) {
  shell(root, "Tidak ditemukan", "Halaman tidak ada. Kembali via tab di bawah.", { collapsible: false });
}
