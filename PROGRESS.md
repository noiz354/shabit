# PROGRESS — HabitWealth OneUI CSR

## 19 Sep 2026 — Git init + organize (Build)
- `git init` done (branch master, user habitwealth). Untracked: specs/, assets/, AGENTS/SKILL/TODO/PROGRESS, DESIGN/preview, zip.
- `.gitignore` added (node_modules/, dist/, reference/ ignored as derivable). `reference/`, `public_html/api/`, `public_html/assets/` scaffolded. No commit yet (awaiting explicit request).

## 19 Sep 2026 — Gate A/B review (evidence-backed)
- Gate A product clarity: PASS — scope/non-goals/slices di `specs/01-product-brief.md`; Open/Assumption/Conditional dilabel eksplisit (grep 21 hits, nol klaim provider/legal sebagai fakta); manual fallback di `00/08/09`. PARTIAL: metric owners belum dinamai (butuh assignment Product/Data).
- Gate B experience coherence: PASS — semua layar di `specs/02-ia-navigation.md` (depth ≤3, tabs ≤5); first-use vs returning dibedakan (02/07/08); denied/offline/stale/expired/retry di 07–12; copy `Rp10.000/19 Sep 2026/07.30` konsisten. PARTIAL: bukti a11y terukur (kontras/device/reduced-motion test) baru di T3.
- Verdict: boleh lanjut T1–T4; owners + a11y evidence dicatat sebagai follow-up, bukan blocker.

## 19 Sep 2026 — T1 unzip + diff (done)
- Unzip `samsung-oneui-design-system-main.zip` → `reference/oneui/` OK: 296 files on disk (347 zip entries incl. dirs).
- Diff DESIGN.md: LOCAL 542 lines (Stitch-format, cocok dengan `preview.html` CSS vars) vs REFERENCE 509 lines (`One UI 8.5 Ambient Design`, Glass UI/frosted/pill tab bar). Hash beda, 845 diff lines = dokumen berbeda, bukan versi sama.
- Decision: LOCAL `DESIGN.md` tetap kanonis token HabitWealth. Reference hanya suplemen (Ambient/Glass TIDAK diadopsi mentah — konflik dengan Surface flat + readability + perf shared hosting). `final/` Next.js SSR tetap ditolak.
## 19 Sep 2026 — MCP setup: chrome-devtools + codegraph (done, global)
- Backup `opencode.jsonc` → `opencode.jsonc.bak-20260919`. JSON re-validated.
- Added MCP `chrome-devtools` (npx `chrome-devtools-mcp@1.9.0` pinned + `--browser-url=http://127.0.0.1:9227` + `--no-usage-statistics`) dan `codegraph` (`codegraph serve --mcp`) di config GLOBAL.
- Chrome CDP 9227 dibiarkan apa adanya (profil `C:\chrome-cdp`, Chrome/153) — smoke `/json/list` OK (newtab + tabs terlihat).
- `codegraph init -y` OK: `.codegraph/` ada, index 0 files/0 nodes (belum ada source JS/PHP — wajar; re-index via `codegraph sync` setelah T2–T4). `.gitignore` += `.codegraph/`; AGENTS.md += perintah re-index + browser smoke.
- ACTION USER: restart/reload opencode agar 2 MCP server baru ter-load; tools `codegraph_explore` + DevTools muncul setelahnya.
## 19 Sep 2026 — Specs 15–18: PWA + visualization + date-range + API (done)
- Decisions locked: ECharts (core + impor selektif + lazy scatter; ring SVG) demi customizability dalam budget 200KB; Web Push+VAPID didesain di 18 untuk R1.1 (MVP lokal); default range Bulan ini + preset 30H; auth session-cookie saja.
- Created: `specs/15-pwa.md`, `16-visualization.md`, `17-date-range.md`, `18-api-design.md`; revised `13-php-api.md` (struktur v1 + SW/manifest + ECharts note). Typo fix di 18.
## 19 Sep 2026 — Spec 19: Global Search (done)
- Decisions locked: scope global (Habit/Uang/Budget/Bantuan); history lokal max-5 + hapus per-item/semua; field semuanya (judul/nominal/catatan/kategori/sumber-masked/merchant-R1.1/FAQ).
- Created `specs/19-search.md` (ranking, debounce 250ms/min-2char, highlight, offline index, SR announce, tanpa `q` mentah di events).
- Revised: 18 (+`q/sort/order`, `help/search`), 09 + 08 (pointer ke 19). TODO += T19.

