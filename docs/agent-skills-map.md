# Agent Skills Map — HabitWealth OneUI CSR + PHP shared hosting

> Target folder: this repo. Workflow backbone: Addy Osmani lifecycle (Define → Plan → Build → Test → Review → Simplify → Ship). Status 20 Sep 2026: 59 local skills + 2 mirrored from `addyosmani/agent-skills` (MIT) = 61. Load via `skill` tool by name.

## Lifecycle routing (use per phase, not all at once)

| Phase | Skill | For what in this project |
|---|---|---|
| Define | `spec-driven-development` | Sudah dipakai (specs/00–19). Hidupkan tiap ada perubahan scope. |
| Define | `interview-me`, `idea-refine`, `brainstorming` | Gali requirement ambigu (provider bank, pricing, OCR) sebelum spec. |
| Plan | `planning-and-task-breakdown`, `writing-plans` | Pecah T2–T19 / AUD-W0–W3 jadi tugas ≤5 file. |
| Plan | `code-architect`, `api-and-interface-design` | Desain modul CSR + kontrak `/api/v1/*` (specs/18). |
| Build | `incremental-implementation` | Satu slice per sesi (satu layar / satu endpoint). Wajib. |
| Build | `context-engineering` | Load potongan spec + file relevan saja, bukan seluruh spec. |
| Build | `source-driven-development` (mirrored) | Verifikasi ke docs resmi: vite.dev, echarts.apache.org, php.net, developer.chrome.com, web.dev, MDN, caniuse. Wajib untuk pola framework. |
| Build | `frontend-ui-engineering` (mirrored) | Semua UI: token-only, a11y, skeleton, anti-AI-aesthetic. Wajib untuk T3–T8/T15–T17/T19. |
| Build | `frontend-design` | Arah visual di luar token bila diperlukan. |
| Build | `test-driven-development` / `tdd` | Red-green untuk logika (streak, budget, range, outbox). |
| Build | `doubt-driven-development` | Review adversarial untuk uang, auth, export/delete, sync. |
| Test | `verification-before-completion` | Bukti dulu (CDP run, `php -S` smoke, build report) baru klaim DONE. Wajib. |
| Test | `systematic-debugging`, `debugging-and-error-recovery` | Root-cause saat test/build gagal. |
| Test | chrome-devtools MCP (no skill file) | Browser smoke di 127.0.0.1:9227: install prompt, offline, chart SR, range URL. |
| Review | `requesting-code-review`, `code-reviewer`, `code-review` | Review tiap wave selesai. |
| Review | `code-quality`, `code-simplification` | Jaga bundle <200KB + readability. |
| Review | `security-and-hardening` | Wajib untuk `api/v1/*`, session/CSRF, masking, redacted logs. |
| Ship | `shipping-and-launch`, `finishing-a-development-branch` | Checklist FTP `dist/` → `public_html/`, rollback (revert + SW version). |
| Ship | `git-workflow-and-versioning` | Commit per tugas, pesan ringkas. |
| Scale | `dispatching-parallel-agents`, `subagent-driven-development`, `using-git-worktrees` | Task [P] paralel di roadmap 05. |
| Memory | `memory-discipline`, `remember`, `recall`, `lesson` | Simpan keputusan (provider, threshold OPEN) antar sesi. |
| Meta | `using-superpowers`, `using-agent-skills` | Aturan discovery skill. |

## Backend PHP 40-shared (no skill PHP khusus — komposisi ini)
1. `api-and-interface-design` → kontrak endpoint (specs/18 kanonis).
2. `source-driven-development` → verifikasi ke php.net (PDO, session, openssl VAPID) sesuai versi host (`php -v`).
3. `security-and-hardening` → prepared statements, CSRF, rate-limit, CSP/report endpoint, tanpa PII di log.
4. `test-driven-development` → uji kontrak via `php -S` + curl (Given/When/Then specs/14).
5. `find-docs` → ambil referensi PHP/ECharts/Vite terbaru saat ragu versi.

## Project adaptations (deviasi dari default skill, dicatat jujur)
- Vanilla CSR, bukan React: pola `useState/Context/React Query` di skill diganti store hash + IndexedDB + fetch wrapper (`assets/js/`).
- Tanpa Node runtime di host: build lokal saja; skill yang menyarankan SSR/daemon diabaikan (Never di AGENTS.md).
- ECharts: impor `echarts/core` selektif + lazy scatter (bukan full bundle).
- Threshold motion (velocity/progress) masih OPEN — skill tidak boleh mengarang angka resmi.

## Missing / intentionally not installed
- `browser-testing` (Addy pack): tercakup MCP chrome-devtools + `verification-before-completion`; tidak diinstal.
- Skill PHP khusus: tidak ada di pack; komposisi di atas + `find-docs` mencukupi.
- Install record: `npx skills` interaktif gagal mendarat 20 Sep 2026 → 2 skill di-mirror verbatim (atribusi di tiap file).
