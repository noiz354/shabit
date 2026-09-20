// T12 — Kotak Masuk + Quiet Hours tz-user (spec 11 amandemen). happy-dom + fake-indexeddb; tanpa Notification OS (unsupported).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const tracked = [];
vi.mock("../src/analytics.js", () => ({ track: vi.fn((name, props) => { tracked.push({ name, props }); return Promise.resolve(true); }), initAnalytics: vi.fn() }));
vi.mock("../src/feedback.js", () => ({ feedbackHabitComplete: vi.fn(), vibrate: vi.fn(), playBlip: vi.fn() }));
vi.mock("../src/charts.js", () => ({
  renderRingProgress: vi.fn(), renderStreakDots: vi.fn(), renderHabitBar: vi.fn(() => Promise.resolve()), renderDonutCategory: vi.fn(() => Promise.resolve()), renderCashflowBar: vi.fn(() => Promise.resolve()), tokenColor: () => "",
}));

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
// 2026-09-19 adalah Sabtu. 23:30 WIB = 16:30 UTC.
const WIB = (h, m = 0, day = 19) => new Date(Date.UTC(2026, 8, day, h - 7, m, 0));

async function fresh() {
  const { idbClear } = await import("../src/storage/db.js");
  for (const s of ["inbox", "habits", "habit_entries", "transactions", "budgets", "outbox", "kv"]) await idbClear(s).catch(() => {});
  const prefs = await import("../src/storage/prefs.js");
  await prefs.setPrefs({ v: 2, tz: "Asia/Jakarta", notifications: { enabled: true, quietHours: { start: "22:00", end: "07:00" }, categories: { habit: true, budget: true, streak: true, weekly: true, promo: false, system: true }, channels: { push: true, inApp: true, email: false } } });
  tracked.length = 0;
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await fresh();
});
afterEach(() => vi.useRealTimers());
// Jam nyata sandbox (2026-09-20) lebih baru dari skenario → samakan Date.now dengan skenario (hanya Date yang dipalsukan)
function clockAt(d) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d);
}

describe("Quiet Hours dihitung di zona waktu user (bukan perangkat)", () => {
  it("22–07 WIB: 23.30 WIB tenang, 08.00 WIB tidak; tz Asia/Tokyo (UTC+9) memberi hasil berbeda untuk instan yang sama", async () => {
    const n = await import("../src/notify.js");
    const qh = { start: "22:00", end: "07:00" };
    expect(n.isQuietNow(WIB(23, 30), qh, "Asia/Jakarta")).toBe(true);
    expect(n.isQuietNow(WIB(8, 0), qh, "Asia/Jakarta")).toBe(false);
    expect(n.isQuietNow(WIB(6, 59), qh, "Asia/Jakarta")).toBe(true);
    // 21.00 WIB = 23.00 Tokyo → tenang di Tokyo, belum di Jakarta
    expect(n.isQuietNow(WIB(21, 0), qh, "Asia/Jakarta")).toBe(false);
    expect(n.isQuietNow(WIB(21, 0), qh, "Asia/Tokyo")).toBe(true);
    // rentang tidak melewati tengah malam
    expect(n.isQuietNow(WIB(13, 0), { start: "12:00", end: "14:00" }, "Asia/Jakarta")).toBe(true);
    // akhir jam tenang = 07.00 WIB berikutnya
    const ends = n.quietEndsAt(WIB(23, 30), qh, "Asia/Jakarta");
    expect(new Date(ends).toISOString()).toBe(WIB(7, 0, 20).toISOString());
  });

  it("item non-system saat jam tenang DITUNDA (deliver_after) — tidak muncul di Belum dibaca sampai due; pengingat basi tidak dibuat; system tidak ditunda", async () => {
    clockAt(WIB(23, 0));
    const n = await import("../src/notify.js");
    // pengingat sore kedaluwarsa 24.00 < akhir jam tenang 07.00 → tidak dibuat (hindari konten basi)
    expect((await n.notify("habit_evening", {}, { now: WIB(23, 0), period: "2026-09-19" })).reason).toBe("QUIET_EXPIRED");
    const r = await n.notify("budget_80", { category: "Kopi" }, { now: WIB(23, 0), scope: "Kopi", period: "2026-09" });
    expect(r.created).toBe(true);
    expect(r.deferred).toBe(true);
    expect(r.item.deliver_after).toBe(WIB(7, 0, 20).getTime());
    let part = await n.partitionInbox(WIB(23, 5).getTime());
    expect(part.pending).toHaveLength(1);
    expect(part.unread).toHaveLength(0);
    expect(await n.unreadCount(WIB(23, 5).getTime())).toBe(0);
    part = await n.partitionInbox(WIB(7, 1, 20).getTime());
    expect(part.unread).toHaveLength(1);
    const sys = await n.notify("system", { message: "Sesi berakhir" }, { now: WIB(23, 0), id: "system:sesi:x" });
    expect(sys.deferred).toBe(false);
    expect(sys.item.deliver_after).toBe(WIB(23, 0).getTime());
  });
});

