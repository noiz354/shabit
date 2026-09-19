# Spec: 19 — Global Search (cross-modul)

> Keputusan locked 19 Sep 2026: scope GLOBAL (habit + transaksi + budget + bantuan); riwayat lokal max 5 + bisa dihapus; field: semuanya.

## Objective
Satu search box yang mencari di semua modul, bekerja offline, menghormati masking, dan mengumumkan hasil ke screen reader.

## Entry & layout (One UI)
- Ikon search di app-bar tiap tab + shortcut keyboard `/` (desktop) — fokus ke box. Search box 48dp pill SurfaceVariant, hint Tertiary (lihat specs/03).
- Hasil dalam bottom-sheet full (mobile) / panel kanan (≥600dp): tab **Semua | Habit | Uang | Budget | Bantuan** + count per tab. Tap hasil → deep-link hash modul (`#/habit/:id`, `#/uang/:id`, dsb, bawa `from/to` bila relevan).
- Motion: sheet dari bawah + focus trap + kembali ke pemicu; keyboard muncul → CTA sticky + konten push-up (ikut specs/08); reduced-motion fade.

## Query behavior
- Debounce 250ms; min 2 karakter (di bawah itu tampilkan riwayat + saran, bukan hasil).
- Ranking: exact match > prefix > substring; match nominal bila digit `q` cocok dengan angka (abaikan titik: "10000" cocok `Rp10.000`); terbaru dulu bila skor seri.
- Field per scope: Habit (judul, catatan, kategori, schedule label); Uang (nominal, catatan, kategori, sumber masked `BCA •••• 4821`, merchant R1.1 bila ada); Budget (nama kategori, bulan); Bantuan (judul + snippet FAQ, maks 2 baris).
- Highlight cocok dengan `<mark>`; masking tetap berlaku (saldo penuh tidak pernah muncul di hasil tanpa re-auth sebelumnya di sesi ini).

## History (lokal saja)
- Max 5 query terakhir, simpan di localStorage/IndexedDB perangkat; hapus per item (ikon ×) + "Hapus semua" (confirm ringan, bukan destruktif permanen).
- History TIDAK di-sync ke server, TIDAK masuk analytics/log (atau hash bila agregat dibutuhkan kelak — OPEN).
- Kosong: tampilkan 5 saran cepat ("kopi", "listrik", ...) dari kategori populer lokal + CTA ke modul.

## Empty & error
- Nol hasil: "Tidak ada hasil untuk 'xyz'" + tombol "Hapus pencarian" + saran scope lain ("Coba di tab Uang").
- Offline: search jalan atas index lokal + badge "Hasil offline — data sampai <ts>"; sync ulang memperbarui index di background.

## Offline index (CSR, tanpa lib FTS berat)
- IndexedDB store `search_index`: token lowercase per field (split spasi + edge-ngram prefix max 8 char untuk judul/nama; angka dinormalisasi tanpa titik).
- Update inkremental tiap mutasi lokal + rebuild penuh setelah sync; batasi ~2000 dokumen terbaru (cursor) agar ringan di HP.

## Aksesibilitas
- `role=searchbox` + `aria-controls` hasil; `aria-live=polite` umumkan "N hasil untuk 'kopi'" (debounced, bukan per keystroke); Esc menutup + fokus kembali; semua gestur ada tombol.
- Kontras hint ≥4.5:1; teks 200% tanpa pecah; `<mark>` + underline (non-warna).

## Events (tanpa query mentah)
`search_opened {entry}`, `search_executed {scope, result_count, char_len, offline}`, `search_result_opened {scope}`, `search_history_cleared {}`. Nilai `q` TIDAK dikirim (PII potensial).

## Acceptance
- "kopi" → hasil Habit+Uang+Bantuan ter-ranking benar + highlight; <2 char → history; hapus 1/semua bekerja; offline tetap hasil + badge; SR umumkan count sekali; Esc fokus kembali; tanpa `q` mentah di network/log.
