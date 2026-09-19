// Wave 2 — Full MVP views: Beranda, Habit, Uang, Pengaturan + search, range, charts, habit/money/settings logic
// T6: HabitToday/Editor/Detail + IndexedDB queue
// T7: MoneyOverview/Feed/Add + masking+re-auth mock
// T8: Settings/Export/Delete mock + Help
// T16: Visualization ECharts core+Bar/Pie, ring/streak SVG, donut-tap-filter, lazy scatter
// T17: Date-range picker global preset+custom+hash state
// T19: Search global box+4 scope tabs+ranking+history max-5 lokal+offline index
// AUD-* Wave 2: API/WORK/HAPT/NOTIF/SEARCH/CHARTS/ORIENT/SHARE/PERF/NET + PRINT/CAP/IMPORT (with amendments)

import { createSkeleton, createAppBarController, transitionFor, prefersReducedMotion } from "./motion.js";
import { makeSheetDraggable } from "./gestures.js";
import { getRange } from "./storage/prefs.js";
import { setTheme } from "./theme.js";
import { showInstallSheet, isStandalone } from "./pwa.js";
import { listHabits, createHabit, completeHabit, undoComplete, getTemplates } from "./habit.js";
import { listTransactions, createTransaction, getDisplayAmount, requestReAuth, isReAuthed, checkReAuthFromStorage, getBudgetStatus } from "./money.js";
import { getSettings, updateSetting, requestExport, requestDeleteAccount, getFAQ } from "./settings.js";
import { renderRingProgress, renderStreakDots, renderHabitBar, renderDonutCategory, renderCashflowBar } from "./charts.js";
import { showRangePicker, formatRangeLabel } from "./range.js";
import { createSearchUI } from "./search.js";
import { feedbackHabitComplete } from "./feedback.js";
import { shareStreakCard, copyToClipboard } from "./share.js";
import { speak, cancelSpeak } from "./speech.js";
import { printReport } from "./print.js";
import { getPerfMetrics, checkBudgets } from "./perf.js";
import { getAdaptiveTier } from "./net.js";
import { api } from "./api.js";

const TABS = [
  ["#/beranda", "Beranda"],
  ["#/habit", "Habit"],
  ["#/uang", "Uang"],
  ["#/pengaturan", "Pengaturan"]
];

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
      const relation = "peer";
      const t = transitionFor(relation);
      document.documentElement.style.setProperty("--motion-duration", `${t.duration}ms`);
    });
    nav.appendChild(a);
  });
  return nav;
}

