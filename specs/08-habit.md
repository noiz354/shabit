# Spec: 08 — Habit Experience (P08, manual-first)

## Objective
Today list → create → complete/undo dalam <1 mnt, berguna penuh tanpa integrasi.

## Screens
- HabitToday (first-use vs returning dibedakan): progress ring + streak counter; search teks global ikut `specs/19-search.md` (judul/catatan/kategori); contoh dummy "Langkah kaki — 7.230/10.000 dari Google Fit" hanya di R1.1. Empty state: 3 template ("Minum 8 gelas air", "Jalan 10.000 langkah", "Baca 20 halaman") + Tambah Cepat.
- HabitCreateEdit: goal type (count/duration/check), schedule hari+jam, reminder opsional + Smart Reminder (AI opsional, default OFF).
- HabitDetailHistory: ring expand (langkah per jam bila R1.1), kalender, edit koreksi, pause/archive/delete (confirm destruktif).
- HabitReminderSetup + StreakFreeze (maks 2×/bulan usulan, OPEN): konfirmasi freeze agar sakit/libur tidak reset.
- IntegrationHubHealth (CONDITIONAL R1.1): connect/disconnect, last sync, status hijau/kuning/merah + ikon, manual override policy, dedup, partial sync badge per sumber, retry, revoke.

## Interaction (tanpa sembunyikan aksi penting di balik gesture)
- Tap ✓ = complete (haptic heavy + confetti 300ms, reduced-motion: fade saja). Long-press = menu (Edit/Hapus/Reorder/Freeze) + alternatif tombol "...". Swipe kiri = Tunda besok (1×/hari) + tombol terlihat. Pull-to-refresh = sync kondisional, cooldown 30 dtk + toast "Data baru saja diperbarui".
- Keyboard: CTA Simpan sticky; auto-save draft.
- Sync: foreground 15 mnt (usulan, ukur baterai); tanpa background diam-diam.

## Semantics
Streak: day-boundary Asia/Jakarta default, late entry sampai 23.59+ toleransi OPEN, missed day = "missed opportunity" ("Sayang, kamu melewatkan tabungan Rp10.000 hari ini") — tanpa denda/guilt. Konflik multi-device: tampilkan kedua versi → user pilih. Timezone travel: bekukan definisi hari saat perjalanan, jelaskan.

## States
first-use/returning/loading(skeleton)/empty/partial/offline(stale+timestamp+Coba Sync)/denied/expired/retry/success. Token expired → banner reconnect, bukan data kosong.

## Motion/a11y/analytics
Shared-element `habit-card→habit-detail` pertahankan identity; app bar snap; `AsyncState` bukan boolean; SR umumkan nilai throttled; events `habit_completed, habit_skipped_day`.
