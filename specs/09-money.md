# Spec: 09 — Money Experience (P09, manual baseline; sync kondisional)

## Objective
Catat manual mudah; sync bank/e-wallet hanya bila partner verified tersedia (D-04 OPEN). Jangan janjikan coverage/OAuth/read-only sebelum verifikasi.

## Screens
- FinanceOverview: total saldo default MASKED `Rp••••••••`, tap mata → re-auth biometrik → reveal. Cashflow bulan ini + donut kategori (tap slice → filter feed). Freshness label "Terakhir diperbarui: 2 jam lalu".
- TransactionFeed: filter tanggal/kategori/sumber + search teks global (kontrak penuh di `specs/19-search.md`: `q`, highlight, history lokal); ikon pensil per baris untuk koreksi kategori; toast belajar "Kami akan belajar dari koreksimu" bila ≥3× sama.
- TransactionDetailRecategorize: ubah kategori, split, refund, internal transfer handling, unknown category state.
- AddRecord: income/expense/transfer manual; keyboard push-up; validasi; confirm destruktif untuk hapus.
- BudgetSetupStatus: threshold 80%/100% → modal BudgetAlert (bukan toast untuk kritikal).
- ConnectAccount/ReconnectAccount (R1.1 CONDITIONAL): pilih bank/e-wallet Indonesia (BCA/Mandiri/BNI/BRI/CIMB/GoPay/OVO/Dana/ShopeePay sebagai contoh cakupan yang HARUS diverifikasi). Masking `BCA •••• 4821`, badge akses + gembok hanya bila scope terverifikasi. Token-expired → overlay + banner + CTA Hubungkan Ulang + Nanti (timestamp merah bila >14 hari — threshold OPEN).

## Rules
- Pending vs posted, duplikat (same amount+date+merchant → gabung usulan + user confirm), cash, multi-currency = future scope (toggle opsional).
- Offline edits → queued + pending queue + retry; crash saat sync → buka ulang tampilkan "Saldo sedang diverifikasi..." skeleton, bukan saldo basi.
- Partial sync: badge per rekening, bukan error global. Provider outage: banner + data terakhir + timestamp.
- Format: `Rp10.000` titik ribuan; tanggal `17 Jun 2025` singkat.
- Motion: list→detail slide-up; sheet connect dari bawah; skeleton shimmer; reduced-motion fade.
- Events: `transaction_created, category_corrected, budget_threshold_hit, connection_*, sync_failed/recovered`.
- A11y/privacy: status non-warna, SR summary chart, masking di screenshot/notifikasi/analytics.
