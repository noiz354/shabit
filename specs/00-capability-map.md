# Spec: 00 — Capability Map (Addy Osmani SDD Phase 0)

> Gated. Human reviews module boundaries + dependency direction before any module spec.

## Objective
Memecah HabitWealth (HabitWealth_UX_Design_Suite_Reconciled_v5.md) menjadi modul yang bisa di-spec, di-build, dan diverifikasi terpisah, dalam batas CSR + PHP shared-hosting (40-shared, no SSR, no Node runtime).

## Tech Stack
- CSR: Vite vanilla (build lokal) → static `dist/` → upload ke `public_html/`. Fallback: hand-authored HTML/CSS/JS.
- PHP 8.x thin JSON API + MySQL/MariaDB (opsional di MVP). Apache + `.htaccess` SPA fallback.
- Sumber visual: `DESIGN.md` + `specs/04-motion-behavior.md`.

## Capability Map (stable kebab-case ids, tidak di-rename mid-initiative)

```
shell-nav ──▶ auth-onboarding ──▶ habit ──┐
                              ──▶ money ──┼──▶ insights-goal ──▶ notifications
                                          └──▶ settings-lifecycle ──▶ php-api ──▶ qa-release
design-tokens + motion ──▶ semua modul fitur (dependency satu arah)
data-privacy ──▶ habit, money, insights-goal, settings-lifecycle
analytics ──▶ semua modul (event names saja, bukan implementasi tracker)
```

| Module id | Consumer / data sendiri | Bisa di-cut tanpa rewrite lain? | Build order |
|---|---|---|---|
| `shell-nav` | App shell, bottom tabs, router hash, app-bar | Tidak (fondasi) | 1 |
| `design-tokens` | CSS vars, tipografi, radius, elevasi | Tidak | 1 |
| `motion` | Durasi/easing/spring, transisi, reduced-motion | Tidak (cross-cutting) | 1 |
| `auth-onboarding` | Signup/login, consent, permission primer, first habit <3 mnt | Ya (bisa mock session) | 2 |
| `habit` | HabitEntry, streak, reminder lokal | Ya | 3 |
| `money` | Transaction, budget, masking | Ya | 3 |
| `insights-goal` | Virtual savings goal (BUKAN transfer uang) | Ya, R2 | 4 |
| `notifications` | Preference center, inbox, templates | Ya | 4 |
| `settings-lifecycle` | Export/delete, help, appearance | Tidak (compliance) | 4 |
| `data-privacy` | Konsep User/Consent/Connection/SyncRun | Tidak | 2 |
| `analytics` | Event dictionary snake_case | Ya | 2 |
| `php-api` | `api/*.php` kontrak semantik | Ya (CSR bisa local-only) | 5 |
| `qa-release` | Traceability, Go/No-Go, store listing | Tidak | 6 |

## Dependency rules
- `P03 IA` = source of truth screens/navigasi. Modul fitur tidak boleh menambah screen tanpa revisi P03.
- `P04 tokens+motion` = source of truth visual. Dilarang hardcode warna/durasi di modul fitur.
- `P05 analytics` = source of truth event names. Modul fitur hanya trigger nama yang sudah ada.
- `P06 data-privacy` = source of truth sensitivitas. Tidak ada skema DB final di spec produk.

## Commands
```
Build: npm run build        # vite build -> dist/
Dev:   npm run dev
Preview CSR: npx serve dist
PHP smoke: php -S localhost:8000 -t public_html
```

## Boundaries
- Always: manual-first tanpa integrasi; sodorkan asumsi sebagai ASSUMPTION/OPEN/NEEDS VERIFICATION.
- Ask first: menambah modul baru, mengubah arah dependensi, menambah endpoint PHP.
- Never: money movement/custody/auto-debit; klaim provider bank/health; klaim legal/UU PDP pasal; SSR/Node di shared hosting.

## Success Criteria
- [ ] Human approve peta modul + arah dependensi + urutan build.
- [ ] Tidak ada cycle dependensi.
- [ ] Setiap modul punya 1 spec file di `specs/`.

## Open Questions
- Apakah `php-api` termasuk MVP atau R1.1? (default: MVP = CSR local-only, PHP = health-check saja)
