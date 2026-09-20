# AGENTS.md — HabitWealth OneUI CSR (project rules)

## Objective
CSR One UI untuk PHP 40-shared. Manual-first. Tanpa money movement. Indonesia copy.

## Commands
```
Setup: npm ci             # WAJIB setelah clone/checkout (lockfile; node_modules tidak di-commit — basi = test gagal palsu)
Build: npm run build      # vite build -> dist/ -> FTP public_html/
Dev: npm run dev
Test: npm test            # vitest run (happy-dom + fake-indexeddb; fetch di-stub gagal = tanpa backend)
PHP smoke: php -S localhost:8000 -t public_html
Unzip ref: zip sudah dipindah user ke luar repo — perbarui path bila perlu; hasil unzip = suplemen (lihat Structure)
CodeGraph: codegraph sync (re-index; .codegraph/ di-ignore, regenerable)
Browser smoke: Chrome CDP di 127.0.0.1:9227 + MCP chrome-devtools (`--browser-url=http://127.0.0.1:9227`)
```

## Structure
```
specs/00..14*.md      → source of truth produk
specs/04-motion.*     → motion binding + tokens
specs/15-pwa.md       → manifest/SW/offline (push lokal MVP, VAPID R1.1)
specs/16-visualization.md → ECharts core+seleksi, lazy scatter, SR-summary
specs/17-date-range.md → picker global, default Bulan ini, hash state
specs/18-api-design.md → kontrak /api/v1/*, session-cookie, idempotency
specs/19-search.md → search global 4 scope, history lokal max-5, index offline
assets/css/           → tokens.css, motion.css
assets/js/            → router/habit/money/settings/range/charts (CSR, transform/opacity only)
src/auth.js + src/views-auth.jsx → T5 sesi lokal-first + onboarding state machine + authGate (spec 07)
tests/ + docs/qa/     → T13 vitest + QA matrix/traceability/Go-No-Go (status jujur PASS/NOT TESTED/BLOCKED)
src/ui.js             → toast/sheet/confirm One UI (pengganti alert/confirm); src/notify.js + src/views-notify.jsx → T12 Kotak Masuk + Quiet Hours tz-user
docs/adr/ + db/migrations/ → keputusan arsitektur (ADR-0001 passkey PROPOSED, ADR-0002 push ACCEPTED) + migrasi SQL terpisah
public_html/api/v1/*.php → thin JSON, PDO prepared, redacted logs
reference/oneui/ → suplemen, jangan edit; kanonis tetap DESIGN.md lokal
```

## Style
One UI: Primary `#0381FE`, 24dp margin, radius 18 btn/16 card/26 dialog/24 pill, bottom tabs ≤5 no-swipe, masking `Rp••••`, `Rp10.000`, `19 Sep 2026`. Motion: deeper=up/back=down/peer=horizontal/sheet dari bawah; `AsyncState` bukan boolean; skeleton dulu.

## Boundaries
- Always: spec dulu (Addy Osmani SPECIFY→PLAN→TASKS→IMPLEMENT, gated); skill routing per `docs/agent-skills-map.md` (`frontend-ui-engineering` untuk UI, `source-driven-development` untuk verifikasi docs, `verification-before-completion` sebelum klaim DONE); update TODO+PROGRESS tiap tugas; reduced-motion; re-auth aksi sensitif; non-color cues.
- Ask first: skema DB final, endpoint PHP baru, klaim provider/legal/vendor, premium/paywall.
- Never: transfer/custody/auto-debit; klaim Plaid/Nordigen/E2EE/pasal UU/retensi final; SSR/Node di shared host; PII di analytics/log; hardcode warna/durasi di fitur; fade global; `isLoading` saja; `alert()/confirm()/prompt()` (pakai `src/ui.js` sheet/toast); inline style visual di views (class + token).
- Checklist permanen sebelum commit yang menyentuh event analytics (syarat merge PR #2 (b), 19 Sep 2026): nama event **wajib** ditambah di **empat** tempat sekaligus — `src/analytics.js` `ALLOWED_EVENTS` + `public_html/api/v1/analytics.php` + `index.php` + `reports.php` (`$allowed`) — **dan** didokumentasikan di `specs/05-analytics.md` (registry tunggal). Dijaga `tests/guardrails.test.js` (paritas set identik + terdokumentasi); jangan pernah melonggarkan tes itu. Chart/SVG hand-rolled juga token-only (class di `app.css`; hex hanya `TOKEN_FALLBACK` di `charts.js`).

## Success
First habit <3mnt; LCP<2.5s/CLS<0.1 diukur; Gate A–E + kill-criteria lolos dengan evidence.