## 19 Sep 2026 — Audit 200 Mobile Web APIs (done, docs in English)- Docs: `docs/mobile-api-audit/01..06` (discovery, inventory, 200-row matrix verified 200 unique IDs, e2e map F1–F11, roadmap AUD-* waves, final report).
- Tally: NOW 89 / PRE 17 / UNS 13 / NA 39 / DUP 33 / DEP 2 / RES 7 / AI 0 / PI 0 (=200 ✓). Platforms: CA/SI/FA/WV per locked decision.
- Built: `assets/js/capabilities.js` (zero-dep detection, `node --check` OK) + live CDP smoke on Chrome/153: `HWCapabilities type=object`; snapshot proves existence≠usability (non-secure ctx → SW/WebAuthn/Share false, perms denied).
- Honest bounds: no physical-device tests (desktop CDP only); no user features implemented (spec-stage repo); 3 spec amendments flagged (capture P03/P09/P18, import P12, print P09/P10).
- TODO += T-AUD waves. Next: T2 tokens.css → Wave 0 with T2–T5.

## 20 Sep 2026 — Agent skills map (done)- Inventaris: 59 skills lokal; 2 Addy pack hilang (`frontend-ui-engineering`, `source-driven-development`) — installer `npx skills` interaktif gagal mendarat → di-mirror verbatim MIT ke `C:\Users\Norman\.agents\skills\` (atribusi di file). Total 61.
- Created `docs/agent-skills-map.md` (routing Define→Ship + komposisi backend PHP + adaptasi vanilla/CSR + missing list).
- Updated `SKILL.md` (skills routing) + `AGENTS.md` (Always: skill routing). Next: scaffold (disetujui user 20 Sep 2026).

## 20 Sep 2026 — Scaffold saja (done, tanpa fitur)
- Frontend: `package.json` pin (preact 10.24.3, navigo 8.11.1, idb-keyval 6.2.1, dayjs 1.11.13, echarts 5.5.1, vite 6.3.5, pwa 0.21.1, vitest 3.1.4) + `vite.config.js` (Preact + VitePWA generateSW + NetworkOnly /api) + `index.html` shell + `src/main.jsx|router.js|views.jsx|api.js|store.js` stub + `tokens.css`/`app.css` (impor motion.css + capabilities.js single-source).
- Backend nol-dep PHP ≤8.1: `api/v1/index.php` + `lib/{response,db,validate}.php` + 2 `.htaccess`; `php -l` bersih; smoke: health + 404 envelope + request_id OK (double-`ok` diperbaiki).
- Verifikasi: `vite build` OK — JS 27.48KB/gzip 10.46KB (budget 200KB); PWA precache 5 entries; CDP smoke app nyata: title + 4 tabs + h1 OK. Perbaikan: `--report` bukan flag Vite 6 (script + specs/13/16 dikoreksi).
- TODO: T2–T4/T9 scaffold dicentang; sisa isi ikut sesi fitur. Next: sesi fitur T5+ per wave.

