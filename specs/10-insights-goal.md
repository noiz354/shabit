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

## Amandemen T11 (19 Sep 2026) — implementasi MVP lokal (deskriptif, sub-ledger virtual, tanpa money movement)
> Guardrail tetap: tidak ada transfer/custody/auto-debit; semua "alokasi" = catatan lokal (sub-ledger) + `POST /savings-goals/:id/allocate|withdraw` yang oleh server pun hanya dicatat (spec 18). Copy legal wajib tampil di setiap kartu celengan: "Dana di celengan masih berada di rekeningmu. HabitWealth tidak menyimpan/memindahkan uangmu ke pihak ketiga."

### Layar `#/insight` (Beranda › "Insight & Celengan", Pengaturan › baris)
- **InsightSetup** (tampil selama opt-in OFF — default OFF): sumber data yang dipakai (catatan habit + transaksi manual — keduanya bisa dimatikan per sumber), semua dihitung **di perangkat**, ambang informasi (narasi hanya muncul bila ≥7 hari data di tiap sisi), cara menonaktifkan (switch di layar ini), "Sembunyikan insight sensitif" (menyembunyikan angka rupiah di narasi; hanya persentase). Tombol "Aktifkan insight" → `insights.optIn=true`.
- **WeeklyMonthlySummary** (opt-in ON): (1) **narasi otomatis** — rata-rata pengeluaran harian pada hari kamu menyelesaikan ≥1 habit vs hari tanpa habit (90 hari terakhir), mis. "Di hari kamu menyelesaikan habit, pengeluaran rata-rata 20% lebih rendah" + **confidence** (rendah <7 hari per sisi → narasi tidak ditampilkan; sedang <21; cukup ≥21) + disclaimer "Korelasi ≠ sebab-akibat" + tombol **"Kenapa saya melihat ini?"** (sheet: sumber, cara hitung, efek data hilang: hari tanpa catatan dihitung Rp0, cara mematikan); (2) **bar mingguan** 8 pekan terakhir (habit selesai/pekan + pengeluaran/pekan) sebagai bar CSS token-only + **tabel alternatif SR**; (3) **scatter** (X=streak bulanan maks, Y=frekuensi transaksi pengeluaran per bulan sebagai proxy "impulsif" — proxy ini disebutkan eksplisit) **hanya bila rentang data ≥90 hari**, memakai `renderScatterIfNeeded` (ECharts lazy); di bawahnya placeholder jujur "Butuh ≥3 bulan data". Event `insight_viewed{period, has_scatter, confidence}`.
- **VirtualSavingsGoal**: buat celengan (nama, nominal harian default **Rp10.000** dapat diatur, sumber = label rekening manual dimasking, target opsional). **"Tabung hari ini"** → record lokal `pending` → status "Diproses…" → "Berhasil ✓ HH.MM" (foreground; tidak ada eksekusi latar) + **toast undo 5 detik** "Rp10.000 masuk celengan ✓ [Batalkan]" → batal = entri `undone` (+ outbox POST dibatalkan bila belum terkirim, atau `withdraw{reason:"undo"}` bila sudah). Satu alokasi per hari per celengan (dedup tanggal). **Saldo tercatat** = Σ pemasukan − Σ pengeluaran manual − netto celengan; bila nominal harian > saldo tercatat → **peringatan ramah** "Saldo tercatat tidak cukup untuk hari ini. Streak habit-mu tetap aman!" (bukan error merah, tidak menghalangi habit). Total celengan tampil **dimasking** (`getDisplayAmount`, reveal via re-auth). Event `goal_created{daily_bucket}`, `goal_completed{days}` saat target tercapai.
- **WithdrawFromGoal**: "Tarik" → confirm sheet (jumlah default = total) + **re-auth** (sesi 5 mnt) → entri `withdraw` → `POST .../withdraw` → `goal_withdrawn{reason}`. Tetap catatan, bukan transfer.
- **StreakCelebration**: sheet saat streak habit mencapai **7/30/100** (dipicu di HabitToday setelah complete): ringkasan (streak, total celengan dimasking bila ada), **rate-limit 1× per habit per milestone** (prefs), "Jangan tampilkan lagi" (mematikan semua perayaan), "Bagikan" → share card **tanpa nominal** ("konsisten N hari!") → `celebration_shared{streak_day}`; tutup → `celebration_dismissed{streak_day, never_again}`. Motion: `.celebrate` ring 300 ms + haptic success sekali; reduced-motion = fade.
- **Uang › Saldo**: nilai mock Wave 2 diganti **saldo tercatat manual** (label eksplisit "Saldo tercatat (manual)") + baris "Celengan virtual" bila ada.

### Data (klien; skema server final tetap ADR OPEN)
`savings_goals` (IDB v2): `{id, name, daily_amount, source_ref, target_amount?, status: active|paused|completed, ledger: [{id, kind: allocate|withdraw, amount, date, at, status: pending|done|undone, done_at?, reason?}], created_at, updated_at}`; total = Σ allocate(done) − Σ withdraw(done). Prefs `insights: {optIn:false, sources:{habits:true, transactions:true}, hideSensitive:false, celebrations:{never:false, shown:{}}}`.

### Acceptance T11
Opt-in default OFF (setup tampil, tidak ada angka); narasi hanya bila ≥7 hari tiap sisi + disclaimer + "Kenapa"; scatter hanya ≥90 hari; alokasi 1×/hari, pending→done, undo ≤5 dtk membatalkan, >5 dtk ditolak; saldo tercatat kurang → peringatan ramah tanpa entri; tarik butuh re-auth; perayaan 1× per habit/milestone dan bisa dimatikan; share card tanpa nominal; semua event tanpa nominal/judul habit.
