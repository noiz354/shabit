// T5/T13 — auth state machine (spec 07): consent tanpa preselect, Nanti Saja, 3× gagal → fallback, guard, events
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/analytics.js", () => ({ track: vi.fn(() => Promise.resolve(true)) }));

import { track } from "../src/analytics.js";
import * as auth from "../src/auth.js";

beforeEach(() => {
  auth.resetAuthState();
  vi.mocked(track).mockClear();
});

describe("session — local-first tanpa backend", () => {
  it("signup email membuat sesi lokal saat fetch gagal (offline_created) + event signup_completed tanpa email", async () => {
    const res = await auth.signup({ method: "email", email: "budi@contoh.id" });
    expect(res.ok).toBe(true);
    expect(res.offline).toBe(true);
    expect(auth.isLoggedIn()).toBe(true);
    const s = auth.getSession();
    expect(s.offline_created).toBe(true);
    expect(s.user_id_hash).toMatch(/^[0-9a-f]+$/);
    expect(track).toHaveBeenCalledWith("signup_completed", expect.objectContaining({ method: "email" }));
    const props = vi.mocked(track).mock.calls[0][1];
    expect(JSON.stringify(props)).not.toContain("budi@contoh.id");
  });

  it("validasi email + duplikat lokal → code DUPLICATE (state duplikat)", async () => {
    expect((await auth.signup({ email: "bukan-email" })).code).toBe("INVALID_EMAIL");
    await auth.signup({ email: "budi@contoh.id" });
    await auth.logout();
    const dup = await auth.signup({ email: "BUDI@contoh.id" });
    expect(dup.ok).toBe(false);
    expect(dup.code).toBe("DUPLICATE");
    const login = await auth.login({ email: "budi@contoh.id" });
    expect(login.ok).toBe(true);
    expect(login.returning).toBe(true);
  });

  it("metode google/apple/passkey belum tersedia → ditolak jujur, tidak membuat sesi", async () => {
    for (const method of ["google", "apple", "passkey"]) {
      const r = await auth.signup({ method, email: "x@y.id" });
      expect(r.ok).toBe(false);
      expect(r.code).toBe("METHOD_UNAVAILABLE");
    }
    expect(auth.isLoggedIn()).toBe(false);
  });

  it("auto-logout usulan 30 hari: sesi tidak aktif > 30 hari dianggap expired", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    const s = auth.getSession();
    const now = s.last_active_at + auth.AUTO_LOGOUT_DAYS * 86400000 + 1;
    expect(auth.isSessionExpired(s, now)).toBe(true);
    expect(auth.isSessionExpired(s, now - 2)).toBe(false);
  });

  it("maskEmail tidak membocorkan alamat penuh", () => {
    const m = auth.maskEmail("budisantoso@contoh.id");
    expect(m).toMatch(/^bu•+@contoh\.id$/);
  });
});

describe("consent 3 lapis", () => {
  it("default TANPA preselect (semua false) dan dasar wajib", () => {
    expect(auth.CONSENT_DEFAULT).toEqual({ dasar: false, kesehatan: false, finansial: false });
    expect(auth.validateConsent({}).code).toBe("BASIC_REQUIRED");
    expect(auth.validateConsent({ dasar: true }).ok).toBe(true);
    expect(auth.validateConsent({ dasar: true, kesehatan: "yes" }).value.kesehatan).toBe(false); // hanya true eksplisit
  });

  it("saveConsent mencatat riwayat berversi + memajukan langkah ke passkey; revoke mencatat entri baru", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    const r = await auth.saveConsent({ dasar: true, finansial: true });
    expect(r.ok).toBe(true);
    expect(auth.getOnboardingState().step).toBe("passkey");
    const hist = auth.getConsentHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ dasar: true, kesehatan: false, finansial: true, version: auth.CONSENT_VERSION });
    expect(hist[0].granted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await auth.revokeConsent("finansial");
    expect(auth.getConsentHistory()[0]).toMatchObject({ finansial: false, revoked: "finansial" });
    expect((await auth.revokeConsent("dasar")).ok).toBe(false);
  });
});

describe("passkey kondisional + Nanti Saja", () => {
  it("deferPasskey → status deferred + reminder badge + langkah first-habit", async () => {
    await auth.signup({ email: "budi@contoh.id" });
    await auth.saveConsent({ dasar: true });
    const s = auth.deferPasskey();
    expect(s.status).toBe("deferred");
    expect(auth.hasPasskeyReminder()).toBe(true);
    expect(auth.getOnboardingState().step).toBe("first-habit");
    auth.dismissPasskeyReminder();
    expect(auth.hasPasskeyReminder()).toBe(false);
  });

  it("biometrik gagal 3× → fallback recovery; reset setelah pulih", () => {
    expect(auth.recordBiometricFailure().fallback).toBe(false);
    expect(auth.recordBiometricFailure().fallback).toBe(false);
    const third = auth.recordBiometricFailure();
    expect(third.count).toBe(auth.BIO_FAIL_LIMIT);
    expect(third.fallback).toBe(true);
    expect(auth.shouldFallbackToRecovery()).toBe(true);
    auth.resetBiometricFailures();
    expect(auth.shouldFallbackToRecovery()).toBe(false);
  });
});

describe("state machine + router guard", () => {
  it("belum login: rute utama → #/auth (return-to disimpan), langkah lanjut diblok", () => {
    expect(auth.getNextStep()).toBe("carousel");
    expect(auth.authGate("/beranda")).toBe("#/auth");
    expect(auth.authGate("/auth/consent")).toBe("#/auth/carousel");
    expect(auth.authGate("/auth/hub")).toBeNull();
    expect(auth.authGate("/auth/recovery")).toBeNull();
  });

  it("carousel dilewati → hub; login → consent → passkey → first-habit → done, tanpa lompat maju", async () => {
    auth.markCarouselDone({ skipped: true });
    expect(auth.getNextStep()).toBe("hub");
    await auth.signup({ email: "budi@contoh.id" });
    expect(auth.getNextStep()).toBe("consent");
    expect(auth.authGate("/auth/first-habit")).toBe("#/auth/consent"); // tidak boleh lompat
    expect(auth.authGate("/auth/hub")).toBe("#/auth/consent"); // sudah login → tak perlu hub
    expect(auth.authGate("/uang")).toBe("#/auth/consent");
    await auth.saveConsent({ dasar: true });
    expect(auth.authGate("/auth/passkey")).toBeNull();
    auth.deferPasskey();
    expect(auth.authGate("/auth/first-habit")).toBeNull();
    const done = await auth.completeOnboarding({ firstHabitId: "h1" });
    expect(auth.getNextStep()).toBe("done");
    expect(auth.authGate("/auth/consent")).toBe("#/beranda");
    expect(auth.authGate("/beranda")).toBeNull();
    expect(track).toHaveBeenCalledWith("onboarding_completed", expect.objectContaining({ skipped: true, duration_s: expect.any(Number) }));
    expect(typeof done.duration_s).toBe("number");
  });

  it("return-to: deep-link ke /uang sebelum login dikembalikan setelah onboarding, rute auth tidak pernah jadi return-to", () => {
    auth.authGate("/uang");
    expect(auth.consumeReturnTo()).toBe("/uang");
    expect(auth.consumeReturnTo()).toBeNull(); // sekali pakai
  });

  it("restoreSession melaporkan pendingSync dari outbox + nextStep", async () => {
    const r = await auth.restoreSession();
    expect(r.session).toBeNull();
    expect(r.pendingSync).toBe(0);
    expect(r.nextStep).toBe("carousel");
  });
});
