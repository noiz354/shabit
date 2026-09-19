# 03 — Integration Matrix (IDs 1–200)

> Repo evidence points to `specs/` (planned architecture) and `preview.html` (static prototype) — no app source exists yet (see `01-repository-discovery.md`). Platform order: CA / SI / FA / WV. External claims cite MDN + caniuse; unverifiable ones are marked EXTERNAL VERIFICATION UNAVAILABLE per rules.
> Legend: AI=ALREADY_INTEGRATED, PI=PARTIALLY_INTEGRATED, NOW=IMPLEMENTABLE_NOW, PRE=REQUIRES_PREREQUISITE, UNS=PLATFORM_UNSUPPORTED, NA=NOT_APPLICABLE, DEP=DEPRECATED_OR_SUPERSEDED, DUP=DUPLICATE_CAPABILITY, RES=RESEARCH_REQUIRED.

## IDs 1–50

### 1. MediaDevices API — NOW
- Canonical: `navigator.mediaDevices`. Repo: absent; planned receipt-capture has no spec yet — needs P03 amendment (`specs/02-ia-navigation.md` has no camera screen).
- Use case: attach receipt photo to manual transaction (MoneyAdd). UI: "Ambil foto struk" button in MoneyAdd sheet. Client: `assets/js/capture.js` + feature-detect. Backend: `POST /api/v1/transactions/:id/attachment` (new; spec amendment to `specs/18-api-design.md`). Persist: OPFS/IndexedDB pending queue → server object.
- Compat: CA yes / SI yes 14.3+ / FA yes / WV varies. Perm: camera grant, HTTPS, user gesture.
- Ext: MDN MediaDevices (https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices, access 19 Sep 2026) + caniuse "getUserMedia". Verify: CDP emulate + physical Android/iOS photo attach e2e. Next: TASK AUD-CAP-01 (spec amendment P03/P09, then implement).

### 2. getUserMedia() — NOW
- Canonical: method of 1. Repo/citations: same as 1. Use case/UI/Client/Backend/Persist: same chain as 1 (live viewfinder in MoneyAdd sheet, stop tracks on close).
- Compat: CA yes / SI yes / FA yes / WV varies. Perm: camera, HTTPS.
- Ext: same as 1. Verify: deny-path shows File-input fallback (`specs/07` fallback pattern). Next: AUD-CAP-01.

### 3. enumerateDevices() — PRE
- Canonical: device list; labels require granted permission. Repo: absent.
- Use case: camera picker (front/back) inside receipt capture. Chain same as 1.
- Compat: CA yes / SI yes (labels post-grant) / FA yes / WV varies. Perm: camera grant for labels.
- Reasons: (R1) No capture screen exists yet — depends on AUD-CAP-01 spec amendment and T7 MoneyAdd. (R2) Labels hidden until permission granted, so picker UX needs two-step flow (request → list) not yet designed. (R3) iOS label behavior + WV variance unverified on target devices — needs device test before UX freeze.
- Ext: MDN enumerateDevices + caniuse; device-test evidence missing → flagged. Verify: device matrix test. Next: after AUD-CAP-01.

### 4. MediaStream API — NOW
- Canonical: `MediaStream`. Same chain/citations as 1 (stream lifecycle: stop all tracks on sheet close/cancel).
- Compat/perm: as 1. Ext: MDN MediaStream + caniuse. Verify: track-stop assertion (no camera indicator leak). Next: AUD-CAP-01.

### 5. MediaStreamTrack API — NOW
- Canonical: `MediaStreamTrack` (stop/applyConstraints). Same chain as 1; torch/zoom constraints progressive-enhance only.
- Compat/perm: as 1. Ext: MDN MediaStreamTrack. Verify: stop-on-close test. Next: AUD-CAP-01.

### 6. ImageCapture API — UNS
- Canonical: `ImageCapture` (takePhoto, zoom/torch controls).
- Reasons: (R1) No SI/FA/WV support (caniuse "ImageCapture"; EXTERNAL VERIFICATION UNAVAILABLE beyond MDN compat table — recheck at implementation). Without iOS, a core capture path cannot depend on it. (R2) getUserMedia + canvas frame-grab (IDs 2/8) already covers photo capture for receipts, so no unique product need. (R3) No zoom/torch requirement in any spec (`specs/08`, `09` silent) — capability without a use case.
- Ext: MDN ImageCapture; caniuse. Verify: N/A. Next: none unless torch requirement emerges.

### 7. MediaRecorder API — NA
- Canonical: `MediaRecorder`.
- Reasons: (R1) No audio/video-note feature in any spec or TODO (T2–T19); inventing one would violate "no unrelated features" rule. (R2) Receipt capture needs stills, not recordings — wrong tool for the job. (R3) Adds MIME-type fragmentation (WebM/MP4 per OS) with zero product payoff.
- Ext: MDN MediaRecorder. Verify: N/A. Next: none.

### 8. Canvas API — NOW
- Canonical: canvas 2D (frame grab, receipt downscale/compress, ring/streak visuals already planned in `specs/16-visualization.md`).
- Use case: downscale receipt photo ≤1600px + JPEG q0.8 before queue (saves upload bytes on 40-shared hosting). UI: silent (progress in sheet). Client: `assets/js/capture.js` + existing charts plan. Backend: attachment endpoint (AUD-CAP-01). Persist: OPFS pending.
- Compat: all yes. Perm: none. Ext: MDN Canvas API + caniuse (universal). Verify: output-size assertion test. Next: AUD-CAP-01.

### 9. OffscreenCanvas API — PRE
- Canonical: `OffscreenCanvas` in worker.
- Reasons: (R1) No worker pipeline exists yet (depends on T16 charts/worker tasks + AUD-WORK-01). (R2) Receipt compression is small enough for main thread with rIC chunking; offloading is premature optimization without perf evidence. (R3) SI <16.4 lacks support — needs fallback path designed first.
- Ext: MDN OffscreenCanvas + caniuse. Verify: long-task measure before/after. Next: after worker infra lands.

### 10. Barcode Detection API — NA
- Canonical: `BarcodeDetector`.
- Reasons: (R1) No barcode/QR use case in specs (HabitWealth has no POS/inventory/check-in flow); file itself frames it for POS (`200_web_api_mobile.md:19`). (R2) SI/FA/WV unsupported — a core flow cannot depend on it. (R3) Receipt data comes from photos/manual entry, not barcodes.
- Ext: MDN BarcodeDetector (deprecated origin-trial path noted) + caniuse. Verify: N/A. Next: none.

### 11. Web Audio API — NOW (narrow scope)
- Canonical: `AudioContext` graph. Repo: `specs/04-motion-behavior.md` §8 allows optional success sound; haptic-first.
- Use case: single optional success blip on streak celebration only (never loops, respects silent mode). UI: none (toggle in Settings > Appearance, default OFF). Client: `assets/js/feedback.js` lazy AudioContext on first user gesture. Backend: N/A. Persist: pref in localStorage.
- Compat: all yes (needs user gesture). Perm: none; honor OS silent.
- Ext: MDN Web Audio API. Verify: silent-mode + toggle-off tests. Next: TASK AUD-SND-01 (with T8 settings).

