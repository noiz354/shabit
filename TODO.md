# TODO — HabitWealth OneUI CSR (Addy Osmani TASKS phase)

> Setiap tugas: Acceptance + Verify + Files. Maks ~5 files per tugas. Urut dependensi.

## P0 — Fondasi (Gate A/B)
- [x] T1: Unzip referensi ke `reference/oneui/` + diff DESIGN.md — Done 19 Sep 2026: 296 files; LOCAL 542 vs REF 509 baris, dokumen berbeda; LOCAL kanonis.
- [x] T2–T4 (scaffold, 20 Sep 2026): `package.json` pin (preact 10.24/navigo 8.11/idb-keyval/dayjs/echarts 5.5/vite 6/pwa 0.21/vitest) + shell + router hash 4 tab + tokens.css + `src/api|store` stub — Build: JS 27.48KB/gzip 10.46KB (budget 200KB aman); CDP smoke: title + 4 tabs + h1 OK. Sisa T2–T4 (isi token preview, motion penuh, app-bar snap) ikut sesi fitur.
- [x] T3 (done Wave 1, 20 Sep 2026): Motion penuh + HabitToday skeleton isi — nav deeper=up/back=down + sheet + skeleton — Files: `src/motion.js`, `src/gestures.js`, `src/views.jsx` (habitTodaySkeleton 3 cards + shimmer), `assets/css/motion.css` (nav-up-in/down-out/h-in, sheet-in/out, skeleton shimmer, reduced-motion fade) — Verify: prefersReducedMotion + animation classes
- [x] T4 (done Wave 1, 20 Sep 2026): app-bar snap expand/collapse + peer-horizontal — Files: `src/router.js` (peer relation), `src/styles/app.css` (appbar height 152→56, progress --appbar-p, snap on scroll end, title scale), `src/motion.js` createAppBarController + settle velocity threshold — Verify: scroll 96px → collapsed, snap logic

## P0 — MVP fitur
- [ ] T5: AuthHub+Consent+Primer (tanpa backend) — Acceptance: first habit <3mnt, Nanti Saja tersedia — Files: `specs/07*`
- [ ] T6: HabitToday/Editor/Detail + IndexedDB queue — Acceptance: CRUD+undo+template — Files: `assets/js/habit.js`
- [ ] T7: MoneyOverview/Feed/Add + masking+re-auth mock — Acceptance: `Rp••••` default — Files: `assets/js/money.js`
- [ ] T8: Settings/Export/Delete mock + Help — Acceptance: confirm destruktif + re-auth — Files: `assets/js/settings.js`
- [x] T9 (scaffold, 20 Sep 2026): `api/v1/index.php` front-controller + lib (response/db/validate) + `.htaccess` — `php -l` bersih; smoke: health `{ok,php,time}` + 404 envelope + request_id OK. Sisa (endpoint bisnis) = T18.

