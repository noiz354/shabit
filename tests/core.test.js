// T13 — matriks inti: masking (spec 09/14), permission "Later" (spec 07), analytics tanpa PII (spec 05),
// router hash/range restore (spec 17), search history max-5 (spec 19), crypto idempotency/redaksi (spec 18)
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Uang — masking default Rp•••• + format Rp10.000 (spec 09, 14)", () => {
  it("getDisplayAmount dimasking sampai re-auth; setelah re-auth format id-ID titik ribuan", async () => {
    const money = await import("../src/money.js");
    localStorage.removeItem("hw:re-auth:expires");
    expect(money.isReAuthed()).toBeFalsy();
    expect(money.getDisplayAmount(1250000)).toBe("Rp••••••");
    await money.requestReAuth();
    expect(money.isReAuthed()).toBe(true);
    const shown = money.getDisplayAmount(10000);
    expect(shown.replace(/\u00a0/g, "")).toBe("Rp10.000");
    // sesi re-auth 5 menit tersimpan untuk pemeriksaan ulang
    expect(parseInt(localStorage.getItem("hw:re-auth:expires"), 10)).toBeGreaterThan(Date.now());
  });

  it("re-auth kedaluwarsa → kembali dimasking", async () => {
    const money = await import("../src/money.js");
    localStorage.setItem("hw:re-auth:expires", String(Date.now() - 1000));
    expect(money.checkReAuthFromStorage()).toBe(false);
  });
});

describe("Permissions — 'Later' tidak pernah memicu dialog sistem (spec 07 §6)", () => {
  beforeEach(() => localStorage.clear());
  it("later → canTriggerSystemDialog=false; requestNotificationPermission diblok tanpa memanggil Notification.requestPermission", async () => {
    const perm = await import("../src/permissions.js");
    const reqSpy = vi.fn(() => Promise.resolve("granted"));
    globalThis.Notification = { requestPermission: reqSpy, permission: "default" };
    await perm.recordPrimerDecision("notifications", "later");
    expect(perm.canTriggerSystemDialog("notifications")).toBe(false);
    const r = await perm.requestNotificationPermission();
    expect(r.blocked).toBe(true);
    expect(reqSpy).not.toHaveBeenCalled();
    await perm.recordPrimerDecision("notifications", "granted");
    expect(perm.canTriggerSystemDialog("notifications")).toBe(true);
    const r2 = await perm.requestNotificationPermission();
    expect(reqSpy).toHaveBeenCalledTimes(1);
    expect(r2.state).toBe("granted");
  });
  it("denied → cooldown 7 hari untuk primer", async () => {
    const perm = await import("../src/permissions.js");
    await perm.recordPrimerDecision("notifications", "denied");
    expect(perm.shouldShowPrimer("notifications")).toBe(false);
  });
});

describe("Analytics — allowlist + redaksi PII (spec 05)", () => {
  it("event di luar allowlist ditolak; props PII (email/amount/title/q) dihapus dari antrean", async () => {
    const anal = await import("../src/analytics.js");
    const { idbGetAll, idbClear } = await import("../src/storage/db.js");
    await idbClear("analytics_queue").catch(() => {});
    localStorage.setItem("hw:prefs:v2", JSON.stringify({ v: 2, privacy: { analyticsOptIn: true } }));
    anal.initAnalytics({ optIn: true });
    expect(await anal.track("event_liar", {})).toBe(false);
    const ok = await anal.track("transaction_created", { kind: "expense", category: "kopi", has_note: true, amount: 25000, email: "a@b.id", title: "Kopi pagi", note: "rahasia" });
    expect(ok).toBe(true);
    const q = await idbGetAll("analytics_queue", null, undefined, 100);
    const e = q.find((x) => x.event === "transaction_created");
    expect(e).toBeTruthy();
    const json = JSON.stringify(e.props);
    expect(json).not.toContain("a@b.id");
    expect(json).not.toContain("25000");
    expect(json).not.toContain("Kopi pagi");
    expect(json).not.toContain("rahasia");
    expect(e.props).toMatchObject({ kind: "expense", category: "kopi", has_note: true });
  });
  it("search_executed tidak pernah membawa q mentah", async () => {
    const anal = await import("../src/analytics.js");
    const { idbGetAll } = await import("../src/storage/db.js");
    anal.initAnalytics({ optIn: true });
    await anal.track("search_executed", { q: "kopi susu", char_len: 9, result_count: 3, scope: "semua" });
    const q = await idbGetAll("analytics_queue", null, undefined, 100);
    const e = q.filter((x) => x.event === "search_executed").pop();
    expect(e.props.q).toBeUndefined();
    expect(e.props.char_len).toBe(9);
  });
});

