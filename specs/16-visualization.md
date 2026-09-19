# Spec: 16 — Full Visualization (ECharts, customizable)

> Keputusan locked 19 Sep 2026: ECharts (paling customizable). Syarat budget: `echarts/core` + impor per komponen, lazy-load modul berat, ring/streak kecil hand-rolled SVG.

## Objective
Setiap angka penting punya visual yang bisa di-tap/filter, bisa dibaca screen reader, dan tidak jebol budget JS CSR (<200KB gzip awal, diukur).

## Budget & loading strategy
- Awal: hanya `echarts/core` + Bar/Pie + Tooltip yang dipakai Beranda/Uang. Modul Scatter/Grid-Polar/Toolbox di-split dan lazy (`import()`) saat Insight R2 dibuka.
- Ring progres + streak dots: SVG inline hand-rolled (bukan ECharts) — murah + gampang dianimasikan via `motion.css`.
- Skeleton shimmer dulu, chart render setelah data siap; `AsyncState` bukan boolean; reduced-motion → tanpa animasi seri (`animation: false`) + fade.

## Katalog chart (tipe, interaksi, state)
| Layar | Chart | Interaksi | Aturan |
|---|---|---|---|
| Beranda | Ring habit hari ini (SVG) | Tap → `#/habit` | Warna Primary `#0381FE` + label % + SR "3 dari 5 habit selesai" |
| HabitToday | Bar 7 hari (ECharts) | Tap bar → filter histori hari itu | Sumbu X tgl ID singkat; empty → template CTA |
| HabitDetail | Heatmap/kalender streak (ECharts heatmap, lazy bila berat) | Tap sel → entries hari itu | Hüjau + pola/angka, bukan warna saja; day-boundary Asia/Jakarta |
| MoneyOverview | Donut kategori (Pie) | Tap slice → filter `#/uang?cat=` | Legend + %; mask nominal sampai re-auth |
| MoneyOverview | Cashflow bar in vs out | Toggle range (lihat specs/17) | Positif `#0AA64E`/negatif `#D93B30` + label Rp |
| Budget | Progress bar per budget | Tap → BudgetSetup | Threshold 80%/100% + ikon warning |
| Insight (R2) | Bar mingguan default; Scatter streak-vs-impulsif bila data ≥3 bulan | Tap titik → minggu terkait | Disclaimer korelasi≠kausalitas + "Kenapa saya lihat ini?" + confidence |

## Kontrak ECharts (tokens, bukan hardcode)
- Palette dari `specs/03`: primary, positive, negative, warning, info; font family sistem; radius kartu 16; tooltip One UI (SurfaceElevated, radius 16, teks 14).
- Locale ID: bulan/hari singkat Indonesia; angka `7.230`; rupiah `Rp10.000`.
- Interaksi global: `dispatchAction` untuk highlight terhubung (donut↔feed); resize observer per container; jangan render chart di tab tersembunyi (defer sampai visible).

## Aksesibilitas (wajib per chart)
- `aria-label` ringkas + `<details>` tabel data alternatif; keyboard: chart focusable + panah pindah titik + Enter pilih (atau tombol "Lihat data tabel" sebagai alternatif non-gesture).
- Kontras seri ≥4.5:1 teks kecil; pola/ikon pendamping warna; uji grayscale.

## Date-range hookup
Semua chart tunduk pada range global (specs/17): ganti range → `setOption` ulang + loading lokal + empty-state ("Tidak ada data 1–30 Sep" + CTA).

## Events
`chart_viewed {chart, range}`, `chart_slice_selected {chart, key}`, `chart_empty_shown {chart, range}`.

## Acceptance
- Tap donut slice → feed terfilter (deep-link hash konsisten); SR baca ringkasan tiap chart; reduced-motion tanpa animasi seri; bundle awal <200KB gzip (`npm run build`); stabil di HP nyata, bukan cuma emulator.
