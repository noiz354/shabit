/**
 * HabitWealth WebAuthn — AUD-WEBAUTHN-01 (Wave 3, GATED)
 * APIs 111 (Web Authentication) + 112 (Credential Management)
 *
 * STATUS: capability detection ONLY. The passkey ceremony
 * (navigator.credentials.create/get) is intentionally gated behind
 * RP endpoints that do not exist yet (identity ADR D-09 OPEN, spec 18
 * has no /auth/passkey/* contract). enrollPasskey() therefore never
 * fakes success — it returns { ok:false, reason:"RP_NOT_CONFIGURED" }.
 *
 * Rules (spec 07): passkey is CONDITIONAL; "Nanti Saja" always available;
 * copy awam, no claims about biometric storage beyond platform architecture.
 */

const RP_CONFIG_KEY = "hw:webauthn:rp:v1"; // set only after AUD-WEBAUTHN-01 lands

export function isWebAuthnSupported() {
  try {
    return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
  } catch {
    return false;
  }
}

export function isCredentialManagementSupported() {
  try {
    return typeof navigator !== "undefined" && !!navigator.credentials && typeof navigator.credentials.get === "function";
  } catch {
    return false;
  }
}

/** Platform authenticator (biometrik/PIN perangkat) tersedia? */
export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Conditional UI (autofill passkey) tersedia? */
export async function isConditionalMediationAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isConditionalMediationAvailable !== "function") return false;
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

/** RP endpoints configured? (false until Wave 3 AUD-WEBAUTHN-01 + ADR) */
export function isRPConfigured() {
  try {
    const raw = localStorage.getItem(RP_CONFIG_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return !!(cfg && cfg.rpId && cfg.endpoints && cfg.endpoints.registerOptions);
  } catch {
    return false;
  }
}

/**
 * Ringkasan kapabilitas untuk AuthHub/PasskeyEnrollment.
 * `offerPasskey` = boleh tampilkan tombol passkey (kondisional per spec 07).
 */
export async function getPasskeyCapability() {
  const supported = isWebAuthnSupported();
  const secure = typeof window !== "undefined" ? window.isSecureContext === true : false;
  const platform = supported && secure ? await isPlatformAuthenticatorAvailable() : false;
  const conditional = supported && secure ? await isConditionalMediationAvailable() : false;
  const rp = isRPConfigured();
  return {
    supported,
    secureContext: secure,
    platformAuthenticator: platform,
    conditionalMediation: conditional,
    rpConfigured: rp,
    // Tampilkan opsi passkey hanya bila perangkat sanggup; aktif hanya bila RP siap
    offerPasskey: supported && secure && platform,
    canEnroll: supported && secure && platform && rp,
  };
}

/**
 * GATED: tidak memanggil navigator.credentials.create sebelum RP siap.
 * Mengembalikan alasan eksplisit agar UI bisa menampilkan fallback jujur.
 */
export async function enrollPasskey() {
  const cap = await getPasskeyCapability();
  if (!cap.supported) return { ok: false, reason: "UNSUPPORTED" };
  if (!cap.secureContext) return { ok: false, reason: "INSECURE_CONTEXT" };
  if (!cap.platformAuthenticator) return { ok: false, reason: "NO_PLATFORM_AUTHENTICATOR" };
  if (!cap.rpConfigured) return { ok: false, reason: "RP_NOT_CONFIGURED" };
  // Wave 3: challenge from /auth/passkey/register-options → create() → /register-verify
  return { ok: false, reason: "NOT_IMPLEMENTED" };
}

export async function authenticateWithPasskey() {
  const cap = await getPasskeyCapability();
  if (!cap.canEnroll) return { ok: false, reason: cap.rpConfigured ? "UNAVAILABLE" : "RP_NOT_CONFIGURED" };
  return { ok: false, reason: "NOT_IMPLEMENTED" };
}

export const PASSKEY_REASON_COPY = {
  UNSUPPORTED: "Perangkat ini belum mendukung passkey.",
  INSECURE_CONTEXT: "Passkey butuh koneksi aman (HTTPS).",
  NO_PLATFORM_AUTHENTICATOR: "Kunci layar/biometrik perangkat belum aktif.",
  RP_NOT_CONFIGURED: "Passkey belum aktif di versi ini. Kamu bisa mengaturnya nanti di Pengaturan.",
  NOT_IMPLEMENTED: "Passkey belum aktif di versi ini.",
  UNAVAILABLE: "Passkey tidak tersedia saat ini.",
};

export const webauthn = {
  isWebAuthnSupported,
  isCredentialManagementSupported,
  isPlatformAuthenticatorAvailable,
  isConditionalMediationAvailable,
  isRPConfigured,
  getPasskeyCapability,
  enrollPasskey,
  authenticateWithPasskey,
  PASSKEY_REASON_COPY,
};
