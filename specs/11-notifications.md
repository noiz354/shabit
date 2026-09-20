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

## Amandemen T12 (19 Sep 2026) — MVP lokal, tanpa Web Push (ADR-0002 = R1.1)
> Prinsip: **Kotak Masuk in-app = channel utama MVP**; notifikasi OS lokal (SW `showNotification`) hanya pelengkap saat izin diberikan. Pengingat dievaluasi saat app foreground + `setTimeout` selagi halaman hidup (spec 15) — tidak ada klaim "terkirim saat app tertutup" sebelum Web Push R1.1.

### Layar
- **NotificationPreferences** `#/pengaturan/notifikasi` (deep-link `habitwealth://settings/notifications`): master "Notifikasi"; kategori `habit` (Pengingat habit), `budget` (Peringatan budget), `streak` (Streak & perayaan), `weekly` (Ringkasan mingguan), `promo` (Promosi — **default OFF**, terpisah), `system` (Keamanan/operasional — **selalu ON, tidak bisa dimatikan**, dijelaskan); channel `push` (status izin OS: granted/denied/prompt + aksi kontekstual; denied → fallback in-app + cara mengaktifkan, tanpa dialog sistem), `inApp` (selalu ON), `email` ("Belum tersedia" — SMTP BLOCKED, ditampilkan nonaktif, tidak disembunyikan); **Quiet Hours** default 22.00–07.00 **dalam zona waktu user** (`prefs.tz`, tampil + tombol "Ikuti zona waktu perangkat"); statistik "Terkirim hari ini: n" (**cap diukur, belum dibatasi — OPEN**); "Uji notifikasi" (kategori system → Kotak Masuk + OS bila granted). Perubahan disimpan lokal seketika + `PATCH /notification-preferences` lewat outbox (tanpa PII).
- **NotificationInbox** `#/notifikasi` (Beranda › ikon lonceng dengan jumlah belum dibaca; Pengaturan › "Kotak masuk"): tab **Belum dibaca (n)** / **Arsip** (`role=tablist`), grup tanggal (Hari ini / Kemarin / tanggal), item = judul ≤40 + isi + waktu + chip kategori; aksi **Buka** (deep-link → `read_at` + `notification_opened`) dan **Arsip** tombol (non-gesture) + swipe kiri (`makeListSwipeable`) → `archived_at` + `notification_dismissed`; "Tandai semua dibaca"; empty state ramah. Badge aplikasi (Badging API) = jumlah belum dibaca yang sudah due.

### Mesin (`src/notify.js`)
- Penyimpanan: IndexedDB store `inbox` (DB v3; v-guard) `{id, template, category, priority, title, body, deep_link, created_at, deliver_after, delivered_at, read_at, archived_at, expires_at, channel}`; impor sekali dari LS `hw:notif:inbox:v1` lama.
- **Dedup via id deterministik** `template[:scope]:periode` (mis. `habit_morning:2026-09-19`, `budget_80:Kopi:2026-09`, `streak_7:<habit_id>`) → `put` idempoten; kirim ulang tidak menggandakan.
- **Quiet Hours tz-user**: jam sekarang dihitung dengan `Intl.DateTimeFormat(..., {timeZone: prefs.tz})` (bukan jam server/perangkat); rentang melewati tengah malam didukung; item non-`system` yang jatuh di jam tenang **ditunda** (`deliver_after` = akhir jam tenang) — tidak tampil di Belum dibaca sebelum due; pengingat yang sudah kedaluwarsa sebelum jam tenang berakhir (mis. pengingat sore) **tidak dibuat** (`QUIET_EXPIRED`) agar tidak ada konten basi keesokan pagi. `system` tidak pernah ditunda/dibisukan (security notices operasional).
- **Prioritas** `budget(3) > habit(2) > streak/celebration(1) > weekly/promo(0)`: urutan Kotak Masuk; per evaluasi hanya item prioritas tertinggi yang boleh memicu notifikasi OS (anti-fatigue), sisanya in-app.
- **Expiry** per template → lewat = otomatis arsip (stale tidak mengganggu). Kategori mute → tidak dibuat sama sekali (bukan disembunyikan).
- **Trigger**: `streak_7/30` saat `completeHabit`; `budget_80/100` saat transaksi pengeluaran melintasi ambang (sekali per kategori/bulan) + event `budget_threshold_hit{category,pct,month}`; `habit_morning` (≥07.00, ada habit aktif, belum ada yang selesai hari ini), `habit_evening` (≥18.00, masih ada yang belum selesai), `weekly_summary` (Senin ≥08.00, sekali per pekan ISO) dievaluasi saat foreground/visibility + timer ke batas jam berikutnya selagi halaman hidup; `goal_success/missed` **terdaftar tetapi tidak pernah dipicu sampai T11** (virtual goal belum ada).
- **Events** (spec 05): `notification_opened/dismissed {id: template, category, deep_link}` — hanya saat user benar-benar tap/arsip (bukan saat tampil; bug lama diperbaiki). Klik notifikasi OS ditangani `public/sw-notify.js` (`importScripts` workbox): fokus/buka klien + `postMessage` → app tandai dibaca + event.
- **Lock-screen**: template tidak memuat nominal, saldo, atau judul habit; hanya kategori/persen.