### 12. AudioContext API — DUP (→11)
- Same capability entry point as 11. No separate integration; tracked under AUD-SND-01.

### 13. AudioWorklet API — NA
- Reasons: (R1) No custom audio processing anywhere (one optional blip needs no worklet). (R2) Adds thread + fallback complexity for zero product gain. (R3) SI support late (14.1+) and untested on targets.
- Ext: MDN AudioWorklet. Next: none.

### 14. AnalyserNode API — NA
- Reasons: (R1) No visualizer/voice feature in specs. (R2) Overlaps no planned chart (ECharts covers viz). (R3) Steady-state mic/graph cost with no user-facing outcome.
- Ext: MDN AnalyserNode. Next: none.

### 15. GainNode API — NA — same rationale family as 14 (no programmatic volume need; single blip uses fixed gain). Ext: MDN GainNode. Next: none.

### 16. BiquadFilterNode API — NA — same as 14 (no filtering need). Ext: MDN BiquadFilterNode. Next: none.

### 17. MediaElementAudioSourceNode API — NA — no `<audio>` playback feature exists or is planned. Ext: MDN. Next: none.

### 18. SpeechRecognition API — RES
- Canonical: `SpeechRecognition` (webkit-prefixed).
- Potential: voice-to-text for transaction notes/habit titles (hands-free entry). Chain: mic button → transcript → confirm/edit → save (never auto-commit).
- Open evidence: (1) Indonesian accuracy on CA vs SI unknown — needs device test with id-ID locale; (2) FA unsupported → fallback (manual typing) must be primary anyway; (3) network-dependence of platform recognizers vs offline-first principle (`specs/01`) unresolved.
- Compat: CA yes / SI 14.1+ partial / FA no / WV no. Perm: microphone + HTTPS.
- Ext: MDN SpeechRecognition (experimental status) — EXTERNAL VERIFICATION UNAVAILABLE for id-ID accuracy; needs lab test. Verify: WER sample test on 2 devices. Next: TASK AUD-RES-01 (research spike, R1.1 candidate).

### 19. SpeechSynthesis API — NOW (narrow scope)
- Use case: read aloud weekly insight summary (accessibility complement, `specs/10-insights-goal.md` SR summaries exist as text). UI: "Bacakan" button on InsightSummary. Client: `speechSynthesis` with voice pick + cancel on navigate. Backend: N/A.
- Compat: all yes (voices vary by OS). Perm: none (user gesture).
- Ext: MDN SpeechSynthesis. Verify: voice-fallback + cancel tests. Next: TASK AUD-SPCH-01 (with T11).

### 20. Media Session API — NA
- Reasons: (R1) No media playback (no audio/video player in any spec). (R2) OS media controls without a player confuse users. (R3) SI support partial — cost without benefit.
- Ext: MDN Media Session. Next: none.

### 21. Geolocation API — NA
- Reasons: (R1) No location-based feature in specs/TODO (no maps, no nearby, no travel auto-detect; travel handled via manual tz badge in `specs/17-date-range.md`). (R2) Permission-sensitive capability without a use case erodes trust (product principle: progressive disclosure, `specs/01`). (R3) Ongoing maintenance (accuracy, battery, denial paths) with zero user-facing outcome.
- Ext: MDN Geolocation + caniuse. Next: none (revisit only if merchant-location categorization is specified).

### 22. getCurrentPosition() — DUP (→21, method of Geolocation; same verdict).

### 23. watchPosition() — DUP (→21, method of Geolocation; same verdict; +battery cost note).

### 24. DeviceOrientation API — NA
- Reasons: (R1) No tilt/AR/game use case in any spec. (R2) iOS 13+ requires permission-request gesture — UX cost without benefit. (R3) Fragile across WV.
- Ext: MDN DeviceOrientationEvent (+ iOS permission note). Next: none.

### 25. DeviceMotion API — NA — same family as 24 (no shake-to-undo or motion feature specified; shake gestures are undiscoverable + conflict with a11y). Ext: MDN DeviceMotionEvent. Next: none.

### 26. Accelerometer API — NA — Generic Sensor, CA-only; step counting uses Health sync (R1.1, OS-level) not raw sensors; no in-app motion feature. Ext: MDN Accelerometer + caniuse. Next: none.

### 27. Gyroscope API — NA — same as 26. Ext: MDN Gyroscope. Next: none.

### 28. Magnetometer API — NA — same as 26 (no compass feature). Ext: MDN Magnetometer. Next: none.

### 29. AbsoluteOrientationSensor API — DUP (→24/26 family; same verdict; CA-only).

### 30. RelativeOrientationSensor API — DUP (→24/26 family; same verdict; CA-only).

### 31. Touch Events API — NOW
- Canonical: `TouchEvent`. Repo: gesture contracts in `specs/04-motion-behavior.md` §1C/§2 (drag, swipe-down sheet, pull-to-refresh) implemented via Pointer Events with touch fallback.
- Use case/UI: sheet drag, list→detail swipe, slider press. Client: `assets/js/gestures.js` (pointer-first, touch fallback), every gesture has button alternative (spec 04 §11). Backend: N/A.
- Compat: all mobile yes. Perm: none. Ext: MDN Touch Events + caniuse. Verify: CDP touch emulation + device swipe tests incl. cancel snap-back. Next: TASK AUD-GEST-01 (with T3/T4).

### 32. Pointer Events API — NOW — primary input model for all gestures above (unifies touch/mouse/stylus); same chain/evidence as 31. Ext: MDN Pointer Events. Verify: pointercancel + multi-touch tests. Next: AUD-GEST-01.

### 33. Pointer Capture API — NOW — retains target during sheet drag/slider (same chain as 31). Ext: MDN setPointerCapture. Next: AUD-GEST-01.

### 34. UI Events API — DUP (→32; UIEvent umbrella covered by Pointer/Input event handling; no separate task).

### 35. Keyboard API — RES
- Potential: physical-keyboard shortcuts on DeX/tablet (specs mention DeX reflow in `specs/03`).
- Open: (1) CA-only layout-map API; SI/FA absent — value limited to DeX/ChromeOS slice; (2) no shortcut system specified (needs UX spec); (3) `keydown` handlers already cover basic shortcuts without this API.
- Ext: MDN Keyboard API (experimental). Verify: DeX lab test if pursued. Next: AUD-RES-02 (DeX research, low priority).

### 36. VirtualKeyboard API — NOW
- Repo: `specs/08-habit.md` mandates keyboard handling (CTA sticky, autosave draft); `specs/09` same for AddRecord.
- Use case: `virtualkeyboardpolicy` + `geometrychange` to keep CTA visible above keyboard (Android Chrome). UI: no visual change (layout correctness). Client: `assets/js/keyboard.js` with resize-fallback for SI/FA. Backend: N/A.
- Compat: CA 94+ / SI no / FA no / WV varies. Perm: none.
- Ext: MDN VirtualKeyboard API + caniuse. Verify: CDP + Android device tests (CTA visible, draft saved). Next: TASK AUD-KBD-01 (with T6/T7).

### 37. Input Events API — NOW — `beforeinput`/composition handling for search box (`specs/19-search.md`: throttled announce, IME-safe CJK/Indonesian input). Client: `assets/js/search.js`. Ext: MDN InputEvent. Next: TASK AUD-SEARCH-01 (with T19).

