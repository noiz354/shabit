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

## Rules
- Auto-logout 30 hari tidak aktif (usulan, OPEN). Re-auth biometrik untuk: lihat saldo lengkap, ubah nominal goal, masuk Data & Privasi/Hapus akun.
- Motion: deeper=slide-up, back=slide-down; sheet consent dari bawah; focus trap + kembali ke pemicu; reduced-motion fade.
- Format id: `Rp10.000`, tanggal `19 Sep 2026`, jam `07.30`.
- Events: `signup_completed, onboarding_completed, permission_granted/denied {scope}`.
- A11y: label SR jelas, target 48dp, teks 200%, non-color cues.
