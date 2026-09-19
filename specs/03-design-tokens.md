# Spec: 03 — Design System Baseline (P04, One UI + CSR)

> Source of truth visual. Spec fitur dilarang hardcode warna/spasi/radius/durasi.

## Tokens (light / dark dari DESIGN.md)
| Role | Light | Dark | Pakai |
|---|---|---|---|
| Primary | `#0381FE` | `#0381FE` | FAB, slider, CTA primer |
| PrimaryDark | `#0072DE` | `#3E91FF` | Contained high-emphasis |
| ControlActivated | `#3E91FF` | `#3E91FF` | Switch/checkbox on |
| Background | `#FFFFFF` | `#000000` | App bg |
| Surface | `#F6F6F6` | `#1A1A1A` | Card/focus block T1 |
| SurfaceVariant | `#EEEEEE` | `#2A2A2A` | List grup sekunder |
| SurfaceElevated | `#FFFFFF` | `#252525` | Dialog/sheet |
| Scrim | `rgba(0,0,0,.32)` | `rgba(0,0,0,.64)` | Overlay |
| OnBg / Secondary / Tertiary | `#000/#666/#999` | `#FFF/#999/#666` | Teks |
| Positive/Negative/Warning/Info | `#0AA64E/#D93B30/#E89500/#0072DE` | `#2BD671/#FF6E6E/#FFB74D/#5BA6FF` | Semantik + ikon non-warna |
| Divider | `#E0E0E0` | `#333333` | 1dp |

Tipografi: SamsungOne/One UI Sans → fallback Roboto/sans. Display 34 Bold 1.15; PageTitle 28 Bold 1.20 (viewing area, center); Section 22 Medium; Card 18 Medium; Body 16 Regular 1.50; Body2 14; Caption 12; Button 14 Medium. List title maks 31 char. Skala teks 200% tanpa pecah.

Spacing 8dp base; margin layar min 24dp; padding kartu 16dp. Radius: buttons 18dp, cards/FAB 16dp (FAB squircle 56dp), search/toast 24dp pill, dialog/sheet 26dp top. Elevasi: color-shift + blur+dim diutamakan; single soft shadow saja bila perlu; jangan gabung shadow+dim.

## Layout
Two-zone: viewing (atas, non-interaktif, judul besar center) + interaction (bawah, aksi reachable). Grid: list 1-kol margin 24; card 2-kol gutter 12. Touch target min 48×48dp. Reject/grip zones + cutout awareness.

## Komponen (kontrak: anatomy, varian, states, a11y, batas konten)
Buttons (high 1 per layar; medium `#E0E0E0/#404040`; flat transparent teks Primary; FAB `#0381FE` bottom-right 16dp; icon-btn 48 target/24 ikon), AppBar (collapsed 56dp 18sp Medium left; expanded 152dp 28sp Bold center, collapsible), BottomNav text-only ≤5, BottomBar 2–5 tombol, Dialog bawah (lebar minus 48dp, radius 26 top) vs info center, Cards Surface 16dp flat, Lists 56/72/88dp + sub-header, Search 48dp pill SurfaceVariant, Toast `#323232` 24dp 1 baris ideal/3 maks + Snackbar aksi, Switch 52×32 thumb 28 pill.

Dark/high-contrast/large-text/reduced-motion: token terpisah, bukan inversi. Kontras 4.5:1 teks kecil, 3:1 besar. Status selalu + ikon/teks, bukan warna saja.

## Data viz
Donut/bar/scatter (scatter hanya bila data ≥3 bulan, else bar mingguan). Tap slice → filter feed. SR summary tiap chart. Korelasi ≠ kausalitas disclaimer.

## Appendix JSON
Lihat `specs/04-motion.tokens.json` untuk motion; warna/spasi diekspor sebagai CSS vars di build (meniru `preview.html :root`).

## Validasi
Cek kontras terukur, screenshot light+dark, foldable/DeX reflow, grayscale-mode legibility.
