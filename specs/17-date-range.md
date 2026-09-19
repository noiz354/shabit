# Spec: 17 — Date Range (komponen global, cross-cutting)

> Keputusan locked 19 Sep 2026: default **Bulan berjalan**; preset **30 hari terakhir** sekali tap.

## Objective
Satu pemilih rentang tanggal yang dipakai konsisten oleh Beranda, Habit, Uang, Budget, Insight, dan Analytics — shareable via URL, benar di timezone lokal.

## Komponen `date-range-picker` (bottom-sheet One UI)
- Preset: Hari ini · 7H · **30H** · **Bulan ini (default)** · Bulan lalu · Custom.
- Custom: dua field tanggal native (`<input type=date>`) + validasi (`from ≤ to`, maks 12 bulan — OPEN, perlu konfirmasi produk) + tombol Terapkan/Atur ulang.
- Tampilan: `19–30 Sep 2026` / `Sep 2026` untuk preset bulan; jam `07.30` bila relevan.
- Sheet dari bawah, focus trap, Esc/tombol Tutup sebagai alternatif gesture; reduced-motion fade.

## Semantik waktu (penting, jangan ditebak di kode)
- Timezone: Asia/Jakarta default (ikut profil bila ada); day-boundary 00.00 lokal; streak habit memakai definisi hari yang sama dengan picker.
- Inklusif dua ujung (`from 00:00:00` s/d `to 23:59:59` lokal); kirim ke API sebagai ISO date `YYYY-MM-DD` + `tz=Asia/Jakarta`.
- Travel: bila tz perangkat berubah di tengah range tersimpan, tampilkan badge "Zona waktu berubah — rentang memakai Asia/Jakarta" + tombol sesuaikan.

## State & URL
- Single source: store range `{preset, from, to, tz}`; semua modul subscribe; ganti range → refetch lokal + `setOption` chart + skeleton per panel (bukan reload page).
- Hash: `#/uang?from=2026-09-01&to=2026-09-30&preset=month`; back/forward browser memulihkan range; deep-link notifikasi bawa range relevan.

## Per-modul behavior
- Beranda: ringkasan ikut range + label range jelas ("September 2026").
- Habit: bar 7H default di dalam range; histori terfilter; streak dihitung global (tidak dipotong range) tapi disorot per range.
- Uang/Feed: filter tanggal server (`from/to`) + kategori + sumber; paging cursor; total dihitung dari range.
- Budget: status terhadap bulan berjalan; bila range ≠ bulan ini, tampilkan mode "lihat saja" (read-only badge) agar tidak salah edit.
- Insight: butuh ≥3 bulan untuk scatter; range pendek → bar mingguan + CTA "Perluas ke 3 bulan".

## Empty & stale
- Kosong: "Tidak ada transaksi 1–30 Sep" + CTA (Catat / Geser range / Kembali ke Bulan ini).
- Stale: tiap panel bawa "Terakhir diperbarui: 2 jam lalu"; partial sync → badge per sumber, bukan error global.

## Events
`range_changed {preset, days, module}`, `range_custom_applied {days}`, `range_empty_shown {module, days}`.

## Acceptance
- Ganti preset → semua panel + chart update tanpa reload; URL hash copy-paste memulihkan range yang sama; tz/travel badge muncul benar; empty & stale tampil sesuai kontrak.