describe("Dedup, mute, expiry, prioritas, copy", () => {
  it("id deterministik → trigger ganda = 1 item; kategori mute → tidak dibuat; master OFF → hanya system", async () => {
    clockAt(WIB(9));
    const n = await import("../src/notify.js");
    const a = await n.notify("habit_morning", {}, { now: WIB(9), period: "2026-09-19" });
    const b = await n.notify("habit_morning", {}, { now: WIB(10), period: "2026-09-19" });
    expect(a.created).toBe(true);
    expect(b).toMatchObject({ created: false, reason: "DUPLICATE" });
    expect((await n.listInbox())).toHaveLength(1);
    await n.setNotifPref("categories.budget", false);
    expect((await n.notify("budget_80", { category: "Kopi" }, { now: WIB(9), scope: "Kopi", period: "2026-09" })).reason).toBe("CATEGORY_MUTED");
    await n.setNotifPref("enabled", false);
    expect((await n.notify("streak_7", { habit_id: "h1" }, { now: WIB(9), scope: "h1", period: "m7" })).reason).toBe("DISABLED");
    expect((await n.notify("system", { message: "ok" }, { now: WIB(9), id: "system:1" })).created).toBe(true);
    // system tidak bisa dimatikan lewat prefs
    const p = await n.setNotifPref("categories.system", false);
    expect(p.categories.system).toBe(true);
    expect(p.channels.email).toBe(false);
  });

  it("expired → arsip otomatis; urutan Kotak Masuk budget > habit > perayaan; template ≤40 karakter tanpa 'Rp'", async () => {
    clockAt(WIB(9));
    const n = await import("../src/notify.js");
    await n.notify("streak_7", { habit_id: "h1" }, { now: WIB(9), scope: "h1", period: "m7" });
    await n.notify("habit_morning", {}, { now: WIB(9, 1), period: "2026-09-19" });
    await n.notify("budget_80", { category: "Kopi Susu Kekinian Banget" }, { now: WIB(9, 2), scope: "Kopi", period: "2026-09" });
    const list = await n.listInbox();
    expect(list.map((i) => i.priority)).toEqual(["budget", "habit", "celebration"]);
    expect(list[0].title.length).toBeLessThanOrEqual(40);
    expect(list[0].title).toContain("…"); // kategori panjang dipotong agar ≤40
    // habit_morning kedaluwarsa 18.00 hari yang sama
    const part = await n.partitionInbox(WIB(18, 1).getTime());
    expect(part.archived.some((i) => i.template === "habit_morning" && i.archive_reason === "expired")).toBe(true);
    expect(part.unread.some((i) => i.template === "budget_80")).toBe(true);
    for (const [key, t] of Object.entries(n.TEMPLATES)) {
      if (key === "system") continue;
      expect(t.title.length, key).toBeLessThanOrEqual(40);
      expect(t.title + t.body).not.toMatch(/Rp\s?\d/);
    }
    expect(n.TEMPLATES.goal_success.gated).toBe("T11");
    expect((await n.notify("goal_success", {}, { now: WIB(9) })).reason).toBe("GATED_T11");
  });
});