### 38. Drag and Drop API — NOW (narrow: file drop)
- Use case: drop receipt image onto MoneyAdd (desktop/DeX); mobile uses capture/file input (IDs 1–2). Client: dropzone in `capture.js`. Backend: same attachment endpoint (AUD-CAP-01).
- Compat: desktop yes; mobile touch DnD poor → input fallback mandatory. Perm: none.
- Ext: MDN Drag and Drop. Verify: drop + fallback tests. Next: AUD-CAP-01.

### 39. Gamepad API — NA — no game feature; desktop-centric; mobile HW rare. Ext: MDN Gamepad. Next: none.

### 40. Vibration API — NOW
- Repo: `specs/04` §8 feedback map (light/medium/success/error) + `specs/08` haptic on complete/milestone.
- Use case: `navigator.vibrate` patterns for habit-complete/milestone/error, gated behind user setting, no-op where unsupported (SI). Client: `assets/js/feedback.js`. Backend: N/A.
- Compat: CA/FA yes / SI no / WV varies. Perm: none (setting-gated).
- Ext: MDN Vibration API + caniuse. Verify: pattern-once assertion + SI no-crash test. Next: TASK AUD-HAPT-01 (with T6).

### 41. Web Storage API — NOW — prefs, theme, search history (max 5, `specs/19`), install-prompt flag. Client: storage wrapper with quota-try/catch. Ext: MDN Web Storage (universal). Next: TASK AUD-STORE-01 (with T5/T8).

### 42. IndexedDB API — NOW — source-of-truth: habits, entries, transactions, outbox queue, search index (`specs/06`, `18`, `19`). Client: versioned wrapper + migrations. Ext: MDN IndexedDB (universal). Verify: migration + queue-flush tests. Next: AUD-STORE-01.

### 43. Cache API — NOW — SW app-shell + immutable assets (`specs/15-pwa.md`). Client: `sw.js` (cache-first assets, network-first nav). Ext: MDN Cache. Verify: offline-load test via CDP. Next: TASK AUD-PWA-01 (with T15).

### 44. StorageManager API — NOW — `persist()` for outbox durability + `estimate()` to guard export size (`specs/12`, `18`). Client: request persist post-onboarding; estimate before export build. Ext: MDN StorageManager. Next: AUD-STORE-01.

### 45. Origin Private File System — NOW — receipt image staging + export file assembly (avoids memory spikes). Client: OPFS via worker where available, IndexedDB fallback. Compat: CA/FA/SI 15.2+. Ext: MDN OPFS. Next: AUD-CAP-01.

### 46. File System Access API — UNS
- Reasons: (R1) No SI/FA/WV support — export uses download + share (IDs 47/81) which suffice. (R2) Save-picker UX unsuited to mobile mental model. (R3) File input + OPFS cover receipt/export needs with zero permission friction.
- Ext: MDN File System Access + caniuse. Next: none.

### 47. File API — NOW — receipt `<input type=file accept=image*>` fallback + export download blobs (`specs/12`, `18`). Client: `capture.js` + export module. Ext: MDN File API (universal). Next: AUD-CAP-01 + export task.

### 48. Blob API — NOW — export JSON/CSV assembly + receipt blobs (same chain as 47). Ext: MDN Blob. Next: same.

### 49. FileReader API — DUP (→47/48; modern path uses `blob.arrayBuffer()`/`text()`; retained only as legacy fallback — no separate task).

### 50. Storage Access API — NA
- Reasons: (R1) First-party single-origin app — no embedded/third-party storage need. (R2) No iframe auth flows planned. (R3) Misuse risks privacy review cost.
- Ext: MDN Storage Access API. Next: none.
## IDs 51–100

### 51. Fetch API — NOW
- Canonical: `fetch`. Repo: all `/api/v1/*` calls (`specs/18-api-design.md`) + idempotency headers + cursor paging.
- Use case/UI: every sync/flush behind skeleton UI (`specs/04` AsyncState). Client: `assets/js/api.js` wrapper (timeout, retry/backoff, `X-Request-Id`). Backend: `public_html/api/v1/*.php`. Persist: outbox on failure.
- Compat: all yes. Perm: none (same-origin). Ext: MDN Fetch + caniuse. Verify: retry/idempotency tests + CDP offline flush. Next: TASK AUD-API-01 (with T18).

### 52. XMLHttpRequest API — DUP (→51; only unique niche is upload-progress events — retained as fallback note inside AUD-API-01 for large receipt uploads; no separate task).

### 53. WebSocket API — PRE
- Potential: live dashboard/sync push. Chain would be: UI badge → WS client → PHP WS daemon → MySQL → UI update.
- Reasons: (R1) Shared hosting has no persistent-process WS server (constraint in `specs/13-php-api.md`); needs infra change. (R2) Product needs are satisfied by poll-on-foreground + SW/refresh (specs 08/09 cooldown 30s) — no realtime use case specified. (R3) Battery/reconnect complexity on mobile without product payoff.
- Compat: all yes (needs server). Ext: MDN WebSocket. Verify: N/A now. Next: revisit only with R1.1 sync backend ADR.

### 54. WebTransport API — UNS
- Reasons: (R1) HTTP/3 + server support absent on shared hosting; CA 97+/SI 26+ only. (R2) No realtime need (see 53). (R3) Experimental surface, no testable outcome.
- Ext: MDN WebTransport + caniuse. Next: none.

### 55. Server-Sent Events API — PRE — one-way budget-alert stream would need PHP long-poll/SSE endpoint + infra; local thresholds already specified (`specs/09` BudgetAlert computed client-side). Reasons mirror 53 (no server, no need, battery). Ext: MDN EventSource. Next: revisit with backend ADR.

### 56. WebRTC API — NA
- Reasons: (R1) No call/video/chat/collaboration feature in any spec. (R2) Needs STUN/TURN + signaling server — absent infra. (R3) Permission + battery heavy with zero use case.
- Ext: MDN WebRTC. Next: none.

### 57. RTCDataChannel API — DUP (→56; same verdict).

### 58. Broadcast Channel API — NOW — multi-tab state sync (habit completed in tab A → tab B updates; outbox lock hints). Client: `assets/js/store.js` channel `habitwealth-v1` with `storage`-event fallback for SI<15.4. Ext: MDN BroadcastChannel + caniuse. Verify: two-tab CDP test. Next: TASK AUD-SYNC-01 (with T6).

### 59. MessageChannel API — NOW — worker/app messaging for export builder + search indexer (`specs/18`, `19`). Client: ports to worker. Ext: MDN MessageChannel (universal). Next: TASK AUD-WORK-01 (with T16/T19).

### 60. Beacon API — NOW — analytics flush on pagehide/unload (`specs/05-analytics.md` offline queue; beacon carries no PII). Client: queue-flush module. Ext: MDN Beacon (universal). Verify: payload-redaction test. Next: TASK AUD-ANAL-01 (with T5).