function appBar(title, options = {}) {
  const { collapsible = true, rangeLabel = "", showSearch = false, showRange = false } = options;
  const header = document.createElement("header");
  header.className = "appbar viewing-area";
  header.dataset.state = "expanded";

  const h1 = document.createElement("h1");
  h1.className = "appbar-title";
  h1.textContent = title;
  header.appendChild(h1);

  if (rangeLabel) {
    const sub = document.createElement("p");
    sub.className = "placeholder";
    sub.style.fontSize = "12px";
    sub.style.marginTop = "4px";
    sub.textContent = rangeLabel;
    header.appendChild(sub);
  }

  // Actions row: search + range
  if (showSearch || showRange) {
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.justifyContent = "center";
    actions.style.marginTop = "12px";

    if (showSearch) {
      const searchBtn = document.createElement("button");
      searchBtn.className = "btn btn-secondary btn-small";
      searchBtn.textContent = "🔍 Cari";
      searchBtn.dataset.searchTrigger = "1";
      searchBtn.setAttribute("aria-label", "Cari");
      searchBtn.addEventListener("click", () => {
        // Show search sheet
        showSearchSheet();
      });
      actions.appendChild(searchBtn);
    }

    if (showRange) {
      const rangeBtn = document.createElement("button");
      rangeBtn.className = "btn btn-secondary btn-small";
      rangeBtn.textContent = `📅 ${getRange().preset || "Bulan ini"}`;
      rangeBtn.addEventListener("click", () => {
        showRangePicker(getRange(), (newRange) => {
          rangeBtn.textContent = `📅 ${newRange.preset}`;
          // Trigger reload of current view? For MVP, just reload hash
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
          const progress = Math.min(scrollY / 96, 1);
          controller.setProgress(progress, false);
          ticking = false;
        });
        ticking = true;
      }
      clearTimeout(header._snapTimeout);
      header._snapTimeout = setTimeout(() => {
        controller.settle(delta > 0 ? -500 : 500);
      }, 150);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    header._cleanup = () => window.removeEventListener("scroll", onScroll);
  }

  return header;
}

function shell(root, title, bodyBuilder, options = {}) {
  const { showRange = false, showSearch = false, collapsible = true } = options;
  const wrap = document.createElement("div");
  wrap.className = "page";

  const range = getRange();
  const rangeLabel = showRange ? `${formatRangeLabel(range)} • ${range.tz}` : "";

  const header = appBar(title, { collapsible, rangeLabel, showSearch, showRange });

  const main = document.createElement("div");
  main.className = "interaction-area";

  if (typeof bodyBuilder === "function") {
    bodyBuilder(main);
  } else {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = bodyBuilder;
    main.appendChild(p);
  }

  const nav = bottomNav(location.hash);

  wrap.append(header, main, nav);
  root.appendChild(wrap);

  if (!prefersReducedMotion()) {
    wrap.classList.add("nav-deeper-enter");
    wrap.addEventListener("animationend", () => wrap.classList.remove("nav-deeper-enter"), { once: true });
  }
}

// Search sheet (T19)
function showSearchSheet() {
  const existing = document.getElementById("search-sheet");
  if (existing) return;

  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.id = "search-scrim";

  const sheet = document.createElement("div");
  sheet.id = "search-sheet";
  sheet.className = "pwa-sheet sheet-bottom";
  sheet.style.maxHeight = "90dvh";
  sheet.style.overflow = "auto";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");

  sheet.innerHTML = `<div class="sheet-content"><div class="sheet-handle"></div><h2 class="sheet-title">Cari</h2><div id="search-container"></div><div style="margin-top:16px"><button class="btn btn-secondary" data-close>Tutup</button></div></div>`;

  document.body.append(scrim, sheet);
  sheet.classList.add("open");

  const searchContainer = sheet.querySelector("#search-container");
  const searchUI = createSearchUI(searchContainer, {
    onResultClick: ({ id, type }) => {
      sheet.remove();
      scrim.remove();
      if (type === "habit") location.hash = `#/habit/${id}`;
      else if (type === "uang") location.hash = `#/uang/${id}`;
      else if (type === "budget") location.hash = `#/uang?cat=${encodeURIComponent(id)}`;
      else location.hash = `#/pengaturan`;
    }
  });

  function close() {
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 250);
  }

  scrim.addEventListener("click", close);
  sheet.querySelector("[data-close]")?.addEventListener("click", close);
  makeSheetDraggable(sheet, scrim, { onDismiss: close });

  setTimeout(() => searchUI.focus(), 100);
}

// Habit sheet add
function showAddHabitSheet(onCreated) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sheet = document.createElement("div");
  sheet.className = "pwa-sheet sheet-bottom";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Tambah Habit</h2>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
        <input id="habit-title" placeholder="Judul habit, mis. Minum air" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" />
        <select id="habit-type" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px">
          <option value="check">Check</option>
          <option value="count">Count</option>
          <option value="duration">Durasi</option>
        </select>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" data-close>Batal</button>
          <button class="btn btn-primary" data-save>Simpan</button>
        </div>
        <div style="margin-top:12px">
          <p style="font-size:12px;font-weight:500">Template cepat:</p>
          <div id="habit-templates" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
        </div>
      </div>
    </div>
  `;
  document.body.append(scrim, sheet);
  sheet.classList.add("open");

  const templatesEl = sheet.querySelector("#habit-templates");
  getTemplates().forEach((t) => {
    const b = document.createElement("button");
    b.className = "btn btn-secondary btn-small";
    b.textContent = t.title;
    b.addEventListener("click", () => {
      sheet.querySelector("#habit-title").value = t.title;
      sheet.querySelector("#habit-type").value = t.goal_type;
    });
    templatesEl.appendChild(b);
  });

  function close() {
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 250);
  }

  scrim.addEventListener("click", close);
  sheet.querySelector("[data-close]")?.addEventListener("click", close);
  sheet.querySelector("[data-save]")?.addEventListener("click", async () => {
    const title = sheet.querySelector("#habit-title").value.trim();
    const type = sheet.querySelector("#habit-type").value;
    if (!title) { alert("Judul wajib"); return; }
    const habit = await createHabit({ title, goal_type: type });
    close();
    if (onCreated) onCreated(habit);
  });

  makeSheetDraggable(sheet, scrim, { onDismiss: close });
  setTimeout(() => sheet.querySelector("#habit-title")?.focus(), 100);
}

// Transaction add sheet
function showAddTransactionSheet(onCreated) {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sheet = document.createElement("div");
  sheet.className = "pwa-sheet sheet-bottom";
  sheet.setAttribute("role", "dialog");
  sheet.innerHTML = `
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Catat Transaksi</h2>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
        <select id="tx-kind" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px">
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
          <option value="transfer">Transfer</option>
        </select>
        <input id="tx-amount" type="number" placeholder="Nominal Rp" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" />
        <input id="tx-category" placeholder="Kategori, mis. Kopi" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" />
        <input id="tx-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" />
        <input id="tx-note" placeholder="Catatan (opsional)" style="height:48px;border-radius:12px;border:1px solid #E0E0E0;padding:0 12px" />
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" data-close>Batal</button>
          <button class="btn btn-primary" data-save>Simpan</button>
        </div>
      </div>
    </div>
  `;
  document.body.append(scrim, sheet);
  sheet.classList.add("open");

  function close() {
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 250);
  }

  scrim.addEventListener("click", close);
  sheet.querySelector("[data-close]")?.addEventListener("click", close);
  sheet.querySelector("[data-save]")?.addEventListener("click", async () => {
    const kind = sheet.querySelector("#tx-kind").value;
    const amount = sheet.querySelector("#tx-amount").value;
    const category = sheet.querySelector("#tx-category").value.trim() || "Lainnya";
    const date = sheet.querySelector("#tx-date").value;
    const note = sheet.querySelector("#tx-note").value.trim();
    if (!amount || parseInt(amount) <= 0) { alert("Nominal harus >0"); return; }
    const tx = await createTransaction({ kind, amount, category, date, note });
    close();
    if (onCreated) onCreated(tx);
  });

  makeSheetDraggable(sheet, scrim, { onDismiss: close });
}

// Views
export function Beranda(root) {
  shell(root, "HabitWealth", async (container) => {
    const range = getRange();
    const info = document.createElement("p");
    info.className = "placeholder";
    info.style.marginBottom = "16px";
    info.textContent = `Ringkasan ${formatRangeLabel(range)} • ${range.tz} — offline-ready, data terakhir tetap tampil.`;
    container.appendChild(info);

    // Perf + Net adaptive info
    const adaptive = getAdaptiveTier();
    const perf = getPerfMetrics();
    const budgets = checkBudgets();
    const meta = document.createElement("div");
    meta.style.fontSize = "11px";
    meta.style.color = "#999";
    meta.style.marginBottom = "12px";
    meta.textContent = `Tier: ${adaptive.tier} • Mem: ${adaptive.memory}GB • Conc: ${adaptive.concurrency} • LCP: ${perf.lcp?.value?.toFixed(0) || "-"}ms ${budgets.lcp?.pass === false ? "⚠️" : ""} • CLS: ${perf.cls?.value?.toFixed(3) || "-"} ${budgets.cls?.pass === false ? "⚠️" : ""}`;
    container.appendChild(meta);

    // Ring progress + streak
    const ringWrap = document.createElement("div");
    ringWrap.style.display = "flex";
    ringWrap.style.gap = "16px";
    ringWrap.style.justifyContent = "center";
    ringWrap.style.marginBottom = "16px";

    const ringContainer = document.createElement("div");
    const streakContainer = document.createElement("div");
    ringWrap.append(ringContainer, streakContainer);
    container.appendChild(ringWrap);

    // Load habits for ring
    const habits = await listHabits().catch(() => []);
    const doneCount = habits.filter((h) => h.streak > 0).length;
    const percent = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;
    renderRingProgress(ringContainer, percent, { srLabel: `${doneCount} dari ${habits.length} habit selesai` });
    renderStreakDots(streakContainer, habits.reduce((a, h) => a + (h.streak || 0), 0) % 30, 30);

    // Charts placeholders
    const barContainer = document.createElement("div");
    barContainer.style.height = "200px";
    barContainer.style.background = "var(--surface)";
    barContainer.style.borderRadius = "16px";
    barContainer.style.marginBottom = "12px";
    barContainer.innerHTML = `<div class="skeleton skeleton-card" style="height:200px"></div>`;
    container.appendChild(barContainer);

    const donutContainer = document.createElement("div");
    donutContainer.style.height = "240px";
    donutContainer.style.background = "var(--surface)";
    donutContainer.style.borderRadius = "16px";
    donutContainer.style.marginBottom = "12px";
    donutContainer.innerHTML = `<div class="skeleton skeleton-card" style="height:240px"></div>`;
    container.appendChild(donutContainer);

    // Load data for charts via API + IDB
    try {
      const txs = await listTransactions({ from: range.from, to: range.to }).catch(() => []);
      const byCat = {};
      for (const tx of txs) {
        if (tx.kind === "expense") byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount;
      }
      const catData = Object.entries(byCat).map(([k, v]) => ({ key: k, total: v }));

      // Clear skeletons
      barContainer.innerHTML = "";
      donutContainer.innerHTML = "";

      // Render charts (lazy ECharts)
      const habitEntries = []; // mock 7 days
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0,10);
        habitEntries.push({ date: dateStr.slice(5), done: Math.floor(Math.random()*3) });
      }

      renderHabitBar(barContainer, habitEntries, { reduceMotion: false }).catch(()=>{});
      renderDonutCategory(donutContainer, catData, { reduceMotion: false }).catch(()=>{});

      // Dashboard summary via API (AUD-API-01)
      const summary = await api.get(`/dashboard/summary?from=${range.from || ""}&to=${range.to || ""}&tz=${range.tz}`).catch(() => null);
      if (summary && summary.ok) {
        const sumInfo = document.createElement("p");
        sumInfo.className = "placeholder";
        sumInfo.style.fontSize = "12px";
        sumInfo.textContent = `API summary: ${summary.data.habits.done}/${summary.data.habits.total} habit, in ${summary.data.cashflow.in} out ${summary.data.cashflow.out}`;
        container.appendChild(sumInfo);
      }
    } catch (e) {
      console.warn("[beranda] charts failed", e);
      barContainer.innerHTML = `<p class="placeholder">Gagal memuat chart</p>`;
      donutContainer.innerHTML = `<p class="placeholder">Gagal memuat chart</p>`;
    }

    // Action buttons: share streak, speak summary, print
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    actions.style.marginTop = "16px";

    const shareBtn = document.createElement("button");
    shareBtn.className = "btn btn-secondary btn-small";
    shareBtn.textContent = "Bagikan Streak";
    shareBtn.addEventListener("click", () => {
      const streak = habits.reduce((a, h) => a + (h.streak || 0), 0);
      shareStreakCard({ streakDays: streak }).catch(()=>{});
    });

    const speakBtn = document.createElement("button");
    speakBtn.className = "btn btn-secondary btn-small";
    speakBtn.textContent = "Bacakan Ringkasan";
    speakBtn.addEventListener("click", () => {
      const text = `Ringkasan ${formatRangeLabel(range)}: ${habits.length} habit, ${percent} persen selesai.`;
      speak(text, { lang: "id-ID" });
    });

    const printBtn = document.createElement("button");
    printBtn.className = "btn btn-secondary btn-small";
    printBtn.textContent = "Cetak";
    printBtn.addEventListener("click", () => printReport());

    actions.append(shareBtn, speakBtn, printBtn);
    container.appendChild(actions);
  }, { showRange: true, showSearch: true, collapsible: true });
}

export function Habit(root, ctx = {}) {
  if (ctx.params && ctx.params.id) {
    shell(root, `Habit #${ctx.params.id}`, (c) => {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = `Detail habit ${ctx.params.id} — histori, edit, pause/archive/delete confirm destruktif. Back slide-down.`;
      c.appendChild(p);

      const backBtn = document.createElement("button");
      backBtn.className = "btn btn-secondary";
      backBtn.textContent = "Kembali";
      backBtn.style.marginTop = "16px";
      backBtn.addEventListener("click", () => {
        const page = root.querySelector(".page");
        if (page && !prefersReducedMotion()) {
          page.classList.add("nav-back-exit");
          setTimeout(() => (location.hash = "#/habit"), 200);
        } else {
          location.hash = "#/habit";
        }
      });
      c.appendChild(backBtn);
    }, { collapsible: false });
    return;
  }

  shell(root, "Habit", async (container) => {
    // Skeleton first
    const list = document.createElement("div");
    list.className = "habit-list";
    for (let i = 0; i < 3; i++) {
      const sk = document.createElement("div");
      sk.className = "skeleton skeleton-card";
      list.appendChild(sk);
    }
    container.appendChild(list);

    const habits = await listHabits().catch(() => []);

    // Replace skeleton with real
    list.innerHTML = "";
    if (!habits.length) {
      const empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = "Belum ada habit. Coba template di bawah.";
      list.appendChild(empty);

      const tplWrap = document.createElement("div");
      tplWrap.style.display = "flex";
      tplWrap.style.gap = "8px";
      tplWrap.style.flexWrap = "wrap";
      tplWrap.style.marginTop = "12px";
      getTemplates().forEach((t) => {
        const b = document.createElement("button");
        b.className = "btn btn-secondary btn-small";
        b.textContent = t.title;
        b.addEventListener("click", async () => {
          await createHabit(t);
          location.reload();
        });
        tplWrap.appendChild(b);
      });
      list.appendChild(tplWrap);
    } else {
      habits.forEach((h) => {
        const card = document.createElement("div");
        card.className = "habit-card";
        card.innerHTML = `<div class="check" style="background:${h.streak>0?'#0381FE':'transparent'}"></div><div class="info"><div class="title">${h.title}</div><div class="subtitle">Streak ${h.streak||0} hari • ${h.category}</div></div><button class="btn btn-secondary btn-small">✓</button>`;
        const checkBtn = card.querySelector("button");
        checkBtn.addEventListener("click", async () => {
          const today = new Date().toISOString().slice(0,10);
          await completeHabit(h.id, today);
          feedbackHabitComplete();
          card.querySelector(".check").style.background = "#0381FE";
          checkBtn.textContent = "Batal";
          checkBtn.onclick = async () => {
            await undoComplete(h.id, today);
            card.querySelector(".check").style.background = "transparent";
            checkBtn.textContent = "✓";
          };
        });
        card.addEventListener("click", (e) => {
          if (e.target === checkBtn) return;
          location.hash = `#/habit/${h.id}`;
        });
        list.appendChild(card);
      });
    }

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "+ Tambah Habit";
    addBtn.style.marginTop = "16px";
    addBtn.style.width = "100%";
    addBtn.addEventListener("click", () => {
      showAddHabitSheet(() => location.reload());
    });
    container.appendChild(addBtn);
  }, { showRange: true, showSearch: true, collapsible: true });
}

