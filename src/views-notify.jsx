// T12 — NotificationPreferences (#/pengaturan/notifikasi) + NotificationInbox (#/notifikasi) — spec 11 amandemen, spec 02
// Token-only (class app.css), tanpa alert/confirm, tanpa dialog sistem tanpa primer, non-color cues (ikon + teks), 48dp target.

import { shell, el, btn, skeleton, goBack, formatDateId } from "./views.jsx";
import { showToast, confirmSheet, infoSheet } from "./ui.js";
import { makeListSwipeable } from "./gestures.js";
import { queryPermission, shouldShowPrimer } from "./permissions.js";
import { showPermissionPrimer } from "./views-auth.jsx";
import { requestNotificationPermissionContextual } from "./notifications.js";
import { getNotifPrefs, setNotifPref, partitionInbox, markRead, archive, markAllRead, notify, deviceTZ, CATEGORY_COPY, PRIORITY } from "./notify.js";

const CATEGORY_ORDER = ["habit", "budget", "streak", "weekly", "promo", "system"];
const CATEGORY_ICON = { habit: "✅", budget: "💸", streak: "🔥", weekly: "📊", promo: "📣", system: "🛡️" };

function switchRow({ id, label, desc, checked, disabled = false, note, onChange }) {
  const row = el("div", "consent-card notif-row");
  const text = el("div", "consent-text");
  const lab = el("label", "consent-title", label);
  lab.htmlFor = id;
  text.appendChild(lab);
  if (desc) text.appendChild(el("div", "consent-desc", desc));
  if (note) {
    const n = el("div", "status-line mt-8", note);
    text.appendChild(n);
  }
  const sw = el("button", "switch");
  sw.type = "button";
  sw.id = id;
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(!!checked));
  sw.setAttribute("aria-label", label);
  if (disabled) {
    sw.setAttribute("aria-disabled", "true");
    sw.disabled = true;
  }
  const knob = el("span", "switch-knob");
  knob.setAttribute("aria-hidden", "true");
  sw.appendChild(knob);
  sw.addEventListener("click", async () => {
    if (disabled) return;
    const next = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(next));
    try {
      await onChange(next);
    } catch {
      sw.setAttribute("aria-checked", String(!next));
    }
  });
  row.append(text, sw);
  return row;
}

function timeLabel(hhmm) {
  return String(hhmm || "").replace(":", ".");
}