### 61. Service Worker API — NOW — app-shell/offline/update flow (`specs/15-pwa.md`). Registration deferred post-first-paint; update only on user tap. Compat: all (HTTPS). Ext: MDN Service Worker + caniuse. Verify: CDP offline test + update-prompt test. Next: AUD-PWA-01.

### 62. Background Sync API — NOW (progressive) — outbox flush via `sync` event where available; `online`+foreground flush is the baseline (`15-pwa.md`). Compat: CA yes / SI no / FA no. Ext: MDN Background Sync. Verify: CA device test + fallback test. Next: AUD-PWA-01.

### 63. Periodic Background Sync API — UNS
- Reasons: (R1) CA + installed-PWA only; SI/FA absent — cannot be a relied-upon refresh path. (R2) Browser may delay arbitrarily (inventory itself notes no timing guarantee). (R3) Foreground 15-min sync + manual refresh already specified; no gap.
- Ext: MDN Periodic Background Sync + caniuse. Next: none.

### 64. Push API — PRE — designed for R1.1 (VAPID in `specs/18-api-design.md`); needs PHP sender + subscription store + opt-in UX (`specs/11`). MVP uses local notifications. Compat: CA/FA yes; SI 16.4+ installed-PWA. Perm: notification grant. Reasons: (R1) server sender + key rotation not built; (R2) subscription UX + Quiet-Hours logic pending T12; (R3) MVP retention covered locally.
- Ext: MDN Push API + caniuse. Verify (later): R1.1 e2e push test. Next: TASK AUD-PUSH-01 (R1.1, after T12/T18).

### 65. Notifications API — NOW — local reminders/budget alerts/celebrations per `specs/11` matrix (trigger/eligibility/cap/suppress/deep-link). Permission asked contextually (post-first-habit). Compat: all (SI via installed PWA 16.4+). Ext: MDN Notifications. Verify: grant/deny/quiet-hours tests. Next: TASK AUD-NOTIF-01 (with T12).

### 66. Web App Manifest — NOW — full manifest per `specs/15-pwa.md` (icons, shortcuts, share affordances). Declarative; validated via Lighthouse PWA + CDP. Ext: MDN Web App Manifest + web.dev. Next: AUD-PWA-01.

### 67. Badging API — NOW — unread inbox count on app icon (`specs/11` InAppInbox). `setAppBadge/clearAppBadge` guarded; no-op FA. Compat: CA/SI-installed; FA no. Ext: MDN Badging + caniuse. Verify: set/clear test. Next: AUD-NOTIF-01.

### 68. Background Fetch API — UNS — CA-only; receipt/export transfers are small (fetch + retry suffices); no large-download use case. Ext: MDN Background Fetch + caniuse. Next: none.

### 69. Navigation Preload API — NOW — enable alongside SW for faster navigations on CA/FA; SI ignores gracefully. One-line SW config inside AUD-PWA-01. Ext: MDN Navigation Preload. Next: AUD-PWA-01.

### 70. Service Worker Clients API — NOW — focus/open relevant hash route on notification tap (`specs/11` deep-links). Client: `sw.js` `clients.openWindow` + claim. Ext: MDN Clients. Verify: tap-to-route test. Next: AUD-PWA-01.

### 71. Web Bluetooth API — NA
- Reasons: (R1) No BLE peripheral in any journey (no scale/band sync specified; health sync is OS-level R1.1). (R2) CA-only + user-gesture pairing — dead end on iOS majority. (R3) Security review + denial UX cost without use case.
- Ext: MDN Web Bluetooth + caniuse. Next: none.

### 72. WebUSB API — NA — same family as 71 (no USB accessory; CA-only). Ext: MDN WebUSB. Next: none.

### 73. Web Serial API — NA — same family as 71 (no serial device; CA-only). Ext: MDN WebSerial. Next: none.

### 74. WebHID API — NA — same family as 71 (no HID device; CA-only). Ext: MDN WebHID. Next: none.

### 75. Web NFC API — NA
- Reasons: (R1) CA-Android-only + NDEF subset — cannot serve iOS users; inventory itself warns it is no substitute for card emulation (`200_web_api_mobile.md:125`). (R2) No NFC-tag workflow in specs (no inventory/check-in). (R3) No backend NDEF lookup exists.
- Ext: MDN Web NFC + caniuse. Next: none.

### 76. Battery Status API — NA
- Reasons: (R1) CA-only (removed from others for fingerprinting); no adaptive behavior specified (charts already lazy). (R2) Privacy-sensitive signal without consent story. (R3) No product decision consumes battery level.
- Ext: MDN Battery Status (removal notes). Next: none.

### 77. Ambient Light Sensor API — NA — CA-only; no auto-theme-from-ambient requirement (explicit Appearance setting in `specs/12` is the chosen UX). Ext: MDN ALS. Next: none.

### 78. Proximity Sensor API — NA — near-zero support; no call/proximity UX in a finance/habit app. Ext: MDN (draft status) — EXTERNAL VERIFICATION UNAVAILABLE for mobile support beyond spec draft. Next: none.

### 79. Screen Wake Lock API — NOW (narrow: onboarding video/celebration only if media added; else defer)
- Scoped: request during streak-celebration animation + release on end; guarded try/catch (SI<16.4 no-op). Client: `feedback.js`. Compat: CA/FA/SI 16.4+. Perm: none (visible-tab bound).
- Reasons to keep narrow: no video/long-task flow exists, so standing lock (e.g., cashier mode in inventory example) is NA — only transient celebration use.
- Ext: MDN Wake Lock + caniuse. Verify: release assertion test. Next: AUD-SND-01 (piggyback).

### 80. WebXR Device API — NA — no AR/VR feature; needs headset + HTTPS + permissions; zero journey fit. Ext: MDN WebXR. Next: none.

### 81. Web Share API — NOW — share streak card (no financial specifics, `specs/10`) + referral link (`REF_CODE` deep-link). `navigator.share` with clipboard fallback. Compat: CA/SI yes; FA partial. Ext: MDN Web Share + caniuse. Verify: share-sheet + fallback tests. Next: TASK AUD-SHARE-01 (with T11/R2 referral).

### 82. Web Share Target API — PRE — receiving shared images → receipt flow (AUD-CAP-01) needs manifest `share_target` + handler route + P03 amendment first. Compat: CA yes; SI/FA no. Reasons: (R1) depends on capture pipeline; (R2) handler UX undesigned; (R3) SI/FA fallback is file input anyway.
- Ext: MDN Share Target + caniuse. Next: after AUD-CAP-01.

### 83. Contact Picker API — UNS — CA-only; no contact-invite flow specified (referral uses link/code, `specs/10`); PII-adjacent permission without need. Ext: MDN Contact Picker + caniuse. Next: none.

### 84. Clipboard API — NOW — copy referral link/code + copy summary text; async read only where justified (paste IBAN? no — out of scope). `clipboard.writeText` + fallback `execCommand`. Compat: all (read needs focus/perm). Ext: MDN Clipboard + caniuse. Verify: copy-toast test. Next: AUD-SHARE-01.

### 85. Async Clipboard API — DUP (→84; async shape of same capability; same task).

### 86. Screen Orientation API — NOW — read orientation for chart layout (portrait vs landscape) + attempt lock only in fullscreen DeX video (none yet — so read-only use). `screen.orientation.angle` + change listener. Compat: CA/FA; SI partial (lock unavailable). Ext: MDN Screen Orientation. Next: TASK AUD-ORIENT-01 (with T16 charts).