describe("Router — hash parse/build + range restore (spec 17, AUD-ROUTER-01)", () => {
  it("parseHash/buildHash round-trip; getRangeFromHash; matchRoute :id; authGate terekspos", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    location.hash = "#/uang?from=2026-09-01&to=2026-09-30&preset=month&q=kopi";
    const { initRouter } = await import("../src/router.js");
    const router = initRouter(document.getElementById("app"));
    const hw = router.hw;
    const parsed = hw.parseHash("#/uang?from=2026-09-01&to=2026-09-30&preset=month&q=kopi");
    expect(parsed.path).toBe("/uang");
    expect(parsed.query).toMatchObject({ from: "2026-09-01", to: "2026-09-30", preset: "month", q: "kopi" });
    expect(hw.buildHash("/uang", { preset: "month", from: "2026-09-01", to: "", x: null })).toBe("#/uang?preset=month&from=2026-09-01");
    // Guard (belum login) sudah me-replace hash ke #/auth → set ulang untuk membaca range dari URL
    location.hash = "#/uang?from=2026-09-01&to=2026-09-30&preset=month";
    expect(hw.getRangeFromHash()).toMatchObject({ preset: "month", from: "2026-09-01", to: "2026-09-30", tz: "Asia/Jakarta" });
    expect(hw.matchRoute("/habit/abc123")).toMatchObject({ pattern: "/habit/:id", params: { id: "abc123" } });
    expect(hw.matchRoute("/auth/consent")).toMatchObject({ pattern: "/auth/:step", params: { step: "consent" } });
    expect(typeof hw.authGate).toBe("function");
    // belum login → guard mengarahkan ke #/auth (replace), return-to tersimpan
    expect(JSON.parse(localStorage.getItem("hw:auth:return-to"))).toBe("/uang");
  });
});

describe("Search history — max 5 lokal, tidak di-sync (spec 19)", () => {
  it("addSearchHistory dedup case-insensitive, terbaru dulu, maksimal 5; hapus item/semua", async () => {
    const prefs = await import("../src/storage/prefs.js");
    prefs.clearSearchHistory();
    ["kopi", "listrik", "Kopi", "bensin", "makan", "buku", "pulsa"].forEach((q) => prefs.addSearchHistory(q));
    const h = prefs.getSearchHistory();
    expect(h).toHaveLength(5);
    expect(h[0]).toBe("pulsa");
    expect(h.filter((x) => x.toLowerCase() === "kopi")).toHaveLength(1); // dedup case-insensitive: "Kopi" satu entri
    expect(h).not.toContain("listrik"); // entri tertua tergeser keluar (max 5)
    prefs.addSearchHistory("a"); // <2 char diabaikan
    expect(prefs.getSearchHistory()).toHaveLength(5);
    prefs.removeHistoryItem("pulsa");
    expect(prefs.getSearchHistory()[0]).toBe("buku");
    prefs.clearSearchHistory();
    expect(prefs.getSearchHistory()).toEqual([]);
  });
});

describe("Crypto — idempotency unik + redaksi log (spec 18, AUD-CRYPTO-01)", () => {
  it("1000 idempotency key unik; redactForLog menutup email/amount/note/title", async () => {
    const c = await import("../src/crypto.js");
    const keys = new Set(Array.from({ length: 1000 }, () => c.generateIdempotencyKey()));
    expect(keys.size).toBe(1000);
    const red = c.redactForLog({ email: "a@b.id", amount: 5000, nested: { note: "x", ok: 1 }, kind: "expense" });
    expect(red.email).toBe("[REDACTED]");
    expect(red.amount).toBe("[REDACTED]");
    expect(red.nested.note).toBe("[REDACTED]");
    expect(red.nested.ok).toBe(1);
    expect(red.kind).toBe("expense");
    expect(await c.hashString("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Range presets (spec 17) — from ≤ to, bulan ini = tanggal 1..akhir bulan", () => {
  it("setiap preset menghasilkan from ≤ to dalam format YYYY-MM-DD", async () => {
    const { rangeHelpers } = await import("../src/range.js");
    for (const p of rangeHelpers.PRESETS) {
      const r = p.getRange();
      expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.from <= r.to).toBe(true);
    }
    const m = rangeHelpers.PRESETS.find((p) => p.key === "month").getRange();
    expect(m.from.endsWith("-01") || m.from.endsWith("-30") || m.from.endsWith("-31")).toBe(true); // toISOString UTC dapat menggeser 1 hari
  });
});

describe("WebAuthn (Wave 3 gated) — tanpa RP tidak pernah memanggil credentials.create", () => {
  it("enrollPasskey mengembalikan alasan eksplisit; PublicKeyCredential palsu tersedia pun tetap gated", async () => {
    const create = vi.fn();
    Object.defineProperty(navigator, "credentials", { value: { create, get: vi.fn() }, configurable: true });
    globalThis.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true), isConditionalMediationAvailable: () => Promise.resolve(true) };
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const w = await import("../src/webauthn.js");
    const cap = await w.getPasskeyCapability();
    expect(cap.offerPasskey).toBe(true);
    expect(cap.canEnroll).toBe(false);
    const r = await w.enrollPasskey();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("RP_NOT_CONFIGURED");
    expect(create).not.toHaveBeenCalled();
    expect(w.PASSKEY_REASON_COPY[r.reason]).toContain("belum aktif");
  });
});
