# Spec: 14 — QA, Traceability & Go/No-Go (P14-P15)

## Traceability (ringkas; matriks penuh di QA run)
HW-PRD→HomeDashboard; HW-HAB→HabitToday/Editor + `habit_completed`; HW-MNY→MoneyOverview/Feed/Add + `transaction_created`; HW-DAT→Connect/Reconnect + `sync_*`; HW-NTF→Prefs/Inbox + `notification_*`; HW-SET→Export/Delete + `export/deletion_requested`.

## Acceptance Given/When/Then (contoh)
- First value: Given fresh install When signup dasar + buat 1 habit Then complete <3mnt + dashboard sederhana.
- Masking: Given overview When dibuka Then saldo `Rp••••` sampai re-auth.
- Offline: Given tanpa sinyal When buka Money Then data terakhir + timestamp + Coba Sync, bukan blank.
- Partial: Given 1 dari 2 sumber gagal Then badge per sumber, bukan error global.
- Motion: Given reduce-motion When navigasi Then fade 150ms, tanpa travel/parallax.

## Test matrix
Happy, validasi, empty, offline, stale, partial, denied, expired-auth, a11y (SR/keyboard/200%/kontras), lokalisasi (`Rp10.000`), privasi (tanpa PII di log), security (re-auth destruktif), perf (LCP/CLS di device), recovery (pending queue retry tanpa double).

## Kill criteria (P00 §10)
Invent provider/legal/evidence/pricing; butuh integrasi untuk basic use; real money movement tanpa model disetujui; expose finansial default; hilang denied/stale/offline/recovery; shame/penalty/forced consent; klaim kausalitas; screen/event/data baru tanpa revisi upstream; klaim compliance/PASS tanpa bukti; tak tertrace ke req+fase.

## Go/No-Go checklist
Evidence link + owner + status (NOT TESTED/BLOCKED/FAIL/PASS) untuk tiap P0. Sign-off: Product, Design, Tech, QA, Privacy/Security, Legal dalam scope masing-masing. Store package (P15) hanya dari build terverifikasi + demo data fiktif.