### 87. Fullscreen API — NOW (narrow: ECharts fullscreen expand on MoneyOverview)
- Use case: expand cashflow chart to fullscreen for analysis; button-gated, Esc exits, fallback = enlarged dialog. Client: charts module. Compat: CA/FA; SI iPhone partial → fallback path.
- Ext: MDN Fullscreen + caniuse. Verify: enter/exit + fallback tests. Next: AUD-ORIENT-01.

### 88. Picture-in-Picture API — NA — no video element exists or is planned. Ext: MDN PiP. Next: none.

### 89. Window Controls Overlay API — NA — desktop PWA title-bar; mobile-irrelevant per inventory itself (`200_web_api_mobile.md:138`). Ext: MDN WCO. Next: none.

### 90. Launch Handler API — NOW — `launch_handler: focus-existing` so notification taps reuse the PWA window (`specs/11` deep-links). Manifest-only. Compat: CA; others ignore. Ext: MDN Launch Handler. Next: AUD-PWA-01.

### 91. WebGL API — PRE — only if ECharts canvas load forces `echarts-gl`; current plan uses SVG/canvas renderers (`specs/16`). Reasons: (R1) no 3D content specified; (R2) GPU context cost on low-end devices unmeasured; (R3) needs perf evidence (long-task entries) first.
- Ext: MDN WebGL + caniuse. Next: conditional on chart perf data.

### 92. WebGL2 API — DUP (→91; same conditional; no separate task).

### 93. WebGPU API — UNS — CA 121+/SI 26+ partial/FA no; no compute/render workload specified; ECharts does not require it. Ext: MDN WebGPU + caniuse. Next: none.

### 94. CanvasRenderingContext2D — NOW — receipt downscale (ID 8) + hand-rolled ring/streak SVG alternative + chart fallback (`specs/16`). Universal. Ext: MDN CanvasRenderingContext2D. Next: AUD-CAP-01 + T16.

### 95. Web Animations API — NOW — JS-driven micro-animations (confetti 300ms, sheet settle) complementing `motion.css`; all gated by `prefers-reduced-motion` (`specs/04` §10). Client: `motion.js` helper. Universal. Ext: MDN WAAPI. Verify: reduced-motion test. Next: TASK AUD-MOTION-01 (with T3).

### 96. requestAnimationFrame() — NOW — lerp/interpolation loop for shared-element + app-bar progress (`specs/04` §§1–3). Universal. Ext: MDN rAF. Next: AUD-MOTION-01.

### 97. Screen API — NOW (basic) — `screen.width/height` for chart density tiers (`specs/16`) + foldable reflow notes (`specs/03`); detailed Screen API gated (limited support). Ext: MDN Screen. Next: AUD-ORIENT-01.

### 98. CSSOM API — NOW — adoptedStyleSheets for theme tokens (light/dark/appearance in `specs/12`) + runtime motion-var tweaks. Client: theme module. Mostly stable. Ext: MDN CSSOM. Next: TASK AUD-THEME-01 (with T2/T8).

### 99. ResizeObserver API — NOW — chart resize + app-bar/scroll containers (`specs/16`, `04`). Universal. Ext: MDN ResizeObserver. Next: AUD-MOTION-01/T16.

### 100. IntersectionObserver API — NOW — lazy chart render when visible + lazy FAQ images (`specs/16` "don't render hidden tabs"). Universal. Ext: MDN IntersectionObserver. Verify: hidden-tab deferral test. Next: T16.
## IDs 101–150

### 101. WebCodecs API — NA
- Reasons: (R1) No video/audio encode-decode workload (receipt stills use canvas; no editor/streaming). (R2) CA-only practical support; SI partial — unusable as core path. (R3) Complexity (codec negotiation) with zero journey fit.
- Ext: MDN WebCodecs + caniuse. Next: none.

### 102. VideoEncoder API — DUP (→101; no separate need).

### 103. VideoDecoder API — DUP (→101).

### 104. AudioEncoder API — DUP (→101).

### 105. AudioDecoder API — DUP (→101).

### 106. VideoFrame API — DUP (→101).

### 107. Media Source Extensions API — NA — no streaming playback; budget-charts are static ECharts, not video. Ext: MDN MSE. Next: none.

### 108. Encrypted Media Extensions API — NA — no DRM content; needs license server (absent infra). Ext: MDN EME. Next: none.

### 109. HTMLMediaElement API — NA — no `<audio>/<video>` playback feature planned. Ext: MDN HTMLMediaElement. Next: none (revisit if onboarding video specified).

### 110. Media Capabilities API — PRE — only meaningful to pick receipt-video encoding or celebration media later; no media workload now. Ext: MDN Media Capabilities. Next: conditional on media workload.

### 111. Web Authentication API — PRE
- Repo: passkey is CONDITIONAL on identity architecture (`D-02`, `specs/07-auth-onboarding.md`: "Nanti Saja" path; no RP backend exists).
- Chain when enabled: PasskeyEnrollment → `navigator.credentials.create/get` → PHP RP challenge endpoints (new) → session. UI per spec 07 + fallback on 3× biometric failure.
- Compat: CA/SI/FA (platform authenticators). Perm: user gesture + RP ID HTTPS.
- Reasons: (R1) No RP backend (challenge/attestation verification endpoints undesigned in `specs/18`). (R2) Identity ADR OPEN (`D-09`) — passkey cannot precede it. (R3) Recovery flow (spec 07 fallback screen) must ship simultaneously to avoid lockouts.
- Ext: MDN WebAuthn + caniuse + webauthn.guide. Verify (later): attestation + fallback e2e on 2 devices. Next: TASK AUD-WEBAUTHN-01 (after identity ADR + T5).

### 112. Credential Management API — PRE — password/federated storage for the same auth flow (111); same blockers (no RP/backend, ADR open). Compat: CA full; SI/FA partial. Ext: MDN Credential Management. Next: AUD-WEBAUTHN-01.

### 113. Web Crypto API — NOW — idempotency keys, outbox hashing, VAPID key handling (R1.1), PKCE if OAuth later. `crypto.subtle` (secure context) + `getRandomValues`. Secure-context guaranteed (HTTPS/PWA). Ext: MDN Web Crypto (universal). Verify: key-uniqueness + redaction tests. Next: TASK AUD-CRYPTO-01 (with T18).

### 114. SubtleCrypto API — DUP (→113; same capability surface).

### 115. Crypto.getRandomValues() — DUP (→113; same task).

### 116. Permissions API — NOW — pre-check notification/camera/mic before primers (`specs/07` PermissionPrimer, `specs/11`); drives contextual UX (don't prompt system dialog after user tapped "Later"). Client: `permissions.js` with `catch` fallback (SI sparse descriptors). Compat: CA/FA; SI partial. Ext: MDN Permissions + caniuse. Verify: deny-once + never-ask-again paths. Next: TASK AUD-PERM-01 (with T5/T12).