### Matriks template (≤40 karakter, ID, ramah, tanpa guilt)
| id | Trigger | Eligibility | Prioritas | Copy (judul) | Deep-link | Expiry | Cap | Kontrol |
|---|---|---|---|---|---|---|---|---|
| habit_morning | 07.00 tz-user | ≥1 habit aktif, 0 selesai hari ini | habit | "Pagi! Satu habit kecil hari ini?" | `#/habit` | 18.00 | 1/hari | kategori habit |
| habit_evening | 18.00 tz-user | masih ada habit belum selesai | habit | "Masih ada habit yang bisa dicentang" | `#/habit` | 23.59 | 1/hari | kategori habit |
| streak_7 | streak = 7 | — | celebration | "Streak 7 hari! Konsisten banget 🎉" | `#/habit/:id` | 7 hari | 1/habit | kategori streak |
| streak_30 | streak = 30 | — | celebration | "30 hari beruntun. Luar biasa! 🎉" | `#/habit/:id` | 7 hari | 1/habit | kategori streak |
| budget_80 | belanja melintasi 80% | budget kategori bulan ini | budget | "Budget {kategori} sudah 80%" | `#/uang?cat=` | akhir bulan | 1/kategori/bulan | kategori budget |
| budget_100 | melintasi 100% | idem | budget | "Budget {kategori} tercapai 100%" | `#/uang?cat=` | akhir bulan | 1/kategori/bulan | kategori budget |
| goal_success | T11 | — | celebration | "Celengan minggu ini tercapai ✓" | `#/insight` | 7 hari | 1/pekan | kategori streak |
| goal_missed | T11 | — | weekly | "Sayang, celengan pekan ini terlewat" | `#/insight` | 7 hari | 1/pekan | kategori weekly |
| weekly_summary | Senin 08.00 | ada data ≥1 pekan | weekly | "Ringkasan minggumu sudah siap" | `#/beranda?preset=7d` | 7 hari | 1/pekan | kategori weekly |
| system | operasional | — | tertinggi, tak bisa ditunda | bebas (≤40) | kontekstual | 7 hari | — | tidak bisa dimatikan |

### Acceptance T12
- Quiet Hours 22–07 di `Asia/Jakarta` menunda item saat jam perangkat berbeda (tz-user, bukan device); `system` tetap lewat. Trigger ganda → 1 item (dedup). 80%/100% masing-masing sekali per kategori/bulan. Mute kategori → 0 item. Expired → arsip otomatis. Tab/arsip/buka memicu event yang benar tanpa PII. Email nonaktif jujur. Semua copy ≤40 karakter dan tanpa "Rp".
