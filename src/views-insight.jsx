// T11 — Insight deskriptif + Celengan virtual + StreakCelebration (#/insight) — spec 10 amandemen 19 Sep 2026, spec 02/05/09
// Token-only (class app.css/auth.css; bar = <progress>, tanpa inline style), tanpa alert/confirm (ui.js), non-color cues (ikon + teks),
// nominal dimasking via getDisplayAmount (re-auth), tanpa money movement — semua "tabung/tarik" hanya catatan lokal + outbox.

import { shell, el, btn, skeleton, goBack, withReAuth } from "./views.jsx";
import { showToast, openSheet, confirmSheet, infoSheet, switchRow } from "./ui.js";
import { formatRupiah, getDisplayAmount, checkReAuthFromStorage } from "./money.js";
import { track } from "./analytics.js";
import { vibrate } from "./feedback.js";
import { shareStreakCard } from "./share.js";
import {
  getInsightPrefs, setInsightPref, computeInsight, listGoals, createGoal, goalTotal, getRecordedBalance,
  allocateToday, undoAllocation, withdrawFromGoal, celebrationAllowed, markCelebrationShown, setCelebrationsNever, getGoalsTotal,
  GOAL_DEFAULT_DAILY, DEFAULT_SOURCE_REF, LEGAL_COPY, CORRELATION_COPY, MIN_DAYS_PER_SIDE, UNDO_WINDOW_MS, INSIGHT_WINDOW_DAYS,
} from "./insight.js";

const CONFIDENCE_COPY = { rendah: "rendah — belum ditampilkan", sedang: "sedang", cukup: "cukup" };

