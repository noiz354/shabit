# Spec: 11 — Notifications & Re-engagement (P11)

## Objective
Retensi tanpa fatigue. User control penuh; marketing terpisah opsional; security notices tidak suppressible bila operasional.

## Screens
- NotificationPreferences: granular per kategori (Habit Reminder, Budget Alert, Streak, Weekly Report, Promosi opsional) + channel push/in-app/email + Quiet Hours default 22.00–07.00 mengikuti timezone user (bukan server).
- InAppInbox (bila justified): tab Belum Dibaca/Arsip, grup tanggal, dark spec, swipe + tombol arsip (alternatif non-gesture).

## Templates (≤40 karakter ID, ramah, tanpa guilt/shame, tanpa nominal sensitif di lock-screen)
1. Habit pagi 07.00 → `#/habit` 2. Habit sore 18.00 bila belum complete 3. Streak 7/30 4. Budget 80% 5. Budget 100% 6. Goal success 7. Goal missed ("Sayang, ...") 8. Weekly summary.
Kolom: trigger, eligibility, prioritas (budget>habit>celebration), channel, copy, cap, suppress, deep-link `habitwealth://`, expiry, event, kontrol.

## Rules
- Cap: frekuensi diukur, tidak ada angka "5/hari" final sebelum riset (OPEN). Prioritas + Quiet Hours + per-kategori mute/dismiss.
- Denied OS channel → fallback in-app + primer ulang kontekstual. Travel → timezone user. Duplikat/stale/opened-di-device-lain → dedup via id.
- Motion: toast 1 baris ideal/3 maks `#323232` 24dp; snackbar aksi kanan; reduced-motion fade.
- Events: `notification_opened/dismissed {id, category, deep_link}`.
- A11y: tidak ada konten sensitif di lock-screen; label SR jelas.
