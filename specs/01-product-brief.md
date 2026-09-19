# Spec: 01 — Product Brief (P01)

## Objective
Menyatakan masalah, hipotesis, scope MVP/R1.1/R2 HabitWealth agar semua spec turunannya terkunci. Pengguna: urban Indonesia, hipotesis awal 22–35 thn, sudah pakai mobile banking/e-wallet, butuh dukungan ringan untuk rutin + budgeting. Bahasa UI: Indonesia. Format: `Rp10.000`, `19 Sep 2026`, `07.30`.

## Problem & hypothesis
- Perilaku harian dan pengeluaran terlihat di satu tempat → membantu bertindak, bukan menghakimi.
- Insight gabungan bersifat deskriptif; dilarang klaim kausalitas atau nasihat finansial/medis/investasi (D-07).

## Jobs to be done
1. "Ingatkan dan selesaikan sedikit habit."
2. "Pahami ke mana uang pergi tanpa input berlebih."
3. "Lihat hubungan rutin vs belanja tanpa dihakimi."
4. "Kontrol koneksi, notifikasi, privasi, hapus akun."

## Non-goals (MVP)
Holding dana, inisiasi transfer/auto-debit, investasi/kredit, AI autonomous atas akun finansial, klaim habit menyebabkan outcome finansial.

## Scope table

| Capability | MVP (R1) | R1.1 | R2 |
|---|---|---|---|
| Auth | Email/social sign-in; passkey kondisional | — | — |
| Habit | CRUD, complete/undo, pause/archive, template | Verified health sync (opsional) | — |
| Money | Manual income/expense/transfer, kategori, budget, riwayat | Verified financial sync (kondisional) | — |
| Dashboard | Ringkasan minimal gabungan | Freshness indicator | Insight deskriptif + virtual savings goal |
| Notifikasi | Reminder lokal + preference center | — | — |
| Settings | Privacy controls, export request, delete request, support | — | Premium/share/referral hanya bila tervalidasi |
| Offline | Read + queued writes aksi didukung | Partial sync handling | — |
| A11y/Analytics | WCAG 2.2 AA intent, event plan | — | — |

## Outcome metrics (baseline UNKNOWN sampai riset)
- Activation: install → first habit completion <3 mnt (happy path).
- Engagement: habit_completed/hari, manual transaction/minggu.
- Retention: D7, D30.
- Trust: sync-failed recovery rate, permission-grant rate kontekstual, delete/export success.

## Assumption map
- Desirability: pengguna mau 2 tracker dalam 1 app (ASSUMPTION).
- Viability: freemium hipotesis, pricing OPEN (D-06).
- Feasibility: bank/e-wallet direct connectivity OPEN (D-04); stack final OPEN (D-09).
- Usability: first session 1 success (progress before complexity).
- Compliance: retensi/deletion OPEN (D-08); nama "HabitWealth" working name (D-10).

## Decision backlog (ringkas dari D-01..D-10)
Lihat `HabitWealth_UX_Design_Suite_Reconciled_v5.md §3`. Tidak ada prompt downstream boleh mengubah Open/Validate menjadi fakta.

## Requirement IDs
`HW-PRD-001` dst. Scope acceptance: manual fallback ada untuk setiap value prop; tidak ada Open decision disajikan sebagai fakta.

## Tech Stack (CSR lock)
Vite vanilla + CSS vars One UI + `assets/css/motion.css`. PHP hanya `api/*.php` tipis. Tidak ada Next.js `final/` SSR di shared hosting.

## Commands / Structure / Testing / Boundaries
Mengikuti `00-capability-map.md` + `AGENTS.md`.