export function NotifPrefs(root, ctx = {}) {
  shell(root, "Notifikasi", async (c) => {
    c.appendChild(skeleton("card"));
    const prefs = await getNotifPrefs();
    const perm = await queryPermission("notifications").catch(() => ({ state: "unsupported" }));
    c.innerHTML = "";

    c.appendChild(el("p", "placeholder mb-12", "Kotak Masuk di aplikasi selalu menerima pengingat. Notifikasi sistem (layar kunci) hanya pelengkap saat izin diberikan — pengingat dievaluasi saat aplikasi dibuka atau berjalan di latar."));

    // Master
    c.appendChild(switchRow({
      id: "notif-master", label: "Notifikasi", desc: "Matikan untuk menghentikan semua pengingat, kecuali pemberitahuan keamanan/operasional.",
      checked: prefs.enabled,
      onChange: async (v) => { await setNotifPref("enabled", v); showToast(v ? "Notifikasi aktif" : "Notifikasi dimatikan (kecuali keamanan)"); },
    }));

    // Kategori
    c.appendChild(el("h3", "settings-heading", "Kategori"));
    CATEGORY_ORDER.forEach((key) => {
      const copy = CATEGORY_COPY[key];
      c.appendChild(switchRow({
        id: `notif-cat-${key}`,
        label: `${CATEGORY_ICON[key]} ${copy.label}`,
        desc: copy.desc,
        checked: key === "system" ? true : prefs.categories[key] !== false,
        disabled: key === "system",
        note: key === "promo" ? "Terpisah dari pengingat; mati secara bawaan." : undefined,
        onChange: async (v) => { await setNotifPref(`categories.${key}`, v); },
      }));
    });

    // Channel
    c.appendChild(el("h3", "settings-heading", "Saluran"));
    const pushState = perm.state; // granted | denied | prompt | unsupported
    const pushNote = pushState === "granted" ? "Izin sistem: diberikan ✓"
      : pushState === "denied" ? "Izin sistem diblokir — pengingat tetap masuk Kotak Masuk. Aktifkan lewat pengaturan situs/aplikasi di perangkat."
      : pushState === "unsupported" ? "Perangkat/browser ini tidak mendukung notifikasi sistem."
      : "Belum diizinkan — kami hanya bertanya saat kamu menekan tombol di bawah.";
    c.appendChild(switchRow({
      id: "notif-ch-push", label: "🔔 Notifikasi sistem (layar kunci)", desc: "Tanpa nominal atau judul habit di layar kunci.",
      checked: prefs.channels.push, disabled: pushState === "unsupported", note: pushNote,
      onChange: async (v) => { await setNotifPref("channels.push", v); },
    }));
    if (pushState === "prompt") {
      const ask = btn("Aktifkan notifikasi sistem", "btn btn-secondary btn-block mb-8", async () => {
        if (!shouldShowPrimer("notifications")) {
          await infoSheet({ title: "Nanti saja dulu", desc: "Kamu memilih 'Nanti' belum lama ini. Kami tidak akan bertanya ulang sampai jeda selesai — Kotak Masuk tetap berjalan." });
          return;
        }
        showPermissionPrimer({
          scope: "notifications",
          title: "Ingatkan lewat notifikasi sistem?",
          desc: "Pagi dan sore bila masih ada habit, plus peringatan budget 80%/100%. Bisa dimatikan kapan saja di sini.",
          onAllow: async () => {
            const r = await requestNotificationPermissionContextual();
            showToast(r.state === "granted" ? "Notifikasi sistem aktif" : "Tidak apa-apa — Kotak Masuk tetap jalan");
            NotifPrefsRerender(root, ctx);
          },
        });
      });
      c.appendChild(ask);
    } else if (pushState === "denied") {
      c.appendChild(btn("Cara mengaktifkan kembali", "btn btn-flat btn-small mb-8", () => infoSheet({
        title: "Mengaktifkan notifikasi sistem",
        items: ["Android/Chrome: ikon gembok di bilah alamat → Izin → Notifikasi → Izinkan (atau Setelan aplikasi bila terpasang).", "iPhone/Safari: Pengaturan → Notifikasi → HabitWealth (hanya setelah aplikasi dipasang ke Layar Utama).", "Setelah itu buka halaman ini lagi — statusnya diperbarui otomatis."],
      })));
    }
    c.appendChild(switchRow({ id: "notif-ch-inapp", label: "📥 Kotak Masuk di aplikasi", desc: "Selalu aktif — semua pengingat tersimpan di sini.", checked: true, disabled: true, onChange: async () => {} }));
    c.appendChild(switchRow({ id: "notif-ch-email", label: "✉️ Email", desc: "Belum tersedia.", checked: false, disabled: true, note: "Menunggu layanan email — tidak ada yang dikirim ke email saat ini.", onChange: async () => {} }));

    // Quiet hours
    c.appendChild(el("h3", "settings-heading", "Jam tenang"));
    const qh = el("div", "card");
    qh.appendChild(el("div", "card-title", `Tidak ada pengingat ${timeLabel(prefs.quietHours.start)}–${timeLabel(prefs.quietHours.end)}`));
    qh.appendChild(el("div", "card-sub", `Zona waktu: ${prefs.tz}${prefs.tz !== deviceTZ() ? ` • perangkat: ${deviceTZ()}` : ""}. Pengingat yang jatuh di jam tenang ditunda sampai ${timeLabel(prefs.quietHours.end)} — tidak hilang. Pemberitahuan keamanan tidak ditunda.`));
    const times = el("div", "btn-row wrap mt-12");
    const mkTime = (id, label, value, path) => {
      const wrap = el("div", "field");
      const lab = el("label", "", label);
      lab.htmlFor = id;
      const input = el("input", "field-input");
      input.type = "time";
      input.id = id;
      input.value = value;
      input.step = "300";
      input.addEventListener("change", async () => {
        if (!/^\d{2}:\d{2}$/.test(input.value)) return;
        const next = await setNotifPref(path, input.value);
        qh.querySelector(".card-title").textContent = `Tidak ada pengingat ${timeLabel(next.quietHours.start)}–${timeLabel(next.quietHours.end)}`;
        showToast("Jam tenang diperbarui");
      });
      wrap.append(lab, input);
      return wrap;
    };
    times.append(mkTime("qh-start", "Mulai", prefs.quietHours.start, "quietHours.start"), mkTime("qh-end", "Selesai", prefs.quietHours.end, "quietHours.end"));
    qh.appendChild(times);
    if (prefs.tz !== deviceTZ()) {
      qh.appendChild(btn(`Ikuti zona waktu perangkat (${deviceTZ()})`, "btn btn-secondary btn-small mt-12", async () => {
        await setNotifPref("tz", deviceTZ());
        showToast("Zona waktu mengikuti perangkat");
        NotifPrefsRerender(root, ctx);
      }));
    }
    c.appendChild(qh);

    // Statistik + uji
    c.appendChild(el("h3", "settings-heading", "Frekuensi"));
    const today = new Date().toISOString().slice(0, 10);
    const delivered = prefs.stats && prefs.stats.date === today ? prefs.stats.delivered : 0;
    c.appendChild(el("p", "status-line", `Terkirim hari ini: ${delivered}. Batas frekuensi masih diukur, belum dibatasi (OPEN spec 11).`));
    c.appendChild(btn("Uji notifikasi", "btn btn-secondary btn-block mt-12", async () => {
      const r = await notify("system", { message: "Ini contoh pemberitahuan. Semua aman." }, { id: `system:test:${Date.now()}`, forceOS: true });
      showToast(r.created ? (r.os ? "Terkirim ke sistem + Kotak Masuk" : "Masuk ke Kotak Masuk") : "Gagal membuat pemberitahuan", { tone: r.created ? "success" : "warning" });
    }));
    c.appendChild(btn("Buka Kotak Masuk", "btn btn-flat btn-block mt-8", () => { location.hash = "#/notifikasi"; }));
    c.appendChild(btn("Kembali", "btn btn-secondary mt-16", () => goBack(root, "#/pengaturan")));
  }, { collapsible: false });
}