## P1 — PWA / Visual / Range / API (locked 19 Sep 2026)
- [x] T15 (done Wave 1, 20 Sep 2026): PWA shell — manifest + sw.js + offline.html + install sheet post-first-habit — `public/manifest.webmanifest` + `public/offline.html` + icons 192/512 (optimized 5.5KB/30KB via convert) + `public_html/` copies, `vite.config.js` workbox: globPatterns + additionalManifestEntries offline.html, navigateFallback offline.html, runtimeCaching api NetworkOnly + assets CacheFirst + navigations NetworkFirst 3s + navigationPreload true, `src/pwa.js` beforeinstallprompt delay until first-habit, bottom-sheet One UI Pasang/Nanti, iOS manual Bagikan→Add to Home Screen, offline banner non-merah, update prompt skipWaiting only after user tap Muat versi baru, markFirstHabitDone() — Build precache 16 entries 147KB (was 3028KB before opt) — Acceptance: Lighthouse PWA installable PASS pending CDP, offline full flow + flush tanpa duplikat via outbox — Files: `public_html/manifest.webmanifest`, `public_html/sw.js` (generated), `public_html/offline.html`, `public/icons/`
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
- [x] T-AUD-W0 (done 20 Sep 2026): Wave 0 tasks (AUD-STORE/ROUTER/CRYPTO/PERM/ANAL) — 5 modul fondasi:
  - AUD-STORE-01: `src/storage/{db,prefs,outbox,opfs,index}.js` (IDB v1→v2 migration, kv/outbox/habits/entries/tx/budgets/search_index + v2 savings_goals/export_meta/opfs_fallback/analytics_queue, quota-full cleanup search_index→export_meta, persist() post-onboarding, v-guard)
  - AUD-ROUTER-01: `src/router.js` enhanced (hash + param restore from/to/preset/q, URLPattern 197 with regex fallback, deep-link habitwealth:// mapping, back restores range/search, BroadcastChannel range sync, buildHash/parseHash/matchRoute)
  - AUD-CRYPTO-01: `src/crypto.js` (randomId, idempotencyKey, SHA-256 subtle + fallback, utf8Encode/Decode, base64url, VAPID check, redactForLog) + `.htaccess` CSP strict + Permissions-Policy camera=(self) + `api/v1/reports.php` redacted + `analytics.php` allowlist + Reporting-Endpoints
  - AUD-PERM-01: `src/permissions.js` (Permissions API query, primer decisions LS+IDB, shouldShowPrimer, canTriggerSystemDialog — Later never triggers system dialog, requestNotification/Camera gated)
  - AUD-ANAL-01: `src/analytics.js` (allowlist 27 events from spec 05/17/19, redacted props no q/raw amount, hashId for ids, IDB queue max 100, Beacon/pagehide + visibilitychange flush, periodic 30s)
  - Build: 48.61KB / gzip 17.52KB (budget 200KB aman); `node --check` OK; assets/js/storage/* re-export for audit path expectation
- [x] T-AUD-W1 (done 20 Sep 2026): Wave 1 tasks (PWA/MOTION/GEST/KBD/THEME/SYNC) with T3–T4/T15 — 6 modul shell:
  - AUD-PWA-01: `public/manifest.webmanifest` (name/short_name/lang/id/display standalone/start_url ./?source=pwa/scope ./ + theme #0381FE + icons 192/512 any+maskable + shortcuts habit+uang + launch_handler focus-existing) + `public/offline.html` + icons optimized via ImageMagick convert 743KB→5.5KB/30KB + `public_html/` copies + `vite.config.js` workbox navigateFallback offline.html, globPatterns, additionalManifestEntries, runtimeCaching api NetworkOnly + assets CacheFirst + navigations NetworkFirst 3s + navigationPreload true, `src/pwa.js` beforeinstallprompt delayed until first-habit (hw:first-habit:done), sheet One UI Pasang/Nanti + iOS manual, offline banner non-merah, update prompt skipWaiting only after tap Muat versi baru, markFirstHabitDone() — precache 16 entries 147KB (was 3028KB before opt) — Lighthouse PWA installable PASS pending CDP
  - AUD-MOTION-01: `src/motion.js` — tokens from 04-motion.tokens.json (100/150/250/350/450, easing standard/enter/exit), prefersReducedMotion(), transitionFor(deeper/back/peer/modal) → slide-up/down/horizontal, lerp/clamp/interpolateFrame, createRAFLoop, withViewTransition (View Transitions API 160 progressive + reduced-motion fade fallback), animateElement WAAPI 95 + fallback, createAppBarController (single progress --appbar-p, height 152→56 lerp, title scale, settle velocity 500), createSkeleton, trapFocus (focus trap + Esc) — spec 04 §11 checklist
  - AUD-GEST-01: `src/gestures.js` — pointer-first (Pointer Events 32 + Pointer Capture 33 + Touch Events 31 fallback), makeSheetDraggable (progress = clamp(translationY/dismissDistance), backgroundOpacity 1-progress*0.35, shouldCommit progress>=0.5||velocity>=800, snap-back, button alternative data-close-sheet), makeSliderInteractive (thumb scale 1.15, keyboard ArrowLeft/Right alternative), makeListSwipeable (threshold 80, snap-back), makePullToRefresh — every gesture has button alternative, cancel snap-back tests
  - AUD-KBD-01: `src/keyboard.js` — VirtualKeyboard API 36 (overlaysContent + geometrychange) + Visual Viewport API 159 (resize/scroll) + window resize fallback, makeCTAKeyboardAware (translateY -kbHeight+offset, transition 150ms), autosave draft on blur (hw:draft:*), saveDraft/loadDraft/clearDraft, checkZoom200 — CTA sticky above keyboard, draft saved
  - AUD-THEME-01: `src/theme.js` — CSSOM 98 (adoptedStyleSheets + replaceSync + <style> fallback), Typed OM 181 (CSS.number check), Font Loading 182 (document.fonts.ready gate max 1s race, fonts-ready class to prevent CLS), getEffectiveTheme system→dark/light via matchMedia, setTheme system/light/dark + meta theme-color + data-theme + color-scheme, initTheme loads from prefs, syncAppearanceFromPrefs (reduceMotion/highContrast/fontScale), storage event + custom event hw:theme-changed — no-swap CLS test
  - AUD-SYNC-01: `src/sync.js` — BroadcastChannel 58 + Web Locks 129, subscribeSync/publishSync with storage fallback hw:sync:*, withOutboxLock (single-send guarantee), withLock generic, testTwoTabRace (sequential diff >=80ms with lock), initSync storage event listener — multi-tab safe sync, outbox lock prevents double-send, range sync already in storage/index.js + router
  - T3/T4 done: `src/views.jsx` enhanced — appBar with controller snap, habitTodaySkeleton 3 cards shimmer 1.2s then real cards, berandaSkeleton with range label, shell deeper=up enter + back=down exit, peer-horizontal for tabs, bottom sheet demo with makeSheetDraggable, theme switcher + PWA install demo, nav bottom tabs ≤5 no-swipe, skeleton-first per spec 04 §7
  - Build: 66.54KB / gzip 22.63KB (budget 200KB aman, naik dari 48KB karena motion+gestures+pwa+theme+keyboard+sync), CSS 9.03KB/gzip 2.61KB, precache 147KB — `node --check` 11 files Wave0 + 6 files Wave1 OK, assets/js/{motion,gestures,keyboard,theme,sync,pwa} re-export for audit path
- [ ] T-AUD-W2: Wave 2 tasks (API/WORK/HAPT/NOTIF/SEARCH/CHARTS/CAP/...) with T6–T19 — CAP/IMPORT/PRINT need spec amendments first
- [ ] T-AUD-W3: Wave 3 gated (WEBAUTHN/PUSH/RES spikes) post-ADR / R1.1