### 117. Permissions Policy API — NOW — lock camera/mic/geolocation to self/none via meta + PHP headers; prevents third-party overreach. Low cost, real hardening. Ext: MDN Permissions Policy. Next: AUD-CRYPTO-01 (piggyback, T18 headers).

### 118. Secure Contexts API — NOW — gate crypto/clipboard/SW features on `isSecureContext` with graceful local-only fallback (HTTP dev). Universal. Ext: MDN Secure Contexts. Next: AUD-CRYPTO-01.

### 119. Content Security Policy — NOW — strict CSP (self + echarts CDN hash if remote; no inline) via `.htaccess`/PHP headers; `report-uri` to PHP endpoint feeding `specs/14` QA. Ext: MDN CSP. Verify: violation-report test. Next: AUD-CRYPTO-01 (with T9/T14).

### 120. Reporting API — NOW — CSP + deprecation reports to `api/v1/reports` (redacted, no PII). CA full; others partial →Beacon fallback (ID 60). Ext: MDN Reporting API. Next: AUD-CRYPTO-01.

### 121. Payment Request API — NA
- Reasons: (R1) Money movement is explicitly OUT of scope (`D-05`, `specs/01` non-goals, `specs/10` virtual-goal guardrail) — checkout contradicts the product contract. (R2) QRIS/Indonesian rails need PSP/backend integration that is OPEN/unverified (`D-04`); browser sheet alone processes nothing (inventory itself notes this, `200_web_api_mobile.md:200`). (R3) SI partial + method-data fragmentation with zero lawful use case.
- Ext: MDN Payment Request + caniuse. Next: none (revisit only if business model ADR approves payments).

### 122. Payment Handler API — NA — same as 121 (no payment app role; CA-only; needs SW payment scope). Ext: MDN Payment Handler. Next: none.

### 123. Payment Method Manifest — DUP (→122; declarative half of same capability).

### 124. Payment Request Button API — DEP — experimental, near-zero support; superseded thinking is plain Payment Request buttons rendered by the merchant. Reasons mirror 121 + experimental status. Ext: W3C payments docs (draft) — EXTERNAL VERIFICATION UNAVAILABLE for any stable mobile support. Next: none.

### 125. WebOTP API — NA
- Reasons: (R1) Auth uses email/social/passkey-conditional (`specs/07`) — no OTP step specified; adding SMS-OTP invents a flow. (R2) CA-only; SI/FA users need another path anyway. (R3) SMS-read permission sensitivity without need.
- Ext: MDN WebOTP + caniuse. Next: none (revisit if recovery-via-SMS specified).

### 126. Federated Credential (legacy) — DEP — superseded by FedCM (ID 127); MDN marks `FederatedCredential` deprecated path. Do not implement. Ext: MDN (deprecation note). Next: none.

### 127. FedCM API — RES
- Potential: Google/Apple sign-in via FedCM instead of per-provider SDK redirects (`specs/07` AuthHub).
- Open: (1) IdP/coverage decision absent (which providers?); (2) CA-only practical + SI 26+ partial — fallback OAuth redirects needed regardless; (3) account-linking/duplicates UX undesigned.
- Compat: CA yes / SI 26+ partial / FA no. Ext: MDN FedCM (active spec) — EXTERNAL VERIFICATION UNAVAILABLE for SI 26 behavior at audit time. Verify: IdP sandbox test. Next: TASK AUD-RES-03 (auth research, with T5).

### 128. Digital Credentials API — RES — wallet-presented credentials have no product role (no KYC/age-gate in specs); experimental + wallet-ecosystem dependent. Revisit only with compliance requirement. Ext: W3C Digital Credentials (draft) — EXTERNAL VERIFICATION UNAVAILABLE for mobile rollout. Next: none now; track.

### 129. Web Locks API — NOW — coordinate outbox flush + export builder across tabs/workers (prevents double-send of idempotent ops). `navigator.locks.request('outbox')` with try/finally release. Compat: CA/FA/SI 15.4+. Ext: MDN Web Locks + caniuse. Verify: two-tab flush test (single send). Next: AUD-SYNC-01.

### 130. Background Fetch API (cat-13 entry) — DUP (→68; same UNS verdict).

### 131. Web Workers API — NOW — export builder, search indexer, ECharts data crunch off main thread (`specs/12`, `18`, `19`). Client: `assets/js/workers/*.js` + MessageChannel (59) + structured clone (137). Universal. Ext: MDN Workers. Verify: long-task reduction measure. Next: AUD-WORK-01.

### 132. DedicatedWorker API — DUP (→131; same task).

### 133. SharedWorker API — UNS — SI unsupported; DedicatedWorker + BroadcastChannel (58) cover our needs without the compat hole. Ext: MDN SharedWorker + caniuse. Next: none.

### 134. Worklet API — DUP (→13/95 family; generic worklet has no standalone use — audio/paint/animation covered elsewhere; no task).

### 135. SharedArrayBuffer API — PRE — needs COOP/COEP (deployable via `.htaccess`, so not UNS) but no threaded workload exists (no WASM threads, no video). Reasons: (R1) workload-first rule — adopt when a measured bottleneck needs it; (R2) COOP/COEP risks breaking third-party embeds (ECharts CDN, fonts) — needs header audit; (R3) SI requires 15.2+ with same headers.
- Ext: MDN SharedArrayBuffer + caniuse. Next: conditional on perf evidence.

### 136. Atomics API — DUP (→135; same conditional).

### 137. Structured Clone Algorithm — NOW — postMessage payloads for workers/outbox (same chain as 131/59). Universal. Ext: MDN (structured clone) — EXTERNAL VERIFICATION UNAVAILABLE as standalone page; covered by Workers/MessageChannel docs. Next: AUD-WORK-01.

### 138. scheduler.postTask() — NOW — prioritized task scheduling (charts `user-visible` vs indexer `background`) with `setTimeout` fallback (SI/FA partial). Ext: MDN scheduler.postTask + caniuse. Next: AUD-WORK-01.

### 139. requestIdleCallback() — NOW — index rebuild + non-urgent flush in idle with `setTimeout` fallback (SI absent). Ext: MDN rIC + caniuse. Verify: SI fallback test. Next: AUD-WORK-01 (search index) + T19.

### 140. PerformanceObserver API — NOW — LCP/CLS/INP/longtask observation feeding QA budgets (`specs/13`, `14`: LCP<2.5s/CLS<0.1). Client: `perf.js` beacon on `pagehide` (ID 60). Entry support varies → feature-check per type. Ext: MDN PerformanceObserver. Verify: mark/measure e2e in CDP. Next: TASK AUD-PERF-01 (with T14).

### 141. WebNN API — UNS — experimental, CA-partial; SI/FA absent; no on-device model specified (categorization is server/heuristic later). Ext: MDN WebNN (draft) + caniuse. Next: none (track for R2 AI categorization).

### 142. WebGPU Compute API — UNS — same constraints as 93; no compute workload. Ext: MDN WebGPU. Next: none.

### 143. WebAssembly API — NOW (detection + readiness) — no WASM module today, but capability gate for future OCR/categorization fallback (inventory's own advice, `200_web_api_mobile.md:230`). Ship detection in `capabilities.js`; adopt module only with measured need. Universal. Ext: MDN WebAssembly. Next: AUD-RES-04 (OCR fallback research, R1.1).