function hhmm(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

function field({ id, label, type = "text", value = "", help, required = false, inputmode }) {
  const wrap = el("div", "field");
  const lab = el("label", "", label);
  lab.htmlFor = id;
  const input = el("input", "field-input");
  input.id = id;
  input.type = type;
  input.value = value;
  if (required) input.required = true;
  if (inputmode) input.inputMode = inputmode;
  wrap.append(lab, input);
  if (help) {
    const h = el("div", "field-help", help);
    h.id = `${id}-help`;
    input.setAttribute("aria-describedby", h.id);
    wrap.appendChild(h);
  }
  const err = el("div", "field-error");
  err.id = `${id}-error`;
  err.setAttribute("role", "alert");
  err.hidden = true;
  wrap.appendChild(err);
  wrap._input = input;
  wrap._setError = (msg) => {
    err.textContent = msg ? `⚠️ ${msg}` : "";
    err.hidden = !msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  };
  return wrap;
}

function notice(tone, icon, title, text) {
  const n = el("div", "notice mt-8");
  n.dataset.tone = tone;
  n.setAttribute("role", "status");
  const ic = el("span", "notice-icon", icon);
  ic.setAttribute("aria-hidden", "true");
  const body = el("div", "notice-body");
  if (title) body.appendChild(el("div", "notice-title", title));
  body.appendChild(el("div", "", text));
  n.append(ic, body);
  return n;
}

// ---------- layar ----------
export function Insight(root, ctx = {}) {
  const rerender = () => {
    root.querySelectorAll(".page").forEach((p) => {
      try { p._cleanup && p._cleanup(); } catch {}
      p.remove();
    });
    Insight(root, ctx);
  };

  shell(root, "Insight & Celengan", async (c) => {
    c.appendChild(skeleton("card"));
    checkReAuthFromStorage();
    const prefs = await getInsightPrefs();
    c.innerHTML = "";

    const insightSection = el("section", "insight-section");
    insightSection.setAttribute("aria-labelledby", "insight-heading");
    insightSection.appendChild(el("h3", "settings-heading", "Insight"));
    insightSection.firstChild.id = "insight-heading";
    c.appendChild(insightSection);

    if (!prefs.optIn) renderSetup(insightSection, prefs, rerender);
    else await renderSummary(insightSection, prefs, rerender);

    const goalsSection = el("section", "goals-section");
    goalsSection.setAttribute("aria-labelledby", "goals-heading");
    c.appendChild(goalsSection);
    await renderGoals(goalsSection);

    c.appendChild(btn("Kembali", "btn btn-secondary btn-block mt-16", () => goBack(root, "#/beranda")));
  });
}

// InsightSetup — opt-in default OFF: tidak ada angka apa pun sebelum diaktifkan
function renderSetup(section, prefs, rerender) {
  const card = el("div", "card insight-setup");
  card.appendChild(el("div", "card-title", "Insight dihitung di perangkatmu"));
  card.appendChild(el("p", "card-sub", "Mati secara bawaan. Bila diaktifkan, HabitWealth membandingkan catatan habit dan pengeluaran manualmu — tanpa mengirim data mentah ke server."));
  const ul = el("ul", "insight-facts");
  [
    "Sumber: catatan habit + transaksi manual (bisa dimatikan per sumber di bawah).",
    `Narasi baru muncul bila ada ≥${MIN_DAYS_PER_SIDE} hari dengan habit dan ≥${MIN_DAYS_PER_SIDE} hari tanpa habit.`,
    CORRELATION_COPY,
    "Bisa dimatikan kapan saja lewat switch “Insight” di layar ini; angka tidak disimpan di server.",
  ].forEach((t) => ul.appendChild(el("li", "", t)));
  card.appendChild(ul);
  section.appendChild(card);

  section.appendChild(switchRow({
    id: "insight-src-habits", label: "Pakai catatan habit", desc: "Hari dengan ≥1 habit selesai.",
    checked: prefs.sources.habits, onChange: (v) => setInsightPref("sources.habits", v),
  }));
  section.appendChild(switchRow({
    id: "insight-src-tx", label: "Pakai transaksi manual", desc: "Pengeluaran yang kamu catat sendiri; hari tanpa catatan dihitung Rp0.",
    checked: prefs.sources.transactions, onChange: (v) => setInsightPref("sources.transactions", v),
  }));
  section.appendChild(switchRow({
    id: "insight-hide-sensitive", label: "Sembunyikan insight sensitif", desc: "Narasi hanya memakai persentase, tanpa nominal rupiah.",
    checked: prefs.hideSensitive, onChange: (v) => setInsightPref("hideSensitive", v),
  }));

  const activate = btn("Aktifkan insight", "btn btn-primary btn-block mt-8", async () => {
    activate.disabled = true;
    await setInsightPref("optIn", true);
    showToast("Insight aktif — dihitung di perangkat", { tone: "success" });
    rerender();
  });
  activate.id = "insight-activate";
  section.appendChild(activate);
}

// WeeklyMonthlySummary — narasi + confidence + "Kenapa" + bar mingguan + scatter (≥90 hari)
async function renderSummary(section, prefs, rerender) {
  section.appendChild(switchRow({
    id: "insight-optin", label: "Insight", desc: "Dihitung di perangkat. Matikan untuk kembali ke layar penjelasan.",
    checked: true,
    onChange: async (v) => {
      await setInsightPref("optIn", v);
      if (!v) { showToast("Insight dimatikan"); rerender(); }
    },
  }));

  const loading = skeleton("card");
  section.appendChild(loading);
  const data = await computeInsight();
  loading.remove();

  // Narasi
  const card = el("div", "card insight-narrative");
  card.appendChild(el("div", "card-title", `Ringkasan ${data.weekly.length} pekan • ${data.dataSpanDays} hari data`));
  if (data.narrative) {
    const p = el("p", "insight-text", data.narrative);
    p.id = "insight-narrative";
    card.appendChild(p);
    if (!data.hideSensitive) {
      card.appendChild(el("p", "card-sub", `Rata-rata per hari: ${getDisplayAmount(data.stats.avgWith)} (dengan habit) vs ${getDisplayAmount(data.stats.avgWithout)} (tanpa habit).`));
    }
  } else {
    card.appendChild(el("p", "empty-state", `Belum cukup data untuk narasi: butuh ≥${MIN_DAYS_PER_SIDE} hari dengan habit dan ≥${MIN_DAYS_PER_SIDE} hari tanpa habit (sekarang ${data.stats.n1} vs ${data.stats.n2}). Angka di bawah tetap deskriptif.`));
  }
  const conf = el("p", "status-line", `Keyakinan: ${CONFIDENCE_COPY[data.confidence] || data.confidence} • ${CORRELATION_COPY}`);
  conf.id = "insight-confidence";
  card.appendChild(conf);
  card.appendChild(btn("Kenapa saya melihat ini?", "btn btn-flat btn-small mt-8", () => infoSheet({
    title: "Kenapa saya melihat ini?",
    desc: [
      "Sumber: catatan habit (hari dengan ≥1 habit selesai) dan transaksi manual (pengeluaran yang kamu catat).",
      `Cara hitung: rata-rata pengeluaran harian pada hari dengan habit vs tanpa habit, ${INSIGHT_WINDOW_DAYS} hari terakhir, semuanya di perangkat ini.`,
      "Data hilang: hari tanpa catatan dihitung Rp0 — makin rajin mencatat, makin akurat.",
      `Keyakinan: rendah <${MIN_DAYS_PER_SIDE} hari per sisi (narasi disembunyikan), sedang <21, cukup ≥21.`,
      CORRELATION_COPY,
      "Matikan kapan saja lewat switch “Insight” di atas.",
    ].join(" "),
  })));
  section.appendChild(card);

  // Bar mingguan (CSS <progress>, token-only) + tabel alternatif SR
  const weekCard = el("div", "card insight-weekly");
  weekCard.appendChild(el("div", "card-title", "8 pekan terakhir"));
  weekCard.appendChild(el("p", "card-sub", "Habit selesai per pekan (✅) dan pengeluaran per pekan (💸)."));
  const maxHabit = Math.max(1, ...data.weekly.map((w) => w.habitDone));
  const maxExpense = Math.max(1, ...data.weekly.map((w) => w.expense));
  const list = el("div", "insight-bars");
  list.setAttribute("aria-hidden", "true");
  data.weekly.forEach((w) => {
    const row = el("div", "insight-bar-row");
    row.appendChild(el("span", "insight-bar-label", w.label));
    const b1 = el("progress", "insight-bar insight-bar-habit");
    b1.max = maxHabit;
    b1.value = w.habitDone;
    const b2 = el("progress", "insight-bar insight-bar-expense");
    b2.max = maxExpense;
    b2.value = w.expense;
    row.append(b1, b2);
    list.appendChild(row);
  });
  weekCard.appendChild(list);
  const table = el("table", "sr-only");
  const cap = el("caption", "", "Ringkasan mingguan: habit selesai dan pengeluaran per pekan");
  const thead = el("thead", "");
  const hr = el("tr", "");
  ["Pekan mulai", "Habit selesai", "Pengeluaran"].forEach((h) => hr.appendChild(el("th", "", h)));
  thead.appendChild(hr);
  const tbody = el("tbody", "");
  data.weekly.forEach((w) => {
    const tr = el("tr", "");
    tr.append(el("td", "", w.from), el("td", "", String(w.habitDone)), el("td", "", data.hideSensitive ? "disembunyikan" : getDisplayAmount(w.expense)));
    tbody.appendChild(tr);
  });
  table.append(cap, thead, tbody);
  weekCard.appendChild(table);
  section.appendChild(weekCard);

  // Scatter — hanya bila rentang ≥90 hari (ECharts lazy via charts.js)
  const scatterCard = el("div", "card insight-scatter");
  scatterCard.appendChild(el("div", "card-title", "Streak vs frekuensi pengeluaran (bulanan)"));
  scatterCard.appendChild(el("p", "card-sub", "Sumbu Y memakai jumlah transaksi pengeluaran per bulan sebagai proxy “impulsif” — bukan penilaian."));
  const scatterBox = el("div", "chart-card chart-240 mt-8");
  scatterCard.appendChild(scatterBox);
  if (data.scatter.ready) {
    import("./charts.js").then((m) => m.renderScatterIfNeeded(scatterBox, data.scatter.points)).catch(() => {
      scatterBox.appendChild(el("p", "placeholder", "Grafik tidak dapat dimuat."));
    });
  } else {
    scatterBox.appendChild(el("p", "placeholder", `Butuh ≥${data.scatter.minSpanDays} hari data dan ≥3 bulan (sekarang ${data.dataSpanDays} hari, ${data.scatter.points.length} bulan).`));
  }
  section.appendChild(scatterCard);

  track("insight_viewed", { period: "90d", has_scatter: data.scatter.ready, confidence: data.confidence }).catch(() => {});
}

// VirtualSavingsGoal + WithdrawFromGoal
async function renderGoals(section) {
  section.innerHTML = "";
  const h = el("h3", "settings-heading", "Celengan virtual");
  h.id = "goals-heading";
  section.appendChild(h);
  section.appendChild(el("p", "consent-legal goal-legal", LEGAL_COPY));

  const balance = await getRecordedBalance();
  const balLine = el("p", "status-line goal-balance", `Saldo tercatat (manual): ${getDisplayAmount(balance.available)}${balance.goals > 0 ? ` • di celengan: ${getDisplayAmount(balance.goals)}` : ""}`);
  section.appendChild(balLine);

  const goals = await listGoals();
  if (!goals.length) {
    section.appendChild(el("p", "empty-state", `Belum ada celengan. Mulai dari ${formatRupiah(GOAL_DEFAULT_DAILY)}/hari — hanya catatan, uang tetap di rekeningmu.`));
  }
  goals.forEach((g) => section.appendChild(goalCard(g, () => renderGoals(section))));

  section.appendChild(btn("+ Buat celengan", "btn btn-secondary btn-block mt-8", () => showCreateGoalSheet(() => renderGoals(section))));
}

function goalCard(goal, refresh) {
  const card = el("div", "card goal-card");
  card.dataset.goalId = goal.id;
  const head = el("div", "row-between");
  head.appendChild(el("div", "card-title", `🐷 ${goal.name}`));
  const status = el("span", "inbox-chip goal-status", goal.status === "completed" ? "🎯 Target tercapai" : goal.status === "paused" ? "⏸ Jeda" : "Aktif");
  head.appendChild(status);
  card.appendChild(head);
  card.appendChild(el("div", "card-sub", `${formatRupiah(goal.daily_amount)}/hari • ${goal.source_ref}`));

  const total = goalTotal(goal);
  const totalLine = el("p", "goal-total", `Terkumpul: ${getDisplayAmount(total)}${goal.target_amount ? ` dari ${getDisplayAmount(goal.target_amount)}` : ""}`);
  card.appendChild(totalLine);
  if (goal.target_amount) {
    const prog = el("progress", "goal-progress");
    prog.max = goal.target_amount;
    prog.value = Math.min(total, goal.target_amount);
    prog.setAttribute("aria-label", `Progres target ${Math.min(100, Math.round((total / goal.target_amount) * 100))}%`);
    card.appendChild(prog);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayEntry = (goal.ledger || []).find((e) => e.kind === "allocate" && e.date === todayStr && e.status !== "undone");
  const statusLine = el("p", "status-line goal-today");
  statusLine.setAttribute("role", "status");
  if (todayEntry) statusLine.textContent = `Berhasil ✓ ${hhmm(todayEntry.done_at || todayEntry.at)} — ${formatRupiah(todayEntry.amount)} hari ini`;
  card.appendChild(statusLine);

  const row = el("div", "btn-row wrap mt-8");
  const save = btn(todayEntry ? "Sudah ditabung hari ini ✓" : "Tabung hari ini", "btn btn-primary btn-small goal-allocate");
  if (todayEntry || goal.status !== "active") save.disabled = true;
  save.addEventListener("click", async () => {
    save.disabled = true;
    const label = save.textContent;
    save.textContent = "Diproses…";
    statusLine.textContent = "Diproses…";
    const r = await allocateToday(goal.id);
    if (!r.ok) {
      save.disabled = false;
      save.textContent = label;
      statusLine.textContent = "";
      if (r.reason === "INSUFFICIENT") {
        card.querySelectorAll(".notice").forEach((n) => n.remove());
        card.appendChild(notice("warning", "ℹ️", "Belum bisa menabung hari ini", `${r.message} Catat pemasukan di tab Uang bila saldo tercatatmu belum lengkap.`));
      } else if (r.reason === "ALREADY_TODAY") {
        showToast("Sudah ditabung hari ini ✓");
        refresh();
      } else {
        showToast("Gagal mencatat. Coba lagi.", { tone: "warning" });
      }
      return;
    }
    save.textContent = "Sudah ditabung hari ini ✓";
    statusLine.textContent = `Berhasil ✓ ${hhmm(r.entry.done_at)} — ${formatRupiah(r.entry.amount)} hari ini`;
    totalLine.textContent = `Terkumpul: ${getDisplayAmount(goalTotal(r.goal))}${goal.target_amount ? ` dari ${getDisplayAmount(goal.target_amount)}` : ""}`;
    showToast(`${formatRupiah(r.entry.amount)} masuk celengan ✓`, {
      duration: UNDO_WINDOW_MS,
      tone: "success",
      actionLabel: "Batalkan",
      onAction: async () => {
        const u = await undoAllocation(goal.id, r.entry.id);
        if (u.ok) showToast("Tabungan hari ini dibatalkan");
        else if (u.reason === "UNDO_EXPIRED") showToast("Waktu batal (5 detik) habis — gunakan Tarik.", { tone: "warning" });
        else showToast("Tidak bisa dibatalkan.", { tone: "warning" });
        refresh();
      },
    });
    if (r.completed) {
      vibrate("success").catch(() => {});
      status.textContent = "🎯 Target tercapai";
    }
    setTimeout(() => refresh(), UNDO_WINDOW_MS + 500);
  });
  row.appendChild(save);

  if (total > 0) {
    const wd = btn("Tarik", "btn btn-secondary btn-small goal-withdraw", () => showWithdrawSheet(goal, refresh));
    row.appendChild(wd);
  }
  card.appendChild(row);
  return card;
}

function showCreateGoalSheet(onDone) {
  const name = field({ id: "goal-name", label: "Nama celengan", value: "", required: true, help: "Contoh: Dana darurat, Liburan." });
  const daily = field({ id: "goal-daily", label: "Nominal harian (Rp)", type: "number", value: String(GOAL_DEFAULT_DAILY), inputmode: "numeric", help: `Bawaan ${formatRupiah(GOAL_DEFAULT_DAILY)} — bisa diubah.` });
  const target = field({ id: "goal-target", label: "Target (Rp, opsional)", type: "number", value: "", inputmode: "numeric" });
  const source = field({ id: "goal-source", label: "Sumber (label rekening)", value: DEFAULT_SOURCE_REF, help: "Hanya label. Tidak ada koneksi bank." });
  openSheet({
    id: "goal-create-sheet",
    title: "Buat celengan",
    desc: LEGAL_COPY,
    tall: true,
    build: (body) => {
      const form = el("div", "form-stack");
      form.append(name, daily, target, source);
      body.appendChild(form);
    },
    actions: [
      { label: "Batal", kind: "flat" },
      {
        label: "Simpan",
        kind: "primary",
        onClick: async () => {
          name._setError("");
          daily._setError("");
          target._setError("");
          const r = await createGoal({ name: name._input.value, daily_amount: daily._input.value, target_amount: target._input.value, source_ref: source._input.value });
          if (!r.ok) {
            if (r.reason === "NAME_REQUIRED") { name._setError("Nama wajib diisi."); name._input.focus(); }
            else if (r.reason === "DAILY_INVALID") { daily._setError("Minimal Rp1."); daily._input.focus(); }
            else if (r.reason === "TARGET_INVALID") { target._setError("Target harus ≥ nominal harian, atau kosongkan."); target._input.focus(); }
            else showToast("Gagal menyimpan.", { tone: "warning" });
            return false;
          }
          showToast(`Celengan “${r.goal.name}” dibuat ✓`, { tone: "success" });
          onDone && onDone(r.goal);
        },
      },
    ],
  });
}

function showWithdrawSheet(goal, refresh) {
  const total = goalTotal(goal);
  const amount = field({ id: "goal-withdraw-amount", label: "Jumlah (Rp)", type: "number", value: String(total), inputmode: "numeric", help: `Maksimal ${getDisplayAmount(total)}. Ini hanya mengubah catatan celengan.` });
  openSheet({
    id: "goal-withdraw-sheet",
    title: "Tarik dari celengan?",
    desc: `${LEGAL_COPY} Butuh verifikasi ulang (sesi 5 menit).`,
    build: (body) => body.appendChild(amount),
    actions: [
      { label: "Batal", kind: "flat", autofocus: true },
      {
        label: "Tarik",
        kind: "primary",
        onClick: async ({ close }) => {
          amount._setError("");
          const amt = parseInt(amount._input.value, 10);
          if (!Number.isFinite(amt) || amt < 1) { amount._setError("Masukkan jumlah ≥ Rp1."); return false; }
          if (amt > total) { amount._setError("Melebihi total celengan."); return false; }
          close("action");
          const ok = await confirmSheet({ title: "Konfirmasi tarik", desc: `Catatan celengan “${goal.name}” akan dikurangi ${formatRupiah(amt)}. Tidak ada uang yang dipindahkan.`, confirmLabel: "Ya, tarik", cancelLabel: "Batal" });
          if (!ok) return;
          const r = await withReAuth(() => withdrawFromGoal(goal.id, amt), { reason: "Menarik catatan celengan termasuk aksi sensitif." });
          if (!r) return;
          if (!r.ok) {
            showToast(r.reason === "RE_AUTH_REQUIRED" ? "Verifikasi ulang diperlukan." : "Gagal mencatat penarikan.", { tone: "warning" });
            return;
          }
          showToast(`Catatan celengan diperbarui: −${formatRupiah(amt)}`, { tone: "success" });
          refresh();
        },
      },
    ],
  });
}

// ---------- StreakCelebration (7/30/100; 1× per habit per milestone; bisa dimatikan) ----------
export async function maybeCelebrate({ habitId, streak, habitTitle }) {
  if (!(await celebrationAllowed(habitId, streak))) return false;
  await markCelebrationShown(habitId, streak);
  const goals = await listGoals().catch(() => []);
  const goalsTotal = goals.length ? await getGoalsTotal().catch(() => 0) : 0;
  showCelebration({ streak, habitTitle, hasGoals: goals.length > 0, goalsTotal });
  return true;
}

export function showCelebration({ streak, habitTitle = "Habit", hasGoals = false, goalsTotal = 0 }) {
  vibrate("success").catch(() => {}); // sekali; haptic dilewati bila reduced-motion (feedback.js)
  let tracked = false;
  const dismissed = (never) => {
    if (tracked) return;
    tracked = true;
    track("celebration_dismissed", { streak_day: streak, never_again: !!never }).catch(() => {});
  };
  return openSheet({
    id: "celebrate-sheet",
    title: `${streak} hari berturut-turut! 🎉`,
    build: (body) => {
      const wrap = el("div", "celebrate");
      const ring = el("div", "celebrate-ring", "🔥");
      ring.setAttribute("aria-hidden", "true");
      wrap.appendChild(ring);
      wrap.appendChild(el("p", "celebrate-text", `“${habitTitle}” konsisten ${streak} hari. Konsistensi kecil, dampak besar.`));
      if (hasGoals) wrap.appendChild(el("p", "celebrate-goal", `Celengan virtualmu: ${getDisplayAmount(goalsTotal)}`));
      body.appendChild(wrap);
    },
    actions: [
      {
        label: "Jangan tampilkan lagi",
        kind: "flat",
        onClick: async () => {
          await setCelebrationsNever(true);
          dismissed(true);
          showToast("Perayaan streak dimatikan (Pengaturan › Insight)");
        },
      },
      {
        label: "Bagikan",
        kind: "secondary",
        onClick: async () => {
          const r = await shareStreakCard({ streakDays: streak }).catch(() => ({ shared: false }));
          if (r && r.shared) track("celebration_shared", { streak_day: streak }).catch(() => {});
          return false; // sheet tetap terbuka
        },
      },
      { label: "Tutup", kind: "primary", autofocus: true, onClick: () => dismissed(false) },
    ],
    onClose: () => dismissed(false),
  });
}
