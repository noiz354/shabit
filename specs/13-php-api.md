# Spec: 13 — PHP API & Engineering Handoff (P13, CSR + shared hosting)

## Objective
CSR static + PHP tipis yang lolos limit 40-shared (no Node, no daemon, no SSR).

## Deploy
- Build lokal: `npm run build` → `dist/` → FTP ke `public_html/`. `.htaccess`: SPA fallback ke `index.html`, gzip/cache `assets/*` immutable, `api/*` no-cache, `Service-Worker-Allowed: /`, MIME manifest.
- Struktur: `public_html/index.html, manifest.webmanifest, sw.js, offline.html, assets/, api/v1/*.php, .htaccess`. ECharts via `echarts/core` impor per komponen + lazy scatter (lihat specs/16).

## Kontrak penuh
Lihat `specs/18-api-design.md` (kanonis endpoint `/api/v1/*`, session-cookie saja, idempotency, paging `from/to`, push/VAPID R1.1). File ini hanya handoff deploy+NFR.

## API semantik (idempotent, envelope `{ok,data,error{code,message}}`)
- `GET api/health.php` → `{ok, time}`.
- Habits/transactions CRUD manual MVP bisa local-only; bila PHP dipakai: PDO prepared, validasi server, `Idempotency-Key` header untuk queued writes, error `VALIDATION/OFFLINE_QUEUED/CONFLICT`.
- Sync kondisional R1.1: `SyncRun {status, last_success_ts}`; partial per sumber; reconnect flow; tanpa simpan raw credential.
- Offline/cache: IndexedDB/localStorage source-of-truth; queued ops flush berurutan; konflik last-write + keep-both.

## NFR (diukur, bukan janji)
- Perf budget (usulan diuji di HP nyata + throttled 4G): LCP <2.5s, JS awal <200KB gzip, CLS <0.1. `npm run build` (Vite info ukuran + gzip).
- Observability: log PHP redacted, audit events tanpa PII, `X-Request-Id`.
- Security: session cookie HttpOnly/Secure/SameSite, CSRF token untuk mutasi cookie, rate-limit sederhana, `Content-Security-Policy` ketat untuk CSR.
- A11y checklist: focus order, label, kontras terukur, 200% teks, reduced-motion.

## ADR masih OPEN
Stack final, DB skema final, vendor analytics, provider bank/health, retention — semua butuh ADR + owner.
