# 04 — End-to-End Feature Map

> Groups NOW/PRE matrix APIs into product capabilities. No 200 disconnected implementations. Notation: User → UI → Browser APIs → Client → State → Backend → Persist → Feedback.

## F1 — Offline-first PWA shell (IDs 61,62,66,69,70,90,197,43,172,179,60)
- Journey: install (post-first-habit sheet) → offline use → auto-flush → update prompt.
- Behavior: manifest install; SW app-shell cache-first + nav fallback; Background Sync progressive (CA) over `online`/foreground baseline; Launch Handler reuses window; notification taps open deep-link routes via Clients API; URLPattern routes SW fetches.
- Client: `sw.js`, `assets/js/store.js` (outbox, `navigator.locks` ID 129), `api.js` (fetch 51). Backend: `/api/v1/*` + idempotency keys. Persist: IndexedDB outbox (42) + OPFS staging (45).
- Perms: none (install/none beyond notification for F2). Errors: failed ops stay queued with badge; update never force-reloads.
- Offline: full read + queued writes. Observability: `sync_failed/recovered` events (specs/05) via Beacon (60) on hide.
- Accept: airplane-mode full flow + flush with zero duplicates; Lighthouse PWA installable.
- E2E: CDP offline throttle → complete habit + add transaction → online → assert single server effect per op.
```
User → InstallSheet → Manifest/SW → AppShell
User → (offline) HabitComplete → UI optimistic → Outbox(IDB) → [online] BGSync/fetch → PHP → UI badge ✓
```

## F2 — Notification system, local now / push R1.1 (IDs 65,67,64,116)
- Journey: contextual primer → grant → scheduled reminders/budget alerts/celebrations → tap deep-link.
- Behavior: local notifications per specs/11 matrix; app-badge unread count (67); Push (64) R1.1 with VAPID (specs/18). Permissions API (116) gates primers.
- Client: `notifications.js`, `sw.js` click routing (70). Backend (R1.1): `/push/subscriptions`, sender worker. Persist: prefs (41/42).
- Perms: notification grant; Quiet Hours tz-user. Errors: denied → in-app inbox fallback; stale notif expiry.
- Accept: grant/deny/quiet-hours/mute matrix green; no sensitive content on lock screen.
- E2E: schedule → fire → tap → assert route + `notification_opened` event.

## F3 — Gesture + motion system (IDs 31,32,33,95,96,99,100,156,159,160,138)
- Journey: every screen transition, sheet drag, slider, pull-refresh, chart resize.
- Behavior: pointer-first gestures + touch fallback; WAAPI micro-anims + rAF lerp under `motion.css`; View Transitions progressive; VisualViewport keyboard layout; Resize/IntersectionObserver for charts; scheduler.postTask priority + MutationObserver helpers.
- Client: `gestures.js`, `motion.js`, `keyboard.js`. No backend. Reduced-motion always honored.
- Accept: spec 04 §11 checklist (no teleport, snap-back, focus restore, alternatives).
- E2E: CDP touch emulation swipe-cancel + reduced-motion + FA-fallback runs.

## F4 — Receipt capture pipeline (IDs 1,2,4,5,8,38,45,47,48,82,149,143)
- Journey: MoneyAdd → "Ambil foto struk" → viewfinder → confirm → compressed → queued → attached. (Requires P03/P09/P18 spec amendment — flagged, not silent.)
- Behavior: getUserMedia + canvas downscale ≤1600px/q0.8; file-input + drop fallback; Share-Target receive (82, PRE); TextDetection OCR suggest (149, research); WASM fallback track (143).
- Client: `capture.js`; worker for compress (131). Backend: NEW `POST /transactions/:id/attachment` (amendment). Persist: OPFS staging → server.
- Perms: camera grant; deny → file input. Errors: oversize/unsupported → compress retry → error sheet.
- Accept: 2MB photo → <300KB upload; tracks stopped (no indicator leak); offline queued.
- E2E: CDP camera emulation + deny path + airplane queue + flush.

