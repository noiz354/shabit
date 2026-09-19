# 07 — Wave 3 Gates (WEBAUTHN / PUSH / RES spikes) — status & keputusan yang dibutuhkan

> Wave 3 = **prerequisite-gated** (roadmap 05). Sesi 19 Sep 2026 hanya mengerjakan bagian yang **tidak** butuh endpoint PHP baru / ADR (aturan AGENTS.md "Ask first: endpoint PHP baru, klaim provider"). Sisanya menunggu keputusan di §4.

## 1. AUD-WEBAUTHN-01 — Passkey (APIs 111, 112)
**Dikerjakan (client, aman):**
- `src/webauthn.js`: deteksi `PublicKeyCredential`, `isUserVerifyingPlatformAuthenticatorAvailable()`, `isConditionalMediationAvailable()`, `isSecureContext`, flag `isRPConfigured()` (LS `hw:webauthn:rp:v1`, hanya diisi setelah RP siap).
- `getPasskeyCapability()` → `offerPasskey` (tampilkan tombol hanya bila perangkat sanggup) dan `canEnroll` (aktif hanya bila RP siap). UI AuthHub/PasskeyEnrollment memakai ini; tombol berlabel "Segera"/"Belum aktif" bila RP belum ada.
- `enrollPasskey()`/`authenticateWithPasskey()` **tidak pernah** memanggil `navigator.credentials.create/get` sebelum RP siap → mengembalikan `{ok:false, reason:"RP_NOT_CONFIGURED"}` (test: `tests/core.test.js › WebAuthn`).
- T5 menyediakan prasyarat: "Nanti Saja" + badge pengingat di Pengaturan, counter gagal 3× → `AuthRecovery`.

**Diblok (butuh keputusan):**
- Identity ADR (D-09): RP ID = domain produksi (mis. `app.habitwealth.id`)? Satu RP untuk web + PWA. Passkey menggantikan password sepenuhnya atau pendamping email-link?
- 4 endpoint PHP baru (usulan kontrak, belum di spec 18):
  - `POST /auth/passkey/register-options` → `{challenge, rp, user{id,name,displayName}, pubKeyCredParams[ES256,RS256], authenticatorSelection{residentKey:"preferred", userVerification:"required"}, timeout}`
  - `POST /auth/passkey/register-verify` → verifikasi attestation (`none`), simpan `credential_id, public_key(COSE), sign_count, transports, aaguid`
  - `POST /auth/passkey/login-options` → `{challenge, allowCredentials?, userVerification}` (conditional UI → tanpa allowCredentials)
  - `POST /auth/passkey/login-verify` → verifikasi assertion (signature, rpIdHash, flags UV, counter monoton) → set session
  - Tabel: `webauthn_credentials(user_id, credential_id UNIQUE, public_key, sign_count, transports, created_at, last_used_at)`, `webauthn_challenges(id, user_id?, challenge, type, expires_at)` (TTL 5 mnt).
  - Shared hosting PHP ≤8.1 tanpa composer: verifikasi ES256 memakai `openssl_verify` (DER dari COSE → PEM) — perlu bukti `openssl` ext aktif di host; RS256 sama. **Tanpa lib pihak ketiga** = kerja manual CBOR decode (attestationObject) — usul: dukung `attestation: "none"` saja untuk R1.1.
- Recovery wajib rilis bersamaan (spec 07 §8): tautan email → butuh pengirim email (SMTP host?) — OPEN.

## 2. AUD-PUSH-01 — Web Push (API 64)
**Sudah ada:** `GET /push/vapid-public-key`, `POST/DELETE /push/subscriptions` (T18); Notifications lokal + quiet hours + inbox (AUD-NOTIF-01); primer kontekstual (T5).
**Diblok:**
- PHP sender: VAPID JWT (ES256) + enkripsi payload `aes128gcm` (ECDH P-256 + HKDF) — tanpa composer berarti implementasi manual (~300 baris) + `openssl`/`sodium` ext; atau izinkan `minishlink/web-push` via vendor dir yang di-FTP. **Butuh keputusan**: boleh bawa vendor lib ke shared host?
- Kunci VAPID: generate sekali, simpan di luar `public_html` (env/file 0600) — jalur file di host?
- Trigger pengiriman: shared hosting tanpa worker → cron (cPanel) tiap 5 mnt memanggil `cli/push-dispatch.php`? Butuh konfirmasi cron tersedia.
- T12 (Inbox + Quiet Hours tz-user) belum dibangun sebagai layar; push tetap R1.1.

## 3. Research spikes (½ hari, butuh perangkat fisik)
| Spike | Butuh | Output |
|---|---|---|
| RES-01 Voice note (API 18) | 2 perangkat Android (Samsung + Pixel) + iPhone; korpus 30 kalimat id-ID | WER id-ID + keputusan fallback (teks) |
| RES-02 Keyboard API/DeX (35) | Samsung DeX | prioritas rendah — bisa ditunda |
| RES-03 FedCM vs OAuth-redirect (127) | IdP sandbox Google (client id), domain HTTPS | keputusan tombol Google di AuthHub (saat ini "Belum tersedia") |
| RES-04 OCR struk (143,149) | sampel 50 struk, TextDetector (CA lab) vs WASM (tesseract) vs server | keputusan + estimasi bundle |

Tidak bisa dijalankan di sandbox (tanpa perangkat/IdP) → status BLOCKED, bukan NOT DONE.

## 4. Keputusan yang diminta dari owner (Ask first)
1. **Identity ADR**: RP ID/domain produksi + apakah passkey boleh ditambahkan sebagai R1.1 dengan `attestation:"none"` dan recovery via email-link?
2. **Endpoint PHP baru**: setuju 4 endpoint `/auth/passkey/*` + 2 tabel di atas?
3. **Push sender**: implementasi manual (tanpa vendor) vs vendor lib di-FTP; cron cPanel tersedia?
4. **Email**: ada SMTP/transaksional untuk tautan masuk/recovery? (mempengaruhi AuthHub + Recovery)
5. **Perangkat uji**: siapa yang memegang device untuk RES-01/03/04 + smoke LCP/CLS?