export function Uang(root, ctx = {}) {
  if (ctx.params && ctx.params.id) {
    shell(root, `Transaksi #${ctx.params.id}`, `Detail transaksi ${ctx.params.id} — rekategori, split, refund.`, { showRange: true });
    return;
  }

  shell(root, "Uang", async (container) => {
    checkReAuthFromStorage();

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.justifyContent = "space-between";
    topRow.style.alignItems = "center";
    topRow.style.marginBottom = "12px";

    const balanceLabel = document.createElement("div");
    balanceLabel.style.fontSize = "14px";
    const updateBalance = () => {
      const display = getDisplayAmount(1250000);
      balanceLabel.innerHTML = `Saldo: <strong>${display}</strong> <button class="btn btn-flat btn-small" id="eye-btn">${isReAuthed() ? "🙈" : "👁️"}</button>`;
      const eyeBtn = balanceLabel.querySelector("#eye-btn");
      eyeBtn?.addEventListener("click", async () => {
        if (isReAuthed()) {
          // clear re-auth? For demo, just keep
          alert("Saldo dimasking lagi (session habis 5 menit)");
          localStorage.removeItem("hw:re-auth:expires");
          location.reload();
        } else {
          const ok = await requestReAuth();
          if (ok) {
            alert("Re-auth berhasil 5 menit");
            location.reload();
          }
        }
      });
    };
    updateBalance();
    topRow.appendChild(balanceLabel);

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary btn-small";
    addBtn.textContent = "+ Catat";
    addBtn.addEventListener("click", () => {
      showAddTransactionSheet(() => location.reload());
    });
    topRow.appendChild(addBtn);

    container.appendChild(topRow);

    // Budget status
    const budgetWrap = document.createElement("div");
    budgetWrap.style.marginBottom = "16px";
    budgetWrap.innerHTML = `<div class="skeleton skeleton-card" style="height:88px"></div>`;
    container.appendChild(budgetWrap);

    try {
      const month = new Date().toISOString().slice(0,7);
      const status = await getBudgetStatus(month).catch(() => []);
      budgetWrap.innerHTML = "";
      if (!status.length) {
        budgetWrap.innerHTML = `<p class="placeholder" style="font-size:12px">Belum ada budget bulan ${month}</p>`;
      } else {
        status.forEach((b) => {
          const div = document.createElement("div");
          div.style.background = "var(--surface)";
          div.style.borderRadius = "16px";
          div.style.padding = "12px";
          div.style.marginBottom = "8px";
          div.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="font-size:14px">${b.category}</span><span style="font-size:12px">${b.pct}%</span></div><div style="height:8px;background:#EEEEEE;border-radius:4px;margin-top:8px;overflow:hidden"><div style="width:${Math.min(100,b.pct)}%;height:100%;background:${b.status==='over'?'#D93B30':b.status==='warning'?'#E89500':'#0AA64E'}"></div></div><div style="font-size:11px;color:#999;margin-top:4px">${getDisplayAmount(b.spent)} / ${getDisplayAmount(b.limit)}</div>`;
          budgetWrap.appendChild(div);
        });
      }
    } catch {
      budgetWrap.innerHTML = `<p class="placeholder">Gagal budget</p>`;
    }

    // Transaction feed
    const feed = document.createElement("div");
    feed.style.display = "flex";
    feed.style.flexDirection = "column";
    feed.style.gap = "8px";
    feed.innerHTML = `<div class="skeleton skeleton-list"></div><div class="skeleton skeleton-list"></div>`;
    container.appendChild(feed);

    const txs = await listTransactions({ from: getRange().from, to: getRange().to }).catch(() => []);

    feed.innerHTML = "";
    if (!txs.length) {
      feed.innerHTML = `<p class="placeholder">Tidak ada transaksi ${getRange().from ? `${getRange().from}–${getRange().to}` : ""} <button class="btn btn-flat btn-small" onclick="location.hash='#/uang?preset=month'">Kembali ke Bulan ini</button></p>`;
    } else {
      txs.slice(0,20).forEach((tx) => {
        const div = document.createElement("div");
        div.style.background = "var(--surface)";
        div.style.borderRadius = "12px";
        div.style.padding = "12px";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.innerHTML = `<div><div style="font-size:14px">${tx.category} • ${tx.kind}</div><div style="font-size:11px;color:#999">${tx.date} • ${tx.account_ref}</div></div><div style="font-size:14px;font-weight:500">${getDisplayAmount(tx.amount)}</div>`;
        div.addEventListener("click", () => location.hash = `#/uang/${tx.id}`);
        feed.appendChild(div);
      });
    }

    // Chart
    const donutContainer = document.createElement("div");
    donutContainer.style.height = "240px";
    donutContainer.style.background = "var(--surface)";
    donutContainer.style.borderRadius = "16px";
    donutContainer.style.marginTop = "16px";
    container.appendChild(donutContainer);

    try {
      const byCat = {};
      for (const tx of txs) if (tx.kind === "expense") byCat[tx.category] = (byCat[tx.category]||0)+tx.amount;
      const catData = Object.entries(byCat).map(([k,v])=>({key:k,total:v}));
      renderDonutCategory(donutContainer, catData, {}).catch(()=>{});
    } catch {}
  }, { showRange: true, showSearch: true });
}

export function Pengaturan(root) {
  shell(root, "Pengaturan", async (container) => {
    const settings = await getSettings().catch(() => ({}));

    const sections = [
      { title: "Tampilan", items: [
        { label: `Tema: ${settings.theme || "system"}`, action: async () => {
          const sel = document.createElement("div");
          sel.style.display = "flex"; sel.style.gap = "8px"; sel.style.marginTop = "8px";
          ["system","light","dark"].forEach((th)=>{
            const b=document.createElement("button"); b.className="btn btn-secondary btn-small"; b.textContent=th;
            b.addEventListener("click",()=>{ setTheme(th); alert(`Tema ${th}`); });
            sel.appendChild(b);
          });
          container.appendChild(sel);
        }},
        { label: `Haptics: ${settings.feedback?.haptics ? "ON" : "OFF"}`, action: async () => { await updateSetting("feedback.haptics", !settings.feedback?.haptics); alert("Haptics toggled"); location.reload(); }},
        { label: `Sound: ${settings.feedback?.sound ? "ON" : "OFF"} (default OFF)`, action: async () => { await updateSetting("feedback.sound", !settings.feedback?.sound); alert("Sound toggled"); }},
      ]},
      { title: "Data & Privasi", items: [
        { label: "Export Data (butuh re-auth)", action: async () => {
          try { const res = await requestExport("all"); alert(`Export ${res.id} status ${res.status}`); }
          catch(e){ if(String(e).includes("RE_AUTH")){ if(await requestReAuth()){ const res=await requestExport("all"); alert(`Export ${res.id}`);} } else alert(e); }
        }},
        { label: "Hapus Akun (confirm destruktif + re-auth)", action: async () => {
          if(!confirm("Yakin hapus akun? Tindakan permanen!")) return;
          try { const res=await requestDeleteAccount("user request"); alert(`Delete request ${res.id} pending`); }
          catch(e){ if(String(e).includes("RE_AUTH")){ if(await requestReAuth()){ const res=await requestDeleteAccount("user request"); alert(`Delete ${res.id}`);} } else alert(e); }
        }},
        { label: "Wipe Lokal (IDB clear)", action: async () => {
          if(!confirm("Hapus semua data lokal?")) return;
          try { await requestReAuth(); const { wipeAllData } = await import("./settings.js"); await wipeAllData(); alert("Data lokal dihapus"); location.reload(); } catch(e){ alert(e); }
        }},
      ]},
      { title: "Bantuan", items: [
        { label: "FAQ", action: () => {
          const faq = getFAQ();
          const list = document.createElement("div");
          list.style.marginTop = "8px";
          faq.forEach((f)=>{
            const div=document.createElement("div");
            div.style.background="var(--surface)"; div.style.borderRadius="12px"; div.style.padding="12px"; div.style.marginBottom="8px";
            div.innerHTML=`<div style="font-weight:500;font-size:14px">${f.q}</div><div style="font-size:12px;color:#666;margin-top:4px">${f.a}</div>`;
            list.appendChild(div);
          });
          container.appendChild(list);
        }},
        { label: "Cetak Laporan (print CSS masked)", action: () => printReport() },
        { label: "Bagikan Streak", action: async () => { const { shareStreakCard } = await import("./share.js"); shareStreakCard({streakDays:7}); }},
        { label: "Salin Referral", action: async () => { await copyToClipboard("REF123"); alert("Referral disalin"); }},
        { label: "Bacakan FAQ", action: async () => { const faq=getFAQ(); const text=faq.map(f=>f.q+" "+f.a).join(". "); speak(text, {lang:"id-ID"}); }},
        { label: "Hentikan Bacaan", action: () => cancelSpeak() },
      ]},
      { title: "Tentang", items: [
        { label: `Versi: ${settings.v||2} • PWA ${isStandalone()?"standalone":"browser"}`, action: ()=>{} },
        { label: "Pasang Aplikasi", action: ()=>{ if(isStandalone()) alert("Sudah standalone"); else showInstallSheet(); }},
        { label: "Cek Perf LCP/CLS", action: ()=>{ const m=getPerfMetrics(); const b=checkBudgets(); alert(`LCP ${m.lcp?.value||"-"}ms pass=${b.lcp?.pass} CLS ${m.cls?.value||"-"} pass=${b.cls?.pass}`); }},
        { label: "Tier Adaptive", action: ()=>{ const t=getAdaptiveTier(); alert(`Tier ${t.tier} mem ${t.memory}GB conc ${t.concurrency} net ${t.network.effectiveType}`); }},
      ]},
    ];

    sections.forEach((sec)=>{
      const h = document.createElement("h3");
      h.textContent = sec.title;
      h.style.fontSize = "14px";
      h.style.fontWeight = "600";
      h.style.margin = "16px 0 8px";
      h.style.color = "var(--primary)";
      container.appendChild(h);

      sec.items.forEach((it)=>{
        const row = document.createElement("div");
        row.style.background = "var(--surface)";
        row.style.borderRadius = "12px";
        row.style.padding = "12px 16px";
        row.style.marginBottom = "8px";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.innerHTML = `<span style="font-size:14px">${it.label}</span><span style="font-size:12px;color:#999">›</span>`;
        row.style.cursor = "pointer";
        row.addEventListener("click", it.action);
        container.appendChild(row);
      });
    });
  }, { collapsible: false });
}

export function NotFound(root) {
  shell(root, "Tidak ditemukan", "Halaman tidak ada. Kembali via tab di bawah.", { collapsible: false });
}