## F5 — Search + import/export data loop (IDs 185,186,187,192,193,44,59,137,139,157,158,37,195)
- Journey: global search (`specs/19`) → open result; export JSON/CSV (+gzip) → import CSV back.
- Behavior: Input Events IME-safe; Selection/Range `<mark>` highlight; worker indexer via MessageChannel/structured-clone + rIC; export streamed (Streams) + gzipped (Compression Streams) with StorageManager size guard; File Handling OS-open (195, PRE); CSV import via DOMParser (needs P12 amendment).
- Client: `search.js`, `workers/indexer.js`, export module. Backend: `/export/requests`. Persist: search index (42).
- Accept: "kopi" multi-scope + offline badge; 10k-row export without memory spike; malformed CSV errors.
- E2E: search/open, export→reimport round-trip, SI-fallback (no compression) run.

## F6 — Charts + adaptive rendering (IDs 94,86,87,97,170,174,169-tracked,140)
- Journey: dashboards render fast on 2G/low-end; fullscreen expand for analysis.
- Behavior: ECharts core + lazy scatter (`specs/16`); orientation/screen reads pick density; Network Info + deviceMemory downshift fidelity (hint-only); fullscreen expand with dialog fallback (SI iPhone).
- Client: `charts.js`. No backend (aggregates from `/dashboard/summary`).
- Accept: initial JS <200KB gzip; hidden tabs don't render; 200% text intact.
- E2E: throttled-4G CDP trace vs LCP budget; orientation rotate test.

## F7 — Auth + crypto + security headers (IDs 111,112,113,116,117,118,119,120,175-tracked)
- Journey: signup → consent → optional passkey (PRE, post-ADR) → sessioned use with re-auth gates.
- Behavior: WebAuthn RP flow (PRE, AUD-WEBAUTHN-01); WebCrypto keys/hashing now; Permissions Policy + CSP + Reporting now; Client Hints deferred.
- Client: `auth.js`, `permissions.js`. Backend: session endpoints + RP challenge (PRE) + `/reports`. Persist: session cookie only.
- Accept: CSP violation reported; no PII in logs; fallback when passkey unavailable.
- E2E: signup→re-auth→export/delete gates; CSP-report delivery test.

## F8 — Sync coordination + API transport (IDs 51,58,129,60,179,172)
- Journey: any mutation → optimistic UI → queued/idempotent send → confirmed badge.
- Behavior: fetch wrapper (timeout/retry/backoff); BroadcastChannel multi-tab sync; Web Locks single-flush; Beacon analytics flush on hide; visibility-paused indexer.
- Client: `api.js`, `store.js`. Backend: `/api/v1/*`. 
- Accept: two-tab single-send; airplane→online zero-dupe; redacted payloads.
- E2E: two-page CDP flush race test.

## F9 — Voice + haptics + sound (IDs 19,18-tracked,40,11,79)
- Journey: insight read-aloud; habit-complete haptic; optional success blip.
- Behavior: SpeechSynthesis readout w/ cancel-on-navigate (research: recognition for voice notes, AUD-RES-01); vibration patterns setting-gated (SI no-op); one optional sound (default OFF); wake-lock only during celebration anim.
- Client: `feedback.js`. No backend.
- Accept: silent-mode respected; toggle-off kills all; SI no-crash.
- E2E: complete→pattern-once assert; readout cancel test.

## F10 — Share, clipboard, print, router (IDs 81,84,190,152,154,155,197,153-tracked)
- Journey: share streak card / copy referral / print monthly report / deep-link nav.
- Behavior: Web Share + clipboard fallback; print CSS + `print()` (needs P09/P10 amendment); hash router + URL/URLSearchParams + URLPattern; Navigation API deferred.
- Client: `share.js`, `router.js`, print stylesheet. Backend: none (print/share client-only).
- Accept: share-sheet + fallback; print preview masked values; back-button restores range/search.
- E2E: share fallback on desktop CDP; print-to-PDF via CDP; router back-stack test.

## F11 — Fonts, theme, text primitives (IDs 181,182,98,151)
- Journey: instant correct theme + fonts without layout shift.
- Behavior: `document.fonts.ready` gate; CSS Typed OM token writes w/ fallback; CSSOM adoptedStyleSheets for Appearance.
- Accept: zero font-swap CLS; theme persists.
- E2E: slow-font CDP test vs CLS budget.