describe("Trigger dari domain", () => {
  it("budget 80% lalu 100% masing-masing sekali per kategori/bulan (+ budget_threshold_hit tanpa nominal)", async () => {
    clockAt(WIB(12, 0, 13));
    const m = await import("../src/money.js");
    const n = await import("../src/notify.js");
    await m.setBudget("Kopi", 100000, "2026-09");
    await m.createTransaction({ kind: "expense", amount: 50000, category: "Kopi", date: "2026-09-10" });
    expect((await n.listInbox())).toHaveLength(0);
    await m.createTransaction({ kind: "expense", amount: 35000, category: "Kopi", date: "2026-09-11" }); // 85%
    let items = await n.listInbox();
    expect(items.map((i) => i.template)).toEqual(["budget_80"]);
    await m.createTransaction({ kind: "expense", amount: 5000, category: "Kopi", date: "2026-09-12" }); // 90% — tidak ada yang baru
    expect((await n.listInbox())).toHaveLength(1);
    await m.createTransaction({ kind: "expense", amount: 20000, category: "Kopi", date: "2026-09-13" }); // 110%
    items = await n.listInbox();
    expect(items.map((i) => i.template).sort()).toEqual(["budget_100", "budget_80"]);
    expect(items[0].deep_link).toBe("#/uang?cat=Kopi");
    const hits = tracked.filter((t) => t.name === "budget_threshold_hit");
    expect(hits.map((h) => h.props.pct)).toEqual([80, 100]);
    expect(JSON.stringify(hits)).not.toMatch(/amount|Rp/);
  });

  it("streak 7 → 1 item per habit (complete ke-7 saja); evaluateTriggers pagi/sore/senin idempoten", async () => {
    clockAt(WIB(9));
    const h = await import("../src/habit.js");
    const n = await import("../src/notify.js");
    const habit = await h.createHabit({ title: "Air", goal_type: "check" });
    for (let d = 1; d <= 8; d++) await h.completeHabit(habit.id, `2026-09-0${d}`);
    const items = await n.listInbox();
    expect(items.filter((i) => i.template === "streak_7")).toHaveLength(1);
    expect(items[0].deep_link).toBe(`#/habit/${habit.id}`);
    expect(items[0].title).not.toContain("Air"); // tanpa judul habit di lock-screen

    // pagi Sabtu 09.00: belum ada yang selesai hari ini → habit_morning; dievaluasi 2× → tetap 1
    await n.evaluateTriggers({ now: WIB(9, 0) });
    await n.evaluateTriggers({ now: WIB(9, 30) });
    let all = await n.listInbox();
    expect(all.filter((i) => i.template === "habit_morning")).toHaveLength(1);
    // sore 19.00 masih belum selesai → habit_evening
    await n.evaluateTriggers({ now: WIB(19, 0) });
    all = await n.listInbox();
    expect(all.filter((i) => i.template === "habit_evening")).toHaveLength(1);
    // Senin 21 Sep 08.30 → weekly_summary sekali per pekan ISO (+ habit_morning hari itu karena belum ada yang selesai)
    clockAt(WIB(8, 30, 21));
    await n.evaluateTriggers({ now: WIB(8, 30, 21) });
    await n.evaluateTriggers({ now: WIB(9, 30, 21) });
    all = await n.listInbox();
    expect(all.filter((i) => i.template === "weekly_summary")).toHaveLength(1);
    expect(all.find((i) => i.template === "weekly_summary").id).toBe("weekly_summary:2026-W39");
    expect(all.filter((i) => i.template === "habit_morning").map((i) => i.id).sort()).toEqual(["habit_morning:2026-09-19", "habit_morning:2026-09-21"]);
    // Selasa 22: habit sudah selesai hari itu → tidak ada habit_morning baru
    clockAt(WIB(9, 0, 22));
    await h.completeHabit(habit.id, "2026-09-22");
    await n.evaluateTriggers({ now: WIB(9, 0, 22) });
    all = await n.listInbox();
    expect(all.filter((i) => i.template === "habit_morning")).toHaveLength(2);
  });
});