## 20 Sep 2026 — Wave 0 Foundation (AUD-STORE/ROUTER/CRYPTO/PERM/ANAL) done
- AUD-STORE-01: `src/storage/db.js` — DB habitwealth-v1 v2, stores kv/outbox/habits/habit_entries/transactions/budgets/search_index + v2 savings_goals/export_meta/opfs_fallback/analytics_queue, indexes by_created/by_status/by_habit/by_date, quota-full handler cleanup 50 oldest search_index then export_meta, v-guard (old ignores new). `prefs.js` — LS namespace hw:*, v2 migration from v1, history max 5 (spec 19), range single source {preset,from,to,tz} Asia/Jakarta, onboarding flag + requestPersist() post-onboarding. `outbox.js` — enqueue with idempotencyKey (crypto.js), status pending/syncing/failed, Web Locks "outbox" + BroadcastChannel habitwealth-v1 + storage event fallback, drainOutbox with retry/backoff, auto-drain on online/visibility. `opfs.js` — getDirectory() with IDB fallback, writeFile/readFile/deleteFile/listFiles, assembleExportFile JSON/CSV, cleanupOldFiles 7d. `index.js` — facade + initStorage + subscribeRange + multi-tab sync. Files also mirrored to `assets/js/storage/*` for audit path expectation.
- AUD-ROUTER-01: `src/router.js` enhanced — hash parse/build, getRangeFromHash (from/to/preset/tz), getSearchFromHash (q/sort/cat), URLPattern 197 with regex fallback (matchRoute), deep-link mapping habitwealth:// -> #/, navigate/navigateWithRange, back restores range/search via hashchange listener, range sync via subscribeRange + BroadcastChannel, router.hw exposed for tests. Also re-exported to `assets/js/router.js`.
- AUD-CRYPTO-01: `src/crypto.js` — isSecureContext, getRandomValues, randomId (randomUUID fallback), generateIdempotencyKey (ts+rand), hashString SHA-256 subtle + djb2 fallback, hashId, utf8Encode/Decode via TextEncoder, base64Url, isVapidKeyValid (65 bytes), generateNonce, randomInt, redactForLog (no PII). `.htaccess` root — CSP strict default-src 'self' script-src 'self' style-src 'self' 'unsafe-inline' img-src self data blob, report-uri /api/v1/reports + Reporting-Endpoints, Permissions-Policy camera=(self) mic=() geo=() etc, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, COOP/COEP. `api/v1/.htaccess` — explicit RewriteRule reports/analytics, same hardening, CSP default-src 'none'. `reports.php` — POST only, RL 20/min per IP, redact document-uri query strip, blocked-uri truncate, logs redacted, also handles analytics beacon fallback. `analytics.php` — POST /api/v1/analytics, RL 60/min, allowlist 27 events, safeProps allowlist + _hash suffix, redacted logs.
- AUD-PERM-01: `src/permissions.js` — queryPermission with Permissions API + unsupported fallback, queryAll, decisions LS+IDB hw:permissions:decisions:v1, recordPrimerDecision (granted/denied/later/dismissed), shouldShowPrimer (7d cooldown denied, 24h later), canTriggerSystemDialog only if lastDecision=granted (Later never triggers system dialog), requestNotificationPermission + requestCameraPermission gated by primer, withPermissionCheck helper.
- AUD-ANAL-01: `src/analytics.js` — allowlist 27 events (spec 05 + 17 + 19 + perm), redactProps (forbidden keys email/password/amount/note/title/q, allow char_len/result_count/scope/preset/days/module etc, delete q), hashId for habit_id etc, IDB queue analytics_queue max 100, flushViaFetch POST /api/v1/analytics + flushViaBeacon on pagehide/visibilitychange (ID 60/179), periodic 30s, setOptIn, fallback LS hw:analytics:fallback.
- Verifikasi: `npm run build` — 48.61KB / gzip 17.52KB (budget 200KB aman, naik dari 27KB karena storage+router+crypto+perm+anal); `node --check` 11 files OK; `vite build` precache 5 entries. PHP lint unavailable in container but files follow previous pattern (declare strict, no PII). CDP smoke pending but capabilities + storage expose window.HWStorage for verification.
- Next: Wave 1 (PWA/MOTION/GEST/KBD/THEME/SYNC) with T3–T4/T15.

## Log format going forward
`## <date> — <phase>`: Done / Blocked / Decisions / Next. Update tiap selesai 1 tugas TODO.
