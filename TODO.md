# TODO — HabitWealth OneUI CSR (Addy Osmani TASKS phase)

> Setiap tugas: Acceptance + Verify + Files. Maks ~5 files per tugas. Urut dependensi.

## P0 — Fondasi (Gate A/B)
- [x] T1: Unzip referensi ke `reference/oneui/` + diff DESIGN.md — Done 19 Sep 2026: 296 files; LOCAL 542 vs REF 509 baris, dokumen berbeda; LOCAL kanonis.
- [x] T2–T4 (scaffold, 20 Sep 2026): `package.json` pin (preact 10.24/navigo 8.11/idb-keyval/dayjs/echarts 5.5/vite 6/pwa 0.21/vitest) + shell + router hash 4 tab + tokens.css + `src/api|store` stub — Build: JS 27.48KB/gzip 10.46KB (budget 200KB aman); CDP smoke: title + 4 tabs + h1 OK. Sisa T2–T4 (isi token preview, motion penuh, app-bar snap) ikut sesi fitur.
- [ ] T3 (sisa): Motion penuh + HabitToday skeleton isi — nav deeper=up/back=down + sheet + skeleton — Files: `src/`, `assets/css/motion.css`
- [ ] T4 (sisa): app-bar snap expand/collapse + peer-horizontal — Files: `src/router.js`, `src/styles/app.css`

## P0 — MVP fitur
- [ ] T5: AuthHub+Consent+Primer (tanpa backend) — Acceptance: first habit <3mnt, Nanti Saja tersedia — Files: `specs/07*`
- [ ] T6: HabitToday/Editor/Detail + IndexedDB queue — Acceptance: CRUD+undo+template — Files: `assets/js/habit.js`
- [ ] T7: MoneyOverview/Feed/Add + masking+re-auth mock — Acceptance: `Rp••••` default — Files: `assets/js/money.js`
- [ ] T8: Settings/Export/Delete mock + Help — Acceptance: confirm destruktif + re-auth — Files: `assets/js/settings.js`
- [x] T9 (scaffold, 20 Sep 2026): `api/v1/index.php` front-controller + lib (response/db/validate) + `.htaccess` — `php -l` bersih; smoke: health `{ok,php,time}` + 404 envelope + request_id OK. Sisa (endpoint bisnis) = T18.

## P1 — PWA / Visual / Range / API (locked 19 Sep 2026)
- [ ] T15: PWA shell — manifest + sw.js + offline.html + install sheet post-first-habit — Acceptance: Lighthouse PWA installable PASS, offline full flow + flush tanpa duplikat — Verify: CDP 9227 offline throttle — Files: `public_html/manifest.webmanifest`, `public_html/sw.js`, `public_html/offline.html`
- [ ] T16: Visualization ECharts — core+Bar/Pie, ring/streak SVG, donut-tap-filter, lazy scatter — Acceptance: bundle awal <200KB gzip, tiap chart ada SR-summary — Verify: `vite build --report` + SR check — Files: `assets/js/charts.js`, spec 16
- [ ] T17: Date-range picker global — preset + custom + hash state — Acceptance: ganti range update semua panel tanpa reload, URL restore — Files: `assets/js/range.js`
- [ ] T18: API v1 PHP — auth/habits/entries/transactions/budgets/goals/summary/export/delete + idempotency — Acceptance: kontrak spec 18 lolos smoke `php -S` — Verify: curl tiap endpoint — Files: `public_html/api/v1/*.php` (push/VAPID kontrak saja, implementasi R1.1)
- [ ] T19: Search global — box + 4 scope tabs + ranking + history max-5 lokal + offline index — Acceptance: "kopi" multi-scope + highlight, hapus 1/semua, offline + badge, SR announce sekali — Verify: CDP 9227 (hasil/kosong/history/offline/SR) — Files: `assets/js/search.js`, `specs/19-search.md`

## P1 — R1.1/R2 (CONDITIONAL, butuh verifikasi)
- [ ] T10: Health/financial sync + reconnect + partial badges (hanya bila partner verified)
- [ ] T11: Insight deskriptif + virtual goal + undo 5dtk (tanpa transfer uang)
- [ ] T12: Inbox notifikasi + Quiet Hours tz-user

## P1 — Release
- [ ] T13: QA matrix + traceability + Go/No-Go evidence
- [ ] T14: FTP deploy `dist/` → `public_html/` + smoke LCP/CLS

## Audit — 200 Mobile Web APIs (done 19 Sep 2026, docs in English)
- [x] T-AUD: 01-discovery + 02-inventory + 03-matrix (200/200 IDs) + 04-e2e map + 05-roadmap + 06-report + `assets/js/capabilities.js` (CDP smoke PASS) — files: `docs/mobile-api-audit/`
- [ ] T-AUD-W0: Wave 0 tasks (AUD-STORE/ROUTER/CRYPTO/PERM/ANAL) with T2–T5
- [ ] T-AUD-W1: Wave 1 tasks (PWA/MOTION/GEST/KBD/THEME/SYNC) with T3–T4/T15
- [ ] T-AUD-W2: Wave 2 tasks (API/WORK/HAPT/NOTIF/SEARCH/CHARTS/CAP/...) with T6–T19 — CAP/IMPORT/PRINT need spec amendments first
- [ ] T-AUD-W3: Wave 3 gated (WEBAUTHN/PUSH/RES spikes) post-ADR / R1.1
