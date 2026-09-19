# Spec: 10 — Combined Insights & Virtual Savings Goal (P10, R2)

> Guardrail D-05/D-07: tanpa money movement/custody/auto-debit; deskriptif saja; korelasi ≠ kausalitas.

## Objective
Opt-in insight rutin-vs-belanja + virtual goal yang mencatat intended allocation, BUKAN memindahkan uang. Copy legal: "Dana di celengan masih berada di rekeningmu. HabitWealth tidak menyimpan/memindahkan uangmu ke pihak ketiga."

## Screens
- InsightSetup (opt-in, default OFF): pilih sumber data, threshold info, cara menonaktifkan + hide insight sensitif.
- WeeklyMonthlySummary: bar mingguan bila data <3 bulan; scatter (X=streak, Y=pengeluaran impulsif) hanya bila ≥3 bulan. Narasi otomatis mis. "Bulan ini kamu 20% lebih hemat saat streak di atas 14 hari" + disclaimer korelasi ≠ sebab-akibat + "Why am I seeing this?" + confidence/missing-data effect.
- VirtualSavingsGoal: nominal harian default Rp10.000 (dapat diatur), sumber + tujuan virtual (sub-ledger, bukan rekening terpisah). Pending queue: buat record lokal → eksekusi catat saat foreground+stabil → status "Diproses...→Berhasil ✓ + timestamp". Undo toast 5 dtk "Rp10.000 masuk celengan ✓ [Batalkan]". Saldo kurang → warning ramah "Saldo tidak cukup... Streak habit-mu tetap aman!" bukan error merah.
- WithdrawFromGoal: tarik alokasi virtual → catat, confirm + re-auth biometrik.
- StreakCelebration: modal hari 7/30/100 + ringkasan terkumpul, rate-limit 1×/milestone, opsi "Jangan tampilkan lagi". Share card TANPA nominal spesifik ("konsisten 30 hari!").

## Rules
- Jika money movement nyata pernah diusulkan → STOP, list keputusan legal/partner/otorisasi/rekonsiliasi/sengketa/idempotency/recovery.
- Motion: celebration confetti 300ms + haptic success sekali; reduced-motion fade.
- A11y: SR summary tiap chart + tabel alternatif.
- Events: `insight_viewed, goal_created/completed/withdrawn, celebration_shared/dismissed`.
