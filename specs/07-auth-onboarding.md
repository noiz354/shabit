# Spec: 07 — Auth, Consent, Permissions & First-Use (P07)

## Objective
Splash → first habit completion <3 mnt happy path, dengan alternatif aksesibel. Memisahkan legal ack vs optional permission.

## Screens (kontrak P00 per layar: purpose/entry-exit/hierarchy/data/states/rules/a11y/privacy/analytics/trace/phase)
1. Splash/RestoreSession — skeleton, session check, crash-recovery notice bila pending queue ada ("Sinkronisasi tertunda, coba otomatis" + Sync Sekarang).
2. OnboardingCarousel 3 slide (manfaat habit+uang beriringan), Skip jelas.
3. SignupLoginHub — email/Google/Apple + passkey kondisional. States: default/loading/success/error/duplikat/offline.
4. DataConsent — 3 lapis: (a) dasar wajib, (b) kesehatan opsional, (c) finansial opsional. Tanpa preselect opsional. Microcopy ringkas merujuk UU PDP No.27/2022 tanpa klaim pasal.
5. PasskeyEnrollment — tombol "Nanti Saja" → dashboard + reminder badge di Settings. Copy awam: "Wajahmu adalah kuncimu. Data biometrik tersimpan di chip HP-mu, bukan di server kami."
6. PermissionPrimer — kontekstual, SATU per momen: Day1 signup biometrik saja; setelah first habit → notifikasi; Day3 buka tab Uang → health (R1.1); bank OAuth handle sendiri. Setiap deny → fallback "Tidak apa-apa! Aktifkan nanti di Pengaturan > Privasi." Jangan trigger system dialog bila user tap Nanti.
7. FirstHabitCreate + FirstCompletion — CTA sticky di atas keyboard; tap luar dismiss + autosave draft.
8. FallbackRecovery — biometrik gagal 3× → PIN/password/email link.

## Amandemen 19 Sep 2026 (T5 implementasi + ADR-0001)
- **Implementasi T5 (v1.0, tanpa backend wajib)**: sesi lokal-first (`src/auth.js`), state machine `carousel→hub→consent→passkey→first-habit→done`, router guard `authGate()`. Sesi lokal dibuat walau `/auth/*` gagal/offline (`offline_created`) — first habit <3 mnt tidak bergantung jaringan.
- **SignupLoginHub**: Google/Apple/passkey ditampilkan `aria-disabled` "Belum tersedia"/"Segera" sampai penyedia identitas dikonfigurasi (RES-03) / RP passkey hidup — tidak disembunyikan agar IA tetap terlihat, tidak difake.
- **DataConsent**: persetujuan dasar = pengakuan legal eksplisit (harus di-tap, tidak preselect); opsional kesehatan/finansial tanpa preselect; riwayat berversi + cabut di Pengaturan › Data & Privasi.
- **PasskeyEnrollment (R1.1, ADR-0001)**: RP ID = domain produksi; `attestation:"none"`; passkey = pendamping email (login cepat + re-auth). Copy: "Verifikasi biometrik dilakukan oleh perangkatmu; HabitWealth hanya menerima kunci publik — bukan data wajah atau sidik jarimu." (sesuai arsitektur WebAuthn, tanpa klaim lebih). "Nanti Saja" → badge pengingat di Pengaturan › Akun.
- **FallbackRecovery**: v1.0 = masuk ulang dengan email (lokal). R1.1 = tautan masuk via email (magic link TTL 15 mnt sekali pakai) **BLOCKED sampai SMTP tersedia**; PIN tidak diimplementasikan (tidak menyimpan kredensial mentah di klien).
- **PermissionPrimer**: SATU per momen — Day-1 biometrik (= layar passkey); setelah first completion → notifikasi (sheet "Ingatkan aku besok?"); "Nanti" → `recordPrimerDecision(later)` dan **tidak pernah** memicu dialog sistem; deny → "Tidak apa-apa! Aktifkan nanti di Pengaturan › Privasi."
- **Handoff** ke pengalaman utama: `onboarding_completed {duration_s, skipped}` saat first completion → `#/beranda?first=1` (Beranda menampilkan banner first-use sekali; returning tanpa banner).
- **Crash-recovery** di Splash: bila outbox pending/failed > 0 → notice "Sinkronisasi tertunda, coba otomatis" + "Sync Sekarang" (tidak memblokir).

## Rules
- Auto-logout 30 hari tidak aktif (usulan, OPEN) — diimplementasikan sebagai konstanta `AUTO_LOGOUT_DAYS=30` berlabel OPEN; sesi kedaluwarsa → Splash notice "Sesi berakhir" + Masuk. Re-auth biometrik untuk: lihat saldo lengkap, ubah nominal goal, masuk Data & Privasi/Hapus akun.
- Motion: deeper=slide-up, back=slide-down; sheet consent dari bawah; focus trap + kembali ke pemicu; reduced-motion fade.
- Format id: `Rp10.000`, tanggal `19 Sep 2026`, jam `07.30`.
- Events: `signup_completed, onboarding_completed, permission_granted/denied {scope}`.
- A11y: label SR jelas, target 48dp, teks 200%, non-color cues.
