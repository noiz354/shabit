# SKILL.md — habitwealth-oneui (project-only)

> Project-local skill. Berlaku HANYA untuk repo ini. Bukan skill global.

## name
habitwealth-oneui

## description
Build HabitWealth CSR One UI di PHP shared hosting: pakai P00 contract, tokens DESIGN.md, motion binding specs/04, screen contract Indonesia, tanpa money movement/SSR/PII.

## when_to_use
Setiap tugas HabitWealth: IA, tokens, motion, auth/habit/money/insight/notif/settings, PHP tipis, QA.

## workflow
1. Baca `specs/00-capability-map.md` + spec modul relevan + `AGENTS.md`.
2. SPECIFY→PLAN→TASKS→IMPLEMENT gated; update `TODO.md`+`PROGRESS.md`.
3. Visual hanya dari `specs/03*` + `specs/04-motion*` (token CSS). Dilarang hardcode.
4. Tiap layar isi kontrak P00: purpose/entry-exit/hierarchy/data/states/rules/a11y/privacy/analytics/trace/phase.
5. Motion: deeper=up/back=down/peer=horizontal/sheet bawah; shared-element habit/money card→detail; app-bar snap; AsyncState; skeleton; reduced-motion fade 150ms.
6. Guardrails: masking default, re-auth sensitif, consent berlapis tanpa preselect, korelasi≠kausalitas, virtual goal bukan transfer, tanpa klaim provider/legal/E2EE.
7. Verify: first habit <3mnt; LCP/CLS diukur; kill-criteria + Gate A–E.

## references
- `HabitWealth_UX_Design_Suite_Reconciled_v5.md` (P00–P15, D-01..D-10)
- `DESIGN.md`, `preview.html`, `reference/oneui/` (hasil unzip)
- `specs/00..14`, `assets/css/motion.css`, `TODO.md`, `AGENTS.md`
- Full skill path: `.opencode/skills/habitwealth-oneui/SKILL.md`

## skills routing (wajib per fase — detail: `docs/agent-skills-map.md`)
- Build UI: `frontend-ui-engineering` + `frontend-design` (token-only, anti-AI-aesthetic, a11y)
- Verifikasi pola: `source-driven-development` (vite.dev, echarts.apache.org, php.net, MDN, caniuse — kutip URL)
- Cara kerja: `incremental-implementation` + `context-engineering` + `test-driven-development`
- Backend PHP: `api-and-interface-design` + `security-and-hardening` + `find-docs`
- Kritis (uang/auth/sync/delete): `doubt-driven-development` sebelum klaim selesai
- Selesai = bukti: `verification-before-completion` (CDP 9227 run, `php -S` smoke, build report)
- Rilis: `shipping-and-launch` + `git-workflow-and-versioning`; paralel: `dispatching-parallel-agents`