function NotifPrefsRerender(root, ctx) {
  root.querySelectorAll(".page").forEach((p) => {
    try { p._cleanup && p._cleanup(); } catch {}
    p.remove();
  });
  NotifPrefs(root, ctx);
}

// ---------- Inbox ----------
function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const iso = d.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const y = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayIso) return "Hari ini";
  if (iso === y) return "Kemarin";
  return formatDateId(iso);
}
function timeShort(ts) {
  try {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Inbox(root, ctx = {}) {
  let tab = ctx.query && ctx.query.tab === "arsip" ? "arsip" : "unread";
  shell(root, "Kotak Masuk", async (c) => {
    const tabs = el("div", "segmented mb-12");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Kotak masuk");
    const tabUnread = el("button", "seg", "Belum dibaca");
    const tabArchive = el("button", "seg", "Arsip");
    [tabUnread, tabArchive].forEach((b) => { b.type = "button"; b.setAttribute("role", "tab"); });
    tabs.append(tabUnread, tabArchive);
    const toolbar = el("div", "row-between mb-12");
    const summary = el("p", "status-line", "");
    const markAll = btn("Tandai semua dibaca", "btn btn-flat btn-small", async () => {
      const n = await markAllRead();
      showToast(n ? `${n} ditandai dibaca` : "Tidak ada yang belum dibaca");
      render();
    });
    toolbar.append(summary, markAll);
    const list = el("div", "inbox-list");
    list.setAttribute("aria-live", "polite");
    c.append(tabs, toolbar, list);

    function setTab(t) {
      tab = t;
      tabUnread.setAttribute("aria-selected", String(t === "unread"));
      tabArchive.setAttribute("aria-selected", String(t === "arsip"));
      tabUnread.setAttribute("aria-pressed", String(t === "unread"));
      tabArchive.setAttribute("aria-pressed", String(t === "arsip"));
      tabUnread.tabIndex = t === "unread" ? 0 : -1;
      tabArchive.tabIndex = t === "arsip" ? 0 : -1;
      markAll.hidden = t !== "unread";
      render();
    }
    tabUnread.addEventListener("click", () => setTab("unread"));
    tabArchive.addEventListener("click", () => setTab("arsip"));
    tabs.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setTab(tab === "unread" ? "arsip" : "unread");
        (tab === "unread" ? tabUnread : tabArchive).focus();
      }
    });

    let renderSeq = 0;
    async function render() {
      const seq = ++renderSeq;
      list.innerHTML = "";
      list.append(skeleton("list"), skeleton("list"));
      const { unread, archived, pending } = await partitionInbox();
      if (seq !== renderSeq) return; // render lebih baru sedang berjalan
      const items = tab === "unread" ? unread : archived;
      tabUnread.textContent = `Belum dibaca (${unread.filter((i) => !i.read_at).length})`;
      tabArchive.textContent = `Arsip (${archived.length})`;
      summary.textContent = tab === "unread"
        ? (pending.length ? `${pending.length} pengingat ditunda sampai jam tenang selesai.` : "Prioritas: budget › habit › perayaan.")
        : "Arsip disimpan 7–30 hari, lalu dibersihkan otomatis.";
      list.innerHTML = "";
      if (!items.length) {
        const empty = el("div", "empty-state");
        empty.appendChild(el("p", "", tab === "unread" ? "Semua beres — tidak ada pemberitahuan baru." : "Belum ada arsip."));
        if (tab === "unread") empty.appendChild(btn("Atur notifikasi", "btn btn-flat btn-small", () => { location.hash = "#/pengaturan/notifikasi"; }));
        list.appendChild(empty);
        return;
      }
      let lastDay = null;
      // urut: prioritas lalu terbaru (tab unread) / terbaru saja (arsip)
      const ordered = tab === "unread" ? [...items].sort((a, b) => (PRIORITY[b.priority] || 0) - (PRIORITY[a.priority] || 0) || b.created_at - a.created_at) : items;
      ordered.forEach((it) => {
        const day = dayLabel(it.created_at);
        if (tab === "arsip" && day !== lastDay) {
          list.appendChild(el("h3", "settings-heading", day));
          lastDay = day;
        }
        const card = el("article", `card inbox-item${it.read_at ? "" : " unread"}`);
        card.setAttribute("aria-label", `${it.read_at ? "" : "Belum dibaca. "}${it.title}`);
        const head = el("div", "row-between");
        const chip = el("span", "tpl-chip inbox-chip", `${CATEGORY_ICON[it.category] || "•"} ${CATEGORY_COPY[it.category] ? CATEGORY_COPY[it.category].label : it.category}`);
        chip.setAttribute("aria-hidden", "true");
        head.append(chip, el("span", "tx-sub", `${day} ${timeShort(it.created_at)}`));
        const title = el("div", "card-title", it.title);
        if (!it.read_at) {
          const dot = el("span", "badge-dot");
          dot.setAttribute("role", "img");
          dot.setAttribute("aria-label", "belum dibaca");
          title.prepend(dot);
        }
        card.append(head, title, el("div", "card-sub", it.body));
        const actions = el("div", "btn-row mt-12");
        const open = btn("Buka", "btn btn-primary btn-small", async () => {
          await markRead(it.id);
          location.hash = it.deep_link || "#/beranda";
        });
        actions.appendChild(open);
        if (tab === "unread") {
          actions.appendChild(btn("Arsip", "btn btn-secondary btn-small", async () => {
            await archive(it.id, "user");
            showToast("Diarsipkan");
            render();
          }));
        } else {
          actions.appendChild(btn("Hapus", "btn btn-flat btn-small", async () => {
            const ok = await confirmSheet({ title: "Hapus pemberitahuan ini?", confirmLabel: "Hapus", destructive: true });
            if (!ok) return;
            const { removeItem } = await import("./notify.js");
            await removeItem(it.id);
            render();
          }));
        }
        card.appendChild(actions);
        if (tab === "unread") {
          // swipe kiri = arsip (alternatif non-gesture: tombol Arsip di atas)
          const off = makeListSwipeable(card, { threshold: 96, onSwipeLeft: async () => { await archive(it.id, "user"); showToast("Diarsipkan"); render(); } });
          card._cleanup = off;
        }
        list.appendChild(card);
      });
    }
    setTab(tab);
    const onChange = () => render();
    window.addEventListener("hw:inbox-changed", onChange);
    const page = c.closest(".page");
    if (page) page.addEventListener("hw:destroy", () => window.removeEventListener("hw:inbox-changed", onChange), { once: true });
  }, { collapsible: false });
}
