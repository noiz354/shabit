# 01 — Repository Discovery (read-only audit, 19 Sep 2026)

> Source of truth: actual repo contents. No routes/components/endpoints are invented in this document.

## 1. Application purpose, platforms, users
- HabitWealth: mobile habit + personal-money tracker, initial Indonesian market hypothesis (urban adults, 22–35 as research hypothesis, not exclusion). Evidence: `HabitWealth_UX_Design_Suite_Reconciled_v5.md:37-63` (framing, jobs-to-be-done, principles), `specs/01-product-brief.md`.
- Platforms: iOS + Android via mobile web CSR (no native code in repo). Decision `D-01` (v5 doc §3). Target: installable PWA, `display: standalone` — `specs/15-pwa.md`.
- Hard guardrails: manual-first, no money movement/custody/auto-debit (`D-05`), no named bank/health provider until verified (`D-04`), descriptive insights only (`D-07`).

## 2. Frontend: framework, routes, layouts, components, navigation
- **No application source exists.** Repo contains: 20 product specs (`specs/00–19`), One UI tokens (`DESIGN.md`, `assets/css/motion.css`), static token catalogs (`preview.html`, `preview-dark.html`), empty scaffolds (`public_html/api/`, `public_html/assets/`, `assets/js/`).
- Planned (not implemented): Vite vanilla CSR → static `dist/` → `public_html/`; hash routes `#/beranda #/habit #/uang #/pengaturan` (`specs/02-ia-navigation.md`); bottom tabs ≤5, Two-Zone One UI layout (`specs/03-design-tokens.md`); ECharts core + selective imports (`specs/16-visualization.md`).
- `preview.html` (1027 lines): pure HTML/CSS token catalog, **zero JavaScript API usage** (no handlers, no fetch, no storage — verified by inspection; static `<style>` + markup only).

## 3. User journeys / workflows (planned, per specs)
First-value (<3 min) → daily habit completion → manual transaction → budget alerts → virtual savings goal (R2) → export/delete. Sources: `specs/07-auth-onboarding.md`, `08-habit.md`, `09-money.md`, `10-insights-goal.md`, `12-settings-lifecycle.md`.

## 4. State, services, API clients
None implemented. Planned: IndexedDB/localStorage source-of-truth + outbox queue (`specs/06-data-privacy.md`, `13-php-api.md`, `15-pwa.md`); `/api/v1/*` contracts (`specs/18-api-design.md`); global search index (`specs/19-search.md`).

## 5. Backend, jobs, schemas
None implemented. Planned: thin PHP 8.x JSON (`public_html/api/v1/*.php`), PDO prepared, session-cookie + CSRF, idempotency keys (`specs/13-php-api.md`, `18-api-design.md`). No daemons/cron/websockets (shared-hosting constraint). DB schema explicitly OPEN (ADR required).

## 6. Auth/security boundaries (planned)
Session cookie HttpOnly/Secure/SameSite; re-auth for balance reveal, goal changes, export/delete (`specs/07`, `18`). No secrets/biometrics/raw credentials in client storage or logs (`specs/06`).

## 7. Existing browser API integrations
**None.** Zero `navigator.*`, `window.*`, worker, or storage calls exist in the repo (only file with JS is the audit feature-detection sample inside `200_web_api_mobile.md:335-361`, which is documentation, not app code).

## 8. Offline/cache/sync/background
Planned only: SW app-shell + outbox flush (`15-pwa.md`); Background Sync as progressive enhancement; Web Push deferred to R1.1 with VAPID design in `18-api-design.md`.

## 9. Upload/media/notifications/payments/realtime
Planned: local notifications (MVP), file input for future receipt capture (no spec yet — flagged in §10/roadmap as spec amendment required), no payments (out of scope), no realtime (polling/manual refresh).

## 10. Mocks, flags, tests, observability, deploy
- No tests, no mocks, no feature flags in repo. QA matrix planned (`specs/14-qa-release.md`).
- Tooling verified live in this environment: Chrome CDP 127.0.0.1:9227 (Chrome/153), `codegraph` index (0 nodes — no source yet), chrome-devtools MCP + codegraph MCP wired globally (see PROGRESS 19 Sep 2026).

## Discovery verdict
This is a **spec-stage** repository. The audit therefore maps each API against (a) the thin static prototype (`preview.html`), and (b) the planned architecture (`specs/00–19`, TODO T2–T19). Classifications `ALREADY_INTEGRATED`/`PARTIALLY_INTEGRATED` are expected to be **zero**; this is stated explicitly so matrix reviewers do not misread absence as oversight. Any feature needing a new screen requires a P03 upstream revision per P00 dependency rules.