### 144. WebAssembly SIMD — PRE — needs a WASM module first (see 143); CA/FA/SI 16.4+. Ext: MDN SIMD proposal. Next: conditional on 143 adoption.

### 145. WebAssembly Threads — PRE — needs COOP/COEP (see 135) + module; SI absent. Ext: MDN threads proposal. Next: conditional.

### 146. Compute Pressure API — RES — CA-only experiment; could gate chart fidelity, but `hardwareConcurrency/deviceMemory` (173/174) already cover adaptation with universal support. Needs value-proof vs simpler signals. Ext: W3C Compute Pressure (draft) — EXTERNAL VERIFICATION UNAVAILABLE for mobile behavior. Next: track; no task.

### 147. Shape Detection API — NA — CA-only family; no shape/object feature specified. Ext: MDN (Shape Detection overview). Next: none.

### 148. Face Detection API — NA — same as 147 + deprecated trajectory; no face use case (and biometrics never leave device per `specs/06`). Ext: MDN FaceDetector. Next: none.

### 149. Text Detection API — RES — receipt OCR fallback candidate (photo → amount/merchant suggest, always user-confirmed). Open: (1) CA-only — server-OCR vs WASM-OCR decision pending (AUD-RES-04); (2) accuracy on Indonesian receipts unmeasured; (3) needs P03/P09 amendment like any capture feature.
- Ext: MDN TextDetector (experimental). Verify: sample-receipt lab test. Next: AUD-RES-04 (with AUD-CAP-01).

### 150. BarcodeDetector API — DUP (→10; same NA verdict).
## IDs 151–200

### 151. DOM API — NOW — the app itself (render, bindings, sanitization for `<mark>` highlight in `specs/19`). All DOM insertion via sanitized helpers (XSS rule, `specs/13`). Universal. Ext: MDN DOM. Next: baseline of every UI task (T3–T8).

### 152. History API — NOW — hash-route back/forward for `#/uang?from&to`, search overlay stack (`specs/02`, `17`, `19`). `pushState` on same-document hash changes + `popstate` restore. Universal. Ext: MDN History. Verify: back-button restores range/search tests. Next: TASK AUD-ROUTER-01 (with T4).

### 153. Navigation API — PRE — modern nav interception could replace hash router later; needs CA 102+/SI 26.4+ baseline and a router migration (current plan is hash-based, `specs/02`). Reasons: (R1) hash router already specified and sufficient; (R2) FA unsupported — dual-stack cost; (R3) View-Transition interplay (160) untested on targets.
- Ext: MDN Navigation API + caniuse. Next: revisit post-MVP.

### 154. URL API — NOW — parse/build deep-links + hash params (`habitwealth://` ↔ `#/` mapping in `specs/02`). Universal. Ext: MDN URL. Next: AUD-ROUTER-01.

### 155. URLSearchParams API — NOW — `from/to/preset/cat/q` handling (specs 17/19). Universal. Ext: MDN URLSearchParams. Next: AUD-ROUTER-01.

### 156. MutationObserver API — NOW — a11y live-region helper + third-party-free DOM watching for ECharts container swaps. Small scoped use. Universal. Ext: MDN MutationObserver. Next: AUD-MOTION-01 (piggyback).

### 157. Selection API — NOW — read user selection for "search selected text" affordance + copy-summary flows (`specs/19`, referral in `10`). Universal. Ext: MDN Selection. Next: AUD-SEARCH-01 (piggyback, T19).

### 158. Range API — NOW — wrap search matches in `<mark>` (specs/19 highlight) safely with sanitization. Universal. Ext: MDN Range. Next: AUD-SEARCH-01.

### 159. Visual Viewport API — NOW — keyboard-aware layout (with ID 36) + zoom-aware chart sizing; `visualViewport.resize` listener with `window.resize` fallback (FA partial). Compat: CA/SI; FA partial. Ext: MDN Visual Viewport + caniuse. Verify: zoom-200% layout test (`specs/03` requires 200% text). Next: AUD-KBD-01.

### 160. View Transitions API — NOW (progressive) — document transitions for tab switches honoring `transitionFor()` relations (`specs/04`); CSS fallback (motion.css classes) where unsupported (FA); disabled under reduced-motion. Compat: CA 111+/SI 18+/FA no. Ext: MDN View Transitions + caniuse. Verify: reduced-motion + FA fallback tests. Next: AUD-MOTION-01.

### 161. Performance API — NOW — `performance.now()` timing for first-habit <3min funnel + custom measures (`specs/05`, `14`). Universal. Ext: MDN Performance. Next: AUD-PERF-01.

### 162. Navigation Timing API — NOW — startup/load breakdown for PWA shell QA (`specs/14` budgets). Universal. Ext: MDN Navigation Timing. Next: AUD-PERF-01.

### 163. Resource Timing API — NOW — ECharts chunk weight + asset audit vs 200KB budget (`specs/16`). Universal. Ext: MDN Resource Timing. Next: AUD-PERF-01 (with T16).

### 164. User Timing API — NOW — marks for habit-complete, sync-flush, search latency (`specs/05` events need timing props). Universal. Ext: MDN User Timing. Next: AUD-PERF-01.

### 165. Long Tasks API — NOW — detect main-thread jank (charts/indexer) on CA/FA; SI lacks it → frame-drop heuristic fallback. Ext: MDN Long Tasks + caniuse. Next: AUD-PERF-01.

### 166. Event Timing API — NOW (best-effort) — INP measurement where available (CA); first-input fallback elsewhere. Partial SI/FA noted, not blocking. Ext: MDN Event Timing + caniuse. Next: AUD-PERF-01.

### 167. Largest Contentful Paint API — NOW — LCP<2.5s budget evidence (`specs/13`); SI 18.2+ image-only noted in test plan. Ext: MDN LCP + caniuse. Verify: CDP trace + field note. Next: AUD-PERF-01 (with T14).

### 168. Layout Instability API — NOW — CLS<0.1 evidence; skeleton-first pattern (`specs/04`) exists to keep it green. Partial SI noted. Ext: MDN Layout Instability + caniuse. Next: AUD-PERF-01.

### 169. Performance Memory API — RES — CA-only `performance.memory`; could gate ECharts fidelity, but 173/174 already cover this universally. Needs proof of incremental value. Ext: MDN performance.memory (non-standard note). Next: track; no task.

### 170. Network Information API — NOW (hint only) — `effectiveType` downshifts chart fidelity/image size on 2G (`specs/16` adaptive note); never gates functionality (offline events + real requests are truth, per inventory §18 note). CA-only → default-full elsewhere. Ext: MDN Network Information + caniuse. Next: TASK AUD-NET-01 (with T16).

### 171. Navigator API — NOW — umbrella object; concrete uses are the individual entries. Listed for traceability; no separate task. Ext: MDN Navigator. Next: —.

### 172. Online and Offline Events — NOW — offline banner + flush triggers (`specs/15`); treated as hint, confirmed by real requests (inventory's own caution, `200_web_api_mobile.md:275`). Universal. Ext: MDN online/offline events. Verify: airplane-mode CDP test. Next: AUD-PWA-01.

