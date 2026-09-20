# ADR-0002 — Web Push sender di shared hosting (R1.1)

- **Status**: ACCEPTED (keputusan owner 19 Sep 2026) — implementasi menunggu jawaban cron + phpinfo
- **Konteks**: spec 11 (notifikasi), spec 15 (push lokal MVP, VAPID R1.1), spec 18 §"Web Push + VAPID", audit ID 64 (PRE), roadmap AUD-PUSH-01. Endpoint `GET /push/vapid-public-key`, `POST/DELETE /push/subscriptions` sudah ada (T18).

## Keputusan
1. **Vendor lib via FTP, bukan hand-roll** — enkripsi payload `aes128gcm` (RFC 8291: ECDH P-256 + HKDF + AES-GCM) dan VAPID JWT ES256 (RFC 8292) adalah kriptografi; implementasi custom = risiko. Pakai `minishlink/web-push` (web-push-php) yang teraudit komunitas.
2. **Cara bawa lib**: `composer install --no-dev` dilakukan **lokal** (mesin dev), lalu folder `vendor/` di-FTP ke `lib/vendor/` **di luar** `public_html/` (tidak dapat diakses HTTP). Versi di-pin di `composer.lock` yang di-commit; checksum `vendor/` dicatat di PROGRESS saat deploy.
3. **Versi**: pin ke rilis **v11.x** (v11.0.0, 23 Jul 2026, PHP ≥8.2 — sumber: [Packagist](https://packagist.org/packages/minishlink/web-push)); host **PHP 8.5** (owner) memenuhi. Jangan pakai `dev-master`; catat tag + checksum `vendor/` di PROGRESS saat deploy.
4. **Ekstensi PHP yang wajib dikonfirmasi via phpinfo** (Selector host): **wajib** `openssl` (dengan dukungan elliptic curve), `curl`, `mbstring`, `json`; **opsional untuk performa** `gmp` dan/atau `bcmath` (README web-push-php: "optional but better for performance"). Tanpa `gmp/bcmath` tetap jalan, lebih lambat — untuk volume MVP dapat diterima.
5. **Kunci VAPID**: generate sekali (`openssl ecparam -genkey -name prime256v1`), simpan private key di file 0600 **di luar** `public_html` (`lib/keys/vapid.pem`), path via konstanta di `lib/config.php` (tidak di repo). Public key dilayani `GET /push/vapid-public-key` (sudah ada). Rotasi: dokumentasikan; subscription lama tetap valid sampai gagal 410/404 → cleanup.
6. **Trigger pengiriman**: shared hosting tanpa worker → **cron cPanel** tiap 5 menit memanggil `php cli/push-dispatch.php` (CLI, bukan URL publik). Dispatcher: baca antrean `push_outbox` (tabel baru — butuh migrasi terpisah `003_push_outbox.sql` saat implementasi), hormati Quiet Hours **tz user** + kategori mute (T12), prioritas budget>habit>celebration, tanpa nominal sensitif di payload, hapus endpoint 404/410.
   - **OPEN (owner)**: cron cPanel tersedia? Jika tidak → tetap **push lokal** (MVP) dan Web Push ditunda.
7. **Privasi**: payload minimal `{t: template_id, d: deep_link, ts}` — teks dirakit di SW dari template lokal (spec 11); tanpa email/nominal/judul habit.

## Konsekuensi
- (+) Kripto teraudit; kode server kita hanya orkestrasi + antrean.
- (−) Dependensi vendor pertama di backend (menyimpang dari "nol-dep") — disetujui owner secara eksplisit untuk kripto saja; ukuran vendor ~2–4 MB di FTP.
- Prasyarat sebelum TASK AUD-PUSH-01: T12 (Inbox + Quiet Hours tz-user), jawaban cron, phpinfo ekstensi, SMTP tidak diperlukan.

## Bukti wajib sebelum DONE
- E2E R1.1: opt-in kontekstual → subscription tersimpan → dispatch saat quiet hours **tidak** terkirim → di luar quiet hours terkirim → tap → route deep-link + `notification_opened`.
- 410 cleanup test; payload tidak memuat PII (inspeksi).
