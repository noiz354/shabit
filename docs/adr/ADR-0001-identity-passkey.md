# ADR-0001 — Identitas & Passkey (WebAuthn) untuk R1.1

- **Status**: PROPOSED (menunggu 1 keputusan: §5 opsi A/B) — 19 Sep 2026
- **Konteks upstream**: spec 07 (PasskeyEnrollment, "Nanti Saja", fallback 3×), spec 18 (session-cookie), audit ID 111/112 (PRE), D-02/D-09 OPEN, roadmap AUD-WEBAUTHN-01 (Wave 3, gated).
- **Keputusan owner (19 Sep 2026)**: SETUJU bersyarat — RP ID = domain produksi; `attestation:"none"`; recovery via email-link (syarat SMTP); ADR + amandemen spec 07/18 **sebelum** kode; tidak ada kode endpoint sebelum §5 diputuskan.

## 1. Keputusan yang diambil (locked oleh owner)
| # | Keputusan | Nilai |
|---|---|---|
| D1 | Relying Party ID | Domain produksi (contoh placeholder: `app.habitwealth.id`; **nilai final diisi owner**). Bukan `localhost`, bukan IP. Origin yang diizinkan = `https://<RP ID>` saja. |
| D2 | Attestation | `none` — tanpa verifikasi rantai sertifikat/MDS; privasi lebih baik; cukup untuk kasus konsumen. |
| D3 | Peran passkey | **Pendamping** sesi email (bukan pengganti penuh di R1.1): passkey = login cepat + re-auth (reveal saldo, export, delete). Email tetap identitas akun. |
| D4 | Recovery | Tautan masuk via email (magic link, TTL 15 mnt, sekali pakai) — **BLOCKED sampai SMTP tersedia**. Sebelum itu: recovery = masuk ulang email lokal (T5 sekarang). |
| D5 | Authenticator | Platform authenticator (biometrik/kunci layar), `residentKey:"preferred"`, `userVerification:"required"`. Roaming key (FIDO2 USB) tidak diblok tapi tidak dipromosikan. |
| D6 | Algoritma | `ES256 (-7)` wajib; `RS256 (-257)` diterima (Windows Hello lama). |
| D7 | Counter | `sign_count` disimpan; regresi counter → tolak + tandai kredensial `suspect` (tanpa lockout otomatis). |

## 2. Alur (R1.1)
1. **Enroll** (PasskeyEnrollment atau Pengaturan › Akun › Passkey): klien `POST /auth/passkey/register-options` → `navigator.credentials.create()` → `POST /auth/passkey/register-verify` → simpan kredensial → `markPasskeyEnrolled(credential_hash)` (sudah ada di `src/auth.js`).
2. **Login**: `POST /auth/passkey/login-options` (tanpa `allowCredentials` → conditional UI/autofill bila tersedia) → `navigator.credentials.get()` → `POST /auth/passkey/login-verify` → session cookie (sama seperti email).
3. **Re-auth**: `login-verify` dengan `purpose:"re-auth"` → set `re_auth_token` 5 mnt (kontrak `POST /auth/re-auth` yang sudah ada tetap berlaku sebagai fallback).
4. **Gagal 3×** → `AuthRecovery` (sudah ada) → D4.
5. **Gate klien** (sudah ada): `src/webauthn.js` `isRPConfigured()` membaca konfigurasi RP; sebelum endpoint hidup, `enrollPasskey()` → `RP_NOT_CONFIGURED` dan UI menampilkan "Segera".