describe("Layar Kotak Masuk + Preferensi", () => {
  it("Inbox: tab Belum dibaca/Arsip, Buka → read + notification_opened, Arsip → notification_dismissed, badge event", async () => {
    const n = await import("../src/notify.js");
    await n.notify("budget_80", { category: "Kopi" }, { now: new Date(Date.now() - 60000), scope: "Kopi", period: "2026-09" });
    await n.notify("habit_morning", {}, { now: new Date(Date.now() - 30000), period: "x-today", id: "habit_morning:test" });
    // pastikan tidak kedaluwarsa dalam test
    const { idbGet, idbPut } = await import("../src/storage/db.js");
    for (const id of ["budget_80:Kopi:2026-09", "habit_morning:test"]) { const it = await idbGet("inbox", id); it.expires_at = Date.now() + 3600000; await idbPut("inbox", it); }
    const { Inbox } = await import("../src/views-notify.jsx");
    const root = document.getElementById("app");
    location.hash = "#/notifikasi";
    Inbox(root, { params: {}, query: {} });
    await tick(80);
    const tabs = root.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toBe("Belum dibaca (2)");
    let cards = root.querySelectorAll(".inbox-item");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Budget Kopi sudah 80%"); // prioritas budget dulu
    // Arsip item pertama via tombol (non-gesture)
    [...cards[0].querySelectorAll("button")].find((b) => b.textContent === "Arsip").click();
    await tick(80);
    expect(tracked.some((t) => t.name === "notification_dismissed" && t.props.category === "budget" && t.props.id === "budget_80")).toBe(true);
    cards = root.querySelectorAll(".inbox-item");
    expect(cards).toHaveLength(1);
    // Buka → read + opened + route
    [...cards[0].querySelectorAll("button")].find((b) => b.textContent === "Buka").click();
    await tick(50);
    expect(tracked.some((t) => t.name === "notification_opened" && t.props.category === "habit" && t.props.deep_link === "#/habit")).toBe(true);
    expect(location.hash).toBe("#/habit");
    // tab arsip
    tabs[1].click();
    await tick(80);
    expect(root.querySelectorAll(".inbox-item")).toHaveLength(1);
    expect(root.querySelector(".inbox-item").textContent).toContain("Kopi");
    expect(JSON.stringify(tracked)).not.toMatch(/email|Rp/);
  });

  it("Preferensi: switch kategori tersimpan + PATCH antre di outbox (tanpa PII); system & in-app terkunci ON; email nonaktif 'Belum tersedia'; jam tenang input time", async () => {
    const { NotifPrefs } = await import("../src/views-notify.jsx");
    const n = await import("../src/notify.js");
    const ob = await import("../src/storage/outbox.js");
    const root = document.getElementById("app");
    NotifPrefs(root, { params: { sub: "notifikasi" }, query: {} });
    await tick(80);
    const sw = (id) => root.querySelector(`#${id}`);
    expect(sw("notif-cat-system").disabled).toBe(true);
    expect(sw("notif-cat-system").getAttribute("aria-checked")).toBe("true");
    expect(sw("notif-ch-inapp").disabled).toBe(true);
    expect(sw("notif-ch-email").disabled).toBe(true);
    expect(sw("notif-ch-email").getAttribute("aria-checked")).toBe("false");
    expect(root.textContent).toContain("Belum tersedia");
    expect(sw("notif-cat-promo").getAttribute("aria-checked")).toBe("false"); // default OFF
    sw("notif-cat-habit").click();
    await tick(30);
    expect((await n.getNotifPrefs()).categories.habit).toBe(false);
    const q = await ob.listOutbox();
    const patch = q.find((o) => o.op === "PATCH" && o.path === "/notification-preferences");
    expect(patch).toBeTruthy();
    expect(JSON.stringify(patch.body)).not.toMatch(/@|session|user_id/); // tanpa PII; hanya flag & jam
    expect(patch.body.channels.email).toBe(false);
    expect(patch.body.tz).toBe("Asia/Jakarta");
    const start = root.querySelector("#qh-start");
    expect(start.type).toBe("time");
    start.value = "21:00";
    start.dispatchEvent(new Event("change"));
    await tick(30);
    expect((await n.getNotifPrefs()).quietHours.start).toBe("21:00");
    expect(root.textContent).toContain("21.00–07.00");
    // Saluran push mengikuti status izin nyata: unsupported → switch nonaktif; prompt → tombol primer (bukan dialog sistem langsung); granted → catatan ✓; denied → cara mengaktifkan
    const { queryPermission } = await import("../src/permissions.js");
    const st = (await queryPermission("notifications")).state;
    const askBtn = [...root.querySelectorAll("button")].find((b) => b.textContent === "Aktifkan notifikasi sistem");
    if (st === "unsupported") expect(sw("notif-ch-push").disabled).toBe(true);
    else if (st === "prompt") expect(askBtn).toBeTruthy();
    else if (st === "granted") expect(root.textContent).toContain("Izin sistem: diberikan");
    else expect(root.textContent).toContain("diblokir");
    if (askBtn) {
      // Menekan tombol membuka primer kami (sheet), TIDAK memanggil Notification.requestPermission langsung
      const spy = vi.fn();
      globalThis.Notification = { requestPermission: spy, permission: "default" };
      askBtn.click();
      await tick(30);
      expect(spy).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeTruthy();
      delete globalThis.Notification;
    }
  });
});
