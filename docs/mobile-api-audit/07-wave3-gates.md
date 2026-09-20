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

## 4. Keputusan owner (19 Sep 2026) + status
| # | Pertanyaan | Keputusan | Tindak lanjut |
|---|---|---|---|
| 1 | Identity ADR | **SETUJU bersyarat**: RP ID = domain produksi; `attestation:"none"`; recovery email-link (syarat SMTP); ADR + amandemen spec 07/18 dulu; **tanpa kode sebelum opsi verifikasi diputuskan** | `docs/adr/ADR-0001-identity-passkey.md` (PROPOSED — **§5 opsi A hand-roll + test vector vs B vendor `lbuchs/WebAuthn` menunggu keputusan**), spec 07 + 18 diamandemen |
| 2 | Endpoint PHP baru | **DISETUJUI prinsip** dengan syarat: amandemen spec 18 (kontrak + error codes), migrasi SQL terpisah, challenge `random_bytes` TTL ≤5 mnt, log redacted, envelope + `X-Request-Id` | spec 18 §Passkey (6 endpoint + 4 error code), `db/migrations/002_webauthn.sql`. Kode endpoint **belum** ditulis (menunggu #1 §5) |
| 3 | Push sender | **Vendor lib via FTP** (web-push-php), pin versi utk PHP 8.5, konfirmasi ekstensi via phpinfo; **cron cPanel = OPEN (owner)** — tanpa cron tetap push lokal | `docs/adr/ADR-0002-push-sender.md` (ACCEPTED; v11.x PHP ≥8.2; gmp/bcmath opsional performa) |
| 4 | SMTP + perangkat | **Butuh manusia**: kredensial SMTP; 1 Android + 1 iPhone; jawaban cron | BLOCKED sampai tersedia — Wave 3 penuh terkunci; lanjut T13/T10–T12 |

### Masih terbuka (jawaban owner)
- ADR-0001 §5: **A** (hand-roll + test vector resmi) atau **B** (vendor `lbuchs/WebAuthn`, direkomendasikan)?
- Cron cPanel tersedia? SMTP tersedia? Perangkat uji?