## 3. Data (amandemen spec 06 — konsep, bukan skema final)
- `WebAuthnCredential`: `user_id, credential_id (unik), public_key (COSE, base64url), alg, sign_count, transports[], aaguid, created_at, last_used_at, label, status(active|suspect|revoked)`. Sensitivitas: tinggi (bukan PII langsung, tapi kunci akun).
- `WebAuthnChallenge`: `id, user_id?, challenge (32B random), type(register|login|re-auth), expires_at (≤5 mnt), used_at`. Sekali pakai.
- **Tidak** menyimpan biometrik/template apa pun (arsitektur WebAuthn: verifikasi terjadi di perangkat; server hanya kunci publik + tanda tangan).
- Migrasi terpisah: `db/migrations/002_webauthn.sql` (syarat owner #2).

## 4. Keamanan (checklist implementasi)
- Challenge: `random_bytes(32)`, TTL ≤5 mnt, dihapus setelah dipakai; ikat ke sesi/`user_id` untuk register & re-auth.
- Verifikasi `clientDataJSON`: `type`, `challenge` (base64url sama), `origin === https://<RP ID>`; `authenticatorData`: `rpIdHash === SHA-256(RP ID)`, flag `UP` + `UV` wajib, counter monoton.
- Signature: `ES256` → DER ECDSA over `authenticatorData || SHA-256(clientDataJSON)`; kunci COSE → PEM/DER SPKI sebelum `openssl_verify`.
- Rate-limit `login-options`/`login-verify` per IP (reuse limiter 120/mnt) + per `user_id` 10/mnt.
- Log teredaksi: tanpa `credential_id` mentah (hash saja), tanpa email.
- Envelope + `X-Request-Id` + `Idempotency-Key` untuk `*-verify` (retry aman).

## 5. KEPUTUSAN YANG MASIH DIBUTUHKAN — verifikasi server (pilih satu)
| Opsi | Isi | Risiko | Prasyarat | Rekomendasi |
|---|---|---|---|---|
| **A. Hand-roll nol-dep** | Decoder CBOR minimal (attestationObject `fmt:"none"`, authData, COSE key) + `openssl_verify` ES256/RS256 | Crypto/parsing custom; salah satu bit flag = celah | **Test vector resmi** (webauthn.io / W3C spec §16 contoh / FIDO conformance samples) sebagai fixture PHPUnit; review keamanan | Hanya bila FTP-vendor ditolak |
| **B. Vendor 1 lib kecil via FTP** | `web-auth/webauthn-lib` (butuh banyak dep) **atau** lib ringan `lbuchs/WebAuthn` — MIT, PHP ≥8.0 + ext `openssl` + `mbstring`, tanpa dependensi composer lain (PSR-4 `src/`, bisa di-require langsung), mendukung format attestation `none` (sumber: [composer.json](https://github.com/lbuchs/WebAuthn/blob/master/composer.json), [README](https://github.com/lbuchs/WebAuthn)) — di-FTP ke `lib/vendor/lbuchs-webauthn/` di luar `public_html` | Supply-chain: pin tag rilis + checksum SHA-256 di repo; audit lisensi MIT | Konfirmasi `openssl` ext EC aktif (phpinfo) — daftar Selector menunjukkan ada | **Direkomendasikan** (konsisten dengan keputusan push sender = vendor lib; ~10 file, dibaca-ulas manusiawi) |

Setelah dipilih → TASK AUD-WEBAUTHN-01 boleh mulai (kontrak di spec 18 §"Passkey", migrasi 002).

## 6. Konsekuensi
- (+) Login/re-auth tanpa password, tidak ada biometrik di server, "Nanti Saja" tetap ada → tidak memaksa.
- (−) Tambahan 4 endpoint + 2 tabel + 1 lib vendor (opsi B); recovery bergantung SMTP; perlu 2 perangkat fisik untuk e2e (Android + iPhone) — BLOCKED perangkat.
- Rollback: hapus flag RP (`hw:webauthn:rp:v1`) di klien → UI kembali "Segera"; endpoint dapat dimatikan tanpa memengaruhi email login.

## 7. Bukti yang wajib sebelum DONE (verification-before-completion)
- Unit PHP: verifikasi vektor register+login valid, origin salah → `FORBIDDEN`, challenge kedaluwarsa → `CONFLICT`, counter regresi → `CONFLICT` + `suspect`.
- E2E 2 perangkat: enroll → logout → login passkey → re-auth reveal saldo → gagal 3× → recovery.
- Tanpa PII/credential_id mentah di log (grep).