### 173. navigator.hardwareConcurrency — NOW — worker pool sizing for indexer/export (IDs 131/137). Capped values accepted as hint. Universal. Ext: MDN hardwareConcurrency. Next: AUD-WORK-01.

### 174. navigator.deviceMemory — NOW — chart fidelity tiers with 170 (CA-only; assume mid-tier elsewhere). Ext: MDN deviceMemory + caniuse. Next: AUD-NET-01.

### 175. User-Agent Client Hints API — PRE — needs server `Accept-CH` opt-in + PHP parsing; `Sec-CH-UA-Mobile` could tune payloads, but no backend personalization specified. Reasons: (R1) server work undesigned; (R2) CA-only; (R3) UA string + feature detection suffice today.
- Ext: MDN Client Hints + caniuse. Next: revisit with backend ADR.

### 176. Network Information API (dup) — DUP (→170; same hint-only task).

### 177. Device Posture API — UNS
- Reasons: (R1) Foldables are a negligible slice of the Indonesian target; designing posture-specific layouts has no ROI evidence. (R2) CA-only; SI/FA absent. (R3) Responsive reflow (`specs/03` large-screen rules) already covers size changes generically.
- Ext: MDN Device Posture (experimental) + caniuse. Next: none.

### 178. Window Segments Enumeration API — UNS — same family as 177 (foldable-only, CA-only, covered by responsive rules). Ext: MDN Window Segments. Next: none.

### 179. Page Visibility API — NOW — pause chart animation/indexer when hidden; flush analytics on `visibilitychange=hidden` (with ID 60); resume sync on visible (`specs/08` foreground sync). Universal. Ext: MDN Page Visibility. Verify: hidden-pause test. Next: AUD-WORK-01 + AUD-ANAL-01.

### 180. Idle Detection API — NA
- Reasons: (R1) No pause-when-away feature specified (sync is foreground/manual). (R2) Permission-gated + CA-only — cost without consumer. (R3) `visibilitychange` (179) covers the real need.
- Ext: MDN Idle Detection. Next: none.

### 181. CSS Typed OM API — NOW — typed token reads/writes for theme switching (`specs/03`/`12` Appearance) with string fallback. Mostly CA/FA; SI partial → fallback path. Ext: MDN CSS Typed OM + caniuse. Next: AUD-THEME-01.

### 182. CSS Font Loading API — NOW — `document.fonts.ready` gate before first paint measure (prevents CLS from font swap, `specs/13` budget). Universal. Ext: MDN Font Loading. Verify: no-swap test. Next: AUD-THEME-01.

### 183. FontFace API — DUP (→182; same font-readiness task).

### 184. FontFaceSet API — DUP (→182; same task).

### 185. DOMParser API — NOW — CSV import parsing for transactions (export is JSON/CSV per `specs/12`; import is the natural counterpart) + sanitized HTML snippets. Needs P12 amendment for import screen (flagged). Universal. Ext: MDN DOMParser. Verify: malformed-CSV tests. Next: TASK AUD-IMPORT-01 (spec amendment + T7 follow-up).

### 186. XMLSerializer API — DUP (→185; same import/export task family).

### 187. Encoding API — NOW — UTF-8 encode for export files, VAPID keys, hash inputs (`specs/12`, `18`). Universal. Ext: MDN Encoding API. Verify: round-trip test (id-ID chars). Next: AUD-CRYPTO-01 (piggyback).

### 188. TextEncoder API — DUP (→187).

### 189. TextDecoder API — DUP (→187).

### 190. window.print() — NOW — print monthly report/budget summary (natural HabitWealth artifact; inventory example is invoice-like reports, `200_web_api_mobile.md:290`).
- UI: "Cetak" button on InsightSummary/Budget → print CSS (light, ink-friendly, masked values) → `print()`. Needs P10/P09 amendment for the button (flagged). Output varies by OS (no thermal-printer promise).
- Compat: all (output varies). Perm: none. Ext: MDN print() + caniuse. Verify: print-preview smoke via CDP PDF. Next: TASK AUD-PRINT-01 (spec amendment + print CSS).

### 191. WebSocketStream API — UNS — experimental CA-only; same verdict family as 53/54 with even narrower support. Ext: MDN (draft) — EXTERNAL VERIFICATION UNAVAILABLE for mobile behavior. Next: none.

### 192. Streams API — NOW — stream large export downloads + chunked response parsing (`specs/12` export with size guard via ID 44). `ReadableStream` + `Response.body` broadly supported. Ext: MDN Streams. Verify: 10k-row export memory test. Next: AUD-IMPORT-01 (export half).

### 193. Compression Streams API — NOW — gzip export client-side (`CompressionStream('gzip')`) to spare shared-host CPU; SI 16.4+. Fallback: uncompressed. Ext: MDN Compression Streams + caniuse. Next: AUD-IMPORT-01.

### 194. Web Locks API (dup) — DUP (→129; same cross-tab task).

### 195. File Handling API — PRE — PWA opening CSV/receipt files from OS ("Open with") needs manifest `file_handlers` + handler route + P12/P09 amendment; CA-PWA-only. Reasons: (R1) depends on import pipeline (AUD-IMPORT-01); (R2) handler UX undesigned; (R3) share-target/file-input cover mobile flows first.
- Compat: CA PWA / SI no / FA no. Ext: MDN File Handling + caniuse. Next: after AUD-IMPORT-01.

### 196. Protocol Handlers API — PRE — `registerProtocolHandler('web+habitwealth:')` for web-to-app links; the product deep-link (`habitwealth://`) is a native-scheme concern, and web-handler registration needs UX + allowlist review. Reasons: (R1) no web-link flow specified; (R2) CA/FA only, scheme allowlist limits; (R3) hash deep-links (152/154) suffice for MVP.
- Ext: MDN registerProtocolHandler + caniuse. Next: revisit with share/referral hardening.

### 197. URL Pattern API — NOW — SW + router route matching (`sw.js` navigation routing in `specs/15`, hash-route table in `specs/02`). CA/FA; SI absent → regex fallback. Ext: MDN URLPattern + caniuse. Verify: fallback test. Next: AUD-PWA-01 + AUD-ROUTER-01.

### 198. Web Speech API (dup) — DUP (→18/19; research + readout tasks).

### 199. Web Animations API (dup) — DUP (→95; same motion task).

### 200. Screen Capture API — NA
- Reasons: (R1) No screen-sharing/support-remote feature in any spec (Help is FAQ/chat placeholder, `specs/12`). (R2) Desktop-oriented; Android partial, iOS absent. (R3) Privacy-sensitive permission without a journey.
- Ext: MDN getDisplayMedia + caniuse. Next: none.

---

## Matrix reconciliation note
Row count verified: 200 headings (`### N.`). Classification tally is computed in `06-final-report.md` from these rows. Duplicate targets: 12→11, 22→21, 23→21, 29→24/26, 30→24/26, 34→32, 49→47/48, 52→51, 57→56, 85→84, 92→91, 102–106→101, 114→113, 115→113, 123→122, 130→68, 132→131, 134→13/95, 136→135, 150→10, 176→170, 183→182, 184→182, 186→185, 188→187, 189→187, 194→129, 198→18/19, 199→95.
