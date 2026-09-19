# Spec: 15 — PWA (installable, offline, CSR + shared hosting)

> Keputusan locked 19 Sep 2026: MVP = notifikasi lokal; Web Push + VAPID didesain untuk R1.1 (lihat specs/18).

## Objective
Aplikasi terinstal (standalone), tetap berguna offline penuh, update terkendali — semua dari file statis tanpa Node runtime.

## Manifest (`public_html/manifest.webmanifest`)
- `name: HabitWealth`, `short_name: HabitWealth`, `lang: id`, `dir: ltr`.
- `display: standalone`, `orientation: portrait`, `start_url: ./?source=pwa`, `scope: ./`.
- `theme_color: #0381FE`, `background_color: #FFFFFF` (dark: `#000000` via `theme_color` media — catat keterbatasan).
- Icons: squircle One UI 192 + 512 (maskable + any), SVG favicon fallback.
- `shortcuts`: "Habit hari ini" → `#/habit`; "Catat pengeluaran" → `#/uang/add`; masing-masing bawa ikon.
- `description` ID satu kalimat; `categories: [finance, lifestyle]`.

## Service worker (`public_html/sw.js`, scope root)
- Precached app shell (build-time inject): `index.html`, CSS/JS ber-hash, `motion.css`, ikon, `offline.html`.
- Runtime: navigasi → network-first dengan fallback cache/`offline.html`; `assets/*` immutable → cache-first; `api/*` → network-only + antre outbox bila gagal (jangan cache respons mutasi).
- Update flow: `skipWaiting` HANYA setelah user tap "Muat versi baru" (toast, bukan reload diam-diam); versi tampil di Tentang.
- `.htaccess`: `Service-Worker-Allowed: /`, MIME `application/manifest+json`, `no-cache` untuk `sw.js` + `manifest`.

## Install prompt
- Tunda `beforeinstallprompt` sampai momen bernilai (setelah first habit completion); tampilkan bottom-sheet One UI "Pasang aplikasi?" (CTA Pasang / Nanti). Jangan tampilkan di landing dingin.
- iOS: instruksi manual Bagikan → "Add to Home Screen" (deteksi `navigator.standalone`).
- Event: `pwa_installed {source: prompt|manual}`, `pwa_dismissed`.

## Offline UX
- Banner persisten non-merah "Kamu offline — perubahan disimpan, terkirim otomatis" + ikon; tiap perubahan antre di outbox IndexedDB (idempotency key per op).
- Flush saat `online` + saat foreground: berurutan, backoff, konflik keep-both; badge per item (terkirim/menunggu/gagal).
- Jangan tampilkan layar kosong: data terakhir + "Terakhir diperbarui: ..." selalu ada.

## Notifikasi MVP (lokal)
- Izin diminta kontekstual (setelah first habit), bukan saat install. Reminder dievaluasi saat app foreground + `setTimeout`/terjadwal ulang tiap buka; tidak ada background sync diam-diam di MVP.
- R1.1: Web Push (kontrak di specs/18): VAPID pair via PHP openssl, `api/v1/push/subscriptions`, payload terenkripsi, Quiet Hours 22.00–07.00 tz-user, kategori bisa di-mute.

## A11y/motion
- Sheet install dari bawah + focus trap + kembali ke pemicu; reduced-motion fade; target 48dp; status offline non-warna (ikon + teks).

## Acceptance
- Lighthouse PWA: installable + `start_url` + ikon maskable + SW offline PASS (diukur via CDP 9227).
- Matikan jaringan → dashboard + habit complete + catat transaksi tetap jalan, antre, lalu flush otomatis saat online tanpa duplikat.
