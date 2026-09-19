# 05 — Implementation Roadmap

> Depends on TODO T2–T19 (foundation first). Parallel-safe groups marked [P]. Rollback default: revert commit + clear SW cache version; data tasks additionally require outbox drain check.

## Wave 0 — Foundation (with T2–T5)
- **AUD-STORE-01** [P] | APIs 41,42,44,45,47,48 | None → versioned storage layer (prefs/history/IDB/outbox/OPFS+fallback, persist() post-onboarding). Files: `assets/js/storage/*`. BE/DB: none (client). Sec: no raw creds/PII beyond scope. Accept: migration v1→v2 + quota-full path. Verify: unit + CDP storage panel. Rollback: v-guard (old code ignores new stores).
- **AUD-ROUTER-01** [P] | APIs 152,154,155,197 | None → hash router + param restore + SW URLPattern. Files: `assets/js/router.js`, `sw.js`. Accept: back restores range/search. Verify: CDP back-stack test.
- **AUD-CRYPTO-01** [P] | APIs 113,117,118,119,120,187 | None → crypto helpers + CSP/PP headers + report endpoint + UTF-8 utils. Files: `assets/js/crypto.js`, `.htaccess`, `api/v1/reports.php`. BE: new endpoint (redacted). Accept: violation reported, keys unique. Verify: CSP-report test.
- **AUD-PERM-01** [P] | API 116 | None → permission pre-checks driving primers. Files: `assets/js/permissions.js`. Accept: "Later" never triggers system dialog. Verify: deny/never-ask paths.
- **AUD-ANAL-01** [P] | APIs 60,179 | None → redacted analytics queue + Beacon/pagehide flush. Files: `assets/js/analytics.js`. Accept: zero PII in payloads (test asserts). Verify: payload inspection test.

## Wave 1 — Shell, motion, PWA (with T3,T4,T15)
- **AUD-PWA-01** | APIs 61,62,66,69,70,90,172 | Scaffold → installable offline PWA. Deps: AUD-STORE-01. Files: `manifest.webmanifest`, `sw.js`, `offline.html`, install sheet. Accept: Lighthouse PWA pass + offline full flow. Verify: CDP offline + update-prompt tests.
- **AUD-MOTION-01** [P] | APIs 95,96,99,156,160 | CSS-only → JS gesture/motion layer w/ fallbacks. Deps: T3. Files: `assets/js/gestures.js`, `motion.js`. Accept: spec 04 §11 checklist. Verify: touch-emulation + reduced-motion + FA-fallback.
- **AUD-GEST-01** | APIs 31,32,33 | None → pointer-first gestures + button alternatives. Deps: AUD-MOTION-01. Verify: cancel snap-back tests.
- **AUD-KBD-01** [P] | APIs 36,159 | None → keyboard-aware CTA + viewport handling. Verify: Android device + zoom-200% tests.
- **AUD-THEME-01** [P] | APIs 98,181,182 | Static tokens → runtime theme + font-ready gate. Verify: no-swap CLS test.
- **AUD-SYNC-01** | APIs 58,129 | Single-tab → multi-tab safe sync. Deps: AUD-STORE-01. Verify: two-tab single-send race test.

## Wave 2 — Features (with T6–T12,T16–T19)
- **AUD-API-01** | APIs 51 | None → fetch wrapper + idempotency + paging. Deps: AUD-STORE-01. Files: `assets/js/api.js`. Verify: retry/dupe tests.
- **AUD-WORK-01** [P] | APIs 131,59,137,138,139,173 | Main-thread → worker indexer/export + scheduler. Verify: long-task delta measure.
- **AUD-HAPT-01** [P] | API 40 | None → setting-gated vibration map. Verify: pattern-once + SI no-crash.
- **AUD-SND-01** [P] | APIs 11,79 | None → optional blip (OFF default) + transient wake-lock. Verify: silent-mode test.
- **AUD-SPCH-01** [P] | API 19 | Text-only insights → read-aloud button. Verify: cancel-on-navigate + voice fallback.
- **AUD-NOTIF-01** | APIs 65,67 | None → local notification matrix + badge. Deps: AUD-PERM-01. Verify: grant/deny/quiet-hours/mute tests.
- **AUD-SEARCH-01** | APIs 37,157,158 | No search → global search + highlight. Deps: AUD-WORK-01. Verify: IME + SR-announce + offline-badge tests (T19).
- **AUD-ORIENT-01** [P] | APIs 86,87,97 | Fixed layout → adaptive + fullscreen chart w/ fallback. Verify: rotate + SI-fallback tests.
- **AUD-SHARE-01** [P] | APIs 81,84 | None → share card + referral copy + fallbacks. Verify: sheet + clipboard-toast tests.
- **AUD-PERF-01** [P] | APIs 140,161–168 | No telemetry → perf observer + budgets evidence. Verify: CDP trace vs LCP<2.5/CLS<0.1.
- **AUD-NET-01** [P] | APIs 170,174 | Full fidelity → adaptive tiers (hint-only). Verify: 2G-throttle test.
- **AUD-IMPORT-01** | APIs 185,192,193 | Export-plan → CSV import + streamed/gzipped export. Needs P12 amendment first. Verify: malformed-CSV + 10k-row memory tests.
- **AUD-PRINT-01** [P] | API 190 | None → print CSS + masked print views. Needs P09/P10 amendment. Verify: CDP print-to-PDF.
- **AUD-CAP-01** | APIs 1,2,4,5,8,38,47,48,45,94 | No capture → receipt photo pipeline. Needs P03/P09/P18 amendment + attachment endpoint + object store. Verify: compress-size + track-stop + offline-queue tests. Parallel: NO (backend dep).

## Wave 3 — Prerequisite-gated (post-ADR / R1.1)
- **AUD-WEBAUTHN-01** | APIs 111,112 | Password/social → +passkey. Deps: identity ADR + RP endpoints + T5. Verify: attestation + 3×-fail fallback e2e.
- **AUD-PUSH-01** | API 64 | Local-only → Web Push. Deps: T12 + T18 + PHP sender. Verify: R1.1 push e2e (opt-in → quiet-hours → tap-route).
- **AUD-RES-01** | API 18 | — → voice-note research spike (id-ID WER on 2 devices). Output: decision + fallback plan.
- **AUD-RES-02** | API 35 | — → DeX keyboard research (low priority).
- **AUD-RES-03** | API 127 | — → FedCM vs OAuth-redirect decision (IdP sandbox).
- **AUD-RES-04** | APIs 143,149 | — → OCR fallback decision (TextDetector lab vs WASM vs server).

## Parallel groups
[P]-marked tasks run concurrently after Wave 0. AUD-CAP-01, AUD-WEBAUTHN-01, AUD-PUSH-01 are strictly sequenced on their deps. Research spikes (RES-01–04) run anytime, time-boxed ½ day each.
