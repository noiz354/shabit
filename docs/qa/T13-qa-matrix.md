# T13 — QA Matrix, Traceability & Go/No-Go (spec 14)

> Status per item: **PASS** (ada bukti otomatis/terukur), **PARTIAL** (bukti sebagian), **NOT TESTED** (belum ada bukti — bukan klaim lolos), **BLOCKED** (butuh prasyarat), **FAIL**.
> Sesuai kill-criteria P00 §10: tidak ada klaim PASS tanpa bukti. Bukti = file test (`tests/*.test.js`, `npm test`), output build (`npm run build`), smoke browser (bila ada).
> Lingkungan bukti sesi ini: sandbox Linux, Node 22, vitest + happy-dom + fake-indexeddb (**bukan perangkat fisik**). LCP/CLS di device = NOT TESTED.
> Verifikasi independen owner (19 Sep 2026): checkout branch + `npm install` + `npm test` → 34/34 PASS (sebelum penambahan test sesi lanjutan). Kegagalan awal = `node_modules` basi → **selalu `npm ci` setelah checkout** (README).
> Update lanjutan (sesi 2): **51/51 PASS** (`tests/{auth,auth-views,core,ui-views,data}.test.js`). Status NOT TESTED/BLOCKED **tidak diubah** tanpa bukti baru (syarat merge c).
> Update sesi 3 (T12): **59/59 PASS** (+`tests/notify.test.js` 8). Baris HW-NTF ditambahkan di bawah.

## 0. Cara menjalankan bukti
```
npm ci
npm test            # vitest run → tests/{auth,auth-views,core,ui-views,data}.test.js (51 tes)
npm run build       # ukuran bundle + precache
npm run dev         # smoke manual: #/auth → carousel → hub → consent → passkey → first-habit → #/beranda?first=1
```

## 1. Traceability (req → layar → event → modul → bukti)
| Req | Layar (spec 02) | Event (spec 05) | Modul | Bukti | Status |
|---|---|---|---|---|---|
| HW-PRD (first value <3mnt) | AuthSplash → AuthOnboarding → AuthHub → AuthConsent → PasskeyEnrollment → FirstHabit → HomeDashboard(first-use) | `signup_completed{method,day}`, `onboarding_completed{duration_s,skipped}` | `src/auth.js`, `src/views-auth.jsx`, `src/router.js` (authGate) | `tests/auth.test.js` (state machine, guard, events tanpa email), `tests/auth-views.test.js` (DOM: consent, Nanti Saja, hub states, first habit + completion) | **PASS** (unit/DOM); durasi <3mnt di manusia = NOT TESTED |
| HW-HAB | HabitToday/Editor/Detail | `habit_completed{habit_id_hash,habit_type,time_of_day}` | `src/habit.js`, `src/views.jsx` | `tests/auth-views.test.js › AuthFirstHabit`; `tests/data.test.js › Habit` (complete/undo streak + entry + outbox POST/DELETE, update/delete, 3 template); `tests/ui-views.test.js › Habit` (template → kartu tanpa reload, toggle ✓/Batal) | **PASS** (unit/DOM); detail histori + hapus destruktif = ada UI, NOT TESTED |
| HW-MNY | MoneyOverview/Feed/Add | `transaction_created{kind,category,has_note}` | `src/money.js` | `tests/core.test.js › Uang` (masking, `Rp10.000`, re-auth); `tests/data.test.js › Uang` (filter from/to/cat/q, sort, budget ok/warning/over 80/100%, get/delete, clearReAuth) | **PASS** (logika); tampilan feed/donut = NOT TESTED visual |
| HW-DAT (sync/recovery) | System states offline/stale/partial; crash-recovery notice di Splash | `sync_failed/recovered` | `src/storage/outbox.js`, `src/auth.js restoreSession` | `tests/auth.test.js › restoreSession`; `tests/data.test.js › Outbox` (drain: 1 kirim per entri, retry pakai Idempotency-Key sama, 409 = replay sukses, failed → retry) | **PASS** (drain tanpa duplikat, unit); R1.1 partner/stale/partial = BLOCKED |
| HW-NTF | PermissionPrimer (post first-habit), NotificationPreferences | `permission_granted/denied{scope}`, `notification_opened` | `src/permissions.js`, `src/notifications.js`, `showPermissionPrimer` | `tests/core.test.js › Permissions` ("Later" tidak memicu dialog sistem; denied cooldown 7 hari), `tests/auth-views.test.js › Permission primer` (Nanti/Izinkan/deny fallback copy) | **PASS** (logika); tampilan notifikasi OS = NOT TESTED |
| HW-NTF | NotificationPreferences + NotificationInbox (spec 11 amandemen T12) | `notification_opened/dismissed{id,category,deep_link}`, `budget_threshold_hit{category,pct,month}` | `src/notify.js`, `src/views-notify.jsx`, `public/sw-notify.js` | `tests/notify.test.js` (Quiet Hours tz-user + wrap; deferral/QUIET_EXPIRED/system; dedup/mute; expiry→arsip; prioritas; copy ≤40 tanpa Rp; budget 80/100 sekali per kategori/bulan; streak_7 sekali; evaluateTriggers idempoten; layar Inbox tab/Buka/Arsip/event; layar Preferensi persist + PATCH tanpa PII + email nonaktif + primer bukan dialog) | **PASS** (unit/DOM); notifikasi OS nyata + klik SW + Badging + timer latar = **NOT TESTED** (perangkat) |
| HW-INS (spec 10 amandemen T11) | InsightSetup → WeeklyMonthlySummary, VirtualSavingsGoal, WithdrawFromGoal, StreakCelebration (`#/insight`) | `insight_viewed{period,has_scatter,confidence}`, `goal_created{daily_bucket}`, `goal_completed{days}`, `goal_withdrawn{reason}`, `celebration_shared/dismissed{streak_day,never_again}` | `src/insight.js`, `src/views-insight.jsx`, `src/ui.js switchRow`, `src/money.js getManualBalance` | `tests/insight.test.js` (11: opt-in OFF default; ≥7 hari per sisi; scatter ≥90 hari; alokasi 1×/hari + INSUFFICIENT ramah; undo ≤5 dtk vs UNDO_EXPIRED; tarik RE_AUTH_REQUIRED; perayaan 1×/habit/milestone + never; event tanpa nominal/judul; statik token-only) | **PASS** (unit/DOM); ECharts scatter nyata, haptic, visual perangkat = **NOT TESTED** |
| HW-SET | SettingsHub › Akun/Data & Privasi (riwayat consent + cabut), Export/Delete | `export_requested`, `deletion_requested` | `src/settings.js`, `src/views.jsx`, `src/ui.js`, `src/auth.js revokeConsent` | `tests/auth.test.js › consent`; `tests/data.test.js › Pengaturan` (export/delete/wipe → RE_AUTH_REQUIRED tanpa re-auth; export tercatat; delete pending + cancel); `tests/ui-views.test.js` (Hapus akun: confirmSheet destruktif → sheet verifikasi → permintaan tercatat; Batal = tidak ada permintaan) | **PASS** (logika + DOM); OPFS nyata = NOT TESTED (happy-dom) |
| Spec 17 range | Picker global + hash state | `range_changed` | `src/range.js`, `src/router.js` | `tests/core.test.js › Router`, `› Range presets` | **PASS** (parse/build/restore, preset from≤to) |
| Spec 19 search | Search sheet 4 scope | `search_opened{entry}`, `search_executed{char_len,result_count,scope,offline}`, `search_result_opened{scope}`, `search_history_cleared` | `src/search.js`, `src/workers/search-indexer.js`, `src/storage/prefs.js` | `tests/core.test.js › Search history`, `› Analytics`; `tests/data.test.js › Search` (ranking exact>prefix>substring — **bug diperbaiki**: akumulasi n-gram); `tests/search-ui.test.js` (highlight `<mark>` DOM tanpa innerHTML, **jalur worker asli** vs main thread paritas ranking + normalisasi `Rp`/titik — **bug diperbaiki**: main-thread tidak membuang `rp`; UI token-only; tabs `aria-pressed`; offline badge ikon+teks; history chips; `result_count` nyata — **bug diperbaiki**: selalu 0) | **PASS** (unit/DOM, worker via skrip asli); Worker nyata di browser = NOT TESTED |
| Spec 17 range picker | Sheet rentang (app bar 📅) | `range_changed{preset,days,module}`, `range_custom_applied{days}` | `src/range.js` (`openSheet`, `validateCustomRange`) | `tests/detail-range.test.js` (preset aria-pressed; dari>sampai → error inline `role=alert`, **`alert()` tidak dipanggil** — sebelumnya 3× alert; kustom valid → setRange + event + hash; preset 7H → event) | **PASS** (DOM); empty state + `range_empty_shown{module,days}` → `tests/detail-range.test.js › Range empty state` (Uang: teks `1–10 Sep 2026` + CTA Catat/Geser rentang/Kembali ke Bulan ini; Beranda donut) — **PASS** |
| HW-HAB/HW-MNY detail | HabitDetail, TransactionDetail | — | `src/views.jsx` | `tests/detail-range.test.js` (Riwayat(n); Hapus → confirmSheet destruktif; Batal = tetap; Hapus = IDB + outbox DELETE + toast + kembali; nominal `Rp••••••` → `Rp25.000` setelah re-auth) | **PASS** (DOM) |
| Spec 15 PWA install | Sheet "Pasang HabitWealth?" + iOS | `pwa_installed{source}`, `pwa_dismissed` | `src/pwa.js` (`openSheet`) | `tests/pwa.test.js` (prompt ditahan sampai first habit; 2 dtk; Nanti/scrim = dismissed sekali + tidak muncul lagi; Pasang → `prompt()` + `userChoice` → `pwa_installed{source:"prompt"}` tanpa duplikat; manual → `{source:"manual"}`; iOS sheet; standalone → tidak ada) — **bug diperbaiki**: `pwa_*` tidak di allowlist (di-drop), duplikat event, scrim iOS salah target | **PASS** (DOM); `beforeinstallprompt` nyata + SW offline = NOT TESTED |
| Spec 18 API | `/api/v1/*` | — | `public_html/api/v1/*.php` | `php -l` tidak tersedia di sandbox ini | **NOT TESTED** (sesi ini); smoke sebelumnya di PROGRESS (health OK) |
| Spec 05 privasi analytics | — | semua | `src/analytics.js`, `src/crypto.js` | `tests/core.test.js › Analytics` (allowlist, redaksi email/amount/title/note), `› Crypto` (redactForLog, 1000 key unik, SHA-256) | **PASS** |
| Wave 3 gate (WebAuthn) | PasskeyEnrollment | — | `src/webauthn.js` | `tests/core.test.js › WebAuthn` (tanpa RP → `RP_NOT_CONFIGURED`, `credentials.create` tidak dipanggil) | **PASS** (gate) / fitur = BLOCKED (ADR + endpoint RP) |

## 2. Test matrix (spec 14) × status
| Dimensi | Cakupan sesi ini | Bukti | Status |
|---|---|---|---|
| Happy | Splash→…→first completion→Beranda first-use | `auth-views.test.js › AuthFirstHabit`, `auth.test.js › state machine` | PASS (DOM) |
| Validasi | Email format, consent dasar wajib, judul habit kosong | `auth-views.test.js › AuthHub`, `› AuthConsent`; `auth.test.js › validateConsent` | PASS |
| Empty | Habit kosong → template; range kosong → "Kembali ke Bulan ini" | ada di UI (`views.jsx`) | NOT TESTED |
| Offline | Signup tanpa backend (fetch gagal) → sesi lokal `offline_created`, banner offline di Hub | `auth.test.js › signup … offline_created` | PASS (unit); banner UI = NOT TESTED |
| Stale / Partial | Freshness label, badge per sumber | R1.1 (partner belum diverifikasi) | BLOCKED |
| Denied | Primer notifikasi deny → copy "Tidak apa-apa! Aktifkan nanti di Pengaturan › Privasi." | `auth-views.test.js › Permission primer` | PASS |
| Expired-auth | Sesi >30 hari (usulan OPEN) → Splash notice "Sesi berakhir" + Masuk; re-auth 5 mnt kedaluwarsa → masking lagi | `auth.test.js › auto-logout`, `core.test.js › re-auth kedaluwarsa` | PASS (logika) |
| Duplikat akun | Signup email sama → state duplikat + tawaran Masuk | `auth.test.js`, `auth-views.test.js › duplikat` | PASS |
| A11y | role=switch + aria-checked/label, live region status, focus ke h1 tiap langkah, target ≥48dp (CSS), alternatif keyboard carousel (panah), `aria-disabled` untuk fitur belum tersedia | struktur DOM diuji sebagian (`role="switch"`, `role="alert"`, `[role=dialog]`) | PARTIAL (SR/kontras/200% di device = NOT TESTED) |
| Lokalisasi | `Rp10.000`, `Rp••••••`, copy Indonesia | `core.test.js › Uang` | PASS |
| Privasi | Tanpa email di event; `q` mentah tidak masuk event; redaksi log | `auth.test.js`, `core.test.js › Analytics/Crypto` | PASS |
| Security | Re-auth untuk saldo penuh + export/delete/wipe; "Later" tak memicu dialog sistem; passkey tidak difake; aksi destruktif lewat confirmSheet (fokus default di Batal) | `core.test.js › Permissions/WebAuthn/Uang`, `data.test.js › Pengaturan`, `ui-views.test.js` | PASS (logika); CSP/headers di server = NOT TESTED sesi ini |
| Perf | Bundle awal: main JS 172.75 kB / gzip **56.59 kB** (<200 kB), CSS 23.75 kB / gzip 5.21 kB; ECharts lazy | `npm run build` 19 Sep 2026 (sesi 2) | PASS (budget bundle); **LCP/CLS device = NOT TESTED** |
| Recovery | Splash crash-recovery notice bila outbox pending + "Sync Sekarang"; biometrik 3× → AuthRecovery; drain retry pakai key sama | `auth.test.js`, `auth-views.test.js › AuthRecovery`, `data.test.js › Outbox` | PASS (logika) |
| Motion | deeper=slide-up (`nav-deeper-enter`), back=slide-down, sheet dari bawah, reduced-motion fade | CSS token-only (`src/styles/auth.css`, `assets/css/motion.css`) | NOT TESTED (visual) |

## 3. Kill-criteria check (P00 §10)
| Kriteria | Status | Catatan |
|---|---|---|
| Invent provider/legal/evidence/pricing | OK | Google/Apple/PIN/tautan email ditandai "Belum tersedia"; UU PDP disebut tanpa pasal; tidak ada klaim E2EE |
| Butuh integrasi untuk basic use | OK | Signup + first habit berjalan tanpa backend (fetch gagal → sesi lokal) |
| Real money movement | OK | Tidak ada |
| Expose finansial default | OK | `Rp••••••` sampai re-auth (test) |
| Hilang denied/stale/offline/recovery | PARTIAL | denied/offline/recovery ada; stale/partial = R1.1 |
| Shame/penalty/forced consent | OK | Opsional tanpa preselect; Skip/Nanti Saja/Nanti selalu ada; copy tanpa guilt |
| Klaim kausalitas | OK | — |
| Screen/event/data baru tanpa revisi upstream | PERLU CATATAN | `hw:session/onboarding/consent-history/passkey` = penyimpanan lokal baru (konsep Consent + User spec 06 sudah ada). `AuthRecovery` = ada di spec 02 (Recovery/Fallback). Tidak ada event baru. |
| Klaim compliance/PASS tanpa bukti | OK | Tabel ini memisahkan PASS vs NOT TESTED |
| Tak tertrace ke req+fase | OK | Tabel §1 |

## 4. Go/No-Go (P0 v1.0)
| Item | Owner | Status | Evidence |
|---|---|---|---|
| First value <3 mnt (happy path) | Product — **OPEN: nama owner** | PARTIAL | Alur lengkap + `onboarding_completed.duration_s` terukur; belum ada sesi pengguna nyata |
| Masking default + re-auth | Tech/Privacy — OPEN | PASS | `core.test.js › Uang` |
| Offline-first (data terakhir + queue) | Tech — OPEN | PARTIAL | Outbox + notice; drain e2e belum diuji |
| Consent 3 lapis tanpa preselect + riwayat | Privacy — OPEN | PASS | `auth*.test.js` |
| Primer izin kontekstual, "Nanti" tanpa dialog sistem | Design/Privacy — OPEN | PASS | `core.test.js › Permissions`, `auth-views.test.js` |
| A11y (SR/keyboard/200%/kontras) | Design — OPEN | NOT TESTED (device) | struktur ARIA ada |
| LCP <2.5s / CLS <0.1 di device | Tech — OPEN | NOT TESTED | bundle gzip 53.64 kB; perlu CDP/Lighthouse di device |
| API PHP kontrak spec 18 | Tech — OPEN | NOT TESTED sesi ini | `php` tidak tersedia di sandbox |
| Legal wording (UU PDP, retensi, privasi URL) | Legal — OPEN | BLOCKED | menunggu counsel |
| Store package (P15) | Product — OPEN | BLOCKED | setelah build terverifikasi + demo data fiktif |

**Status T13 (20 Sep 2026): DONE** — deliverable (matrix, traceability, harness 104 tes, guardrail, Go/No-Go) lengkap dan merge ke `main` (`e04be87`); bukti yang membutuhkan browser/perangkat dilacak sebagai **T13-DEVICE** (BLOCKED) di `TODO.md`, statusnya di §5 tetap NOT TESTED.

**Verdict sesi ini: NO-GO untuk rilis** (wajar — belum ada bukti device/LCP/a11y/legal), **GO untuk lanjut Wave 3 gated + T10–T12** setelah keputusan ADR (lihat `docs/mobile-api-audit/07-wave3-gates.md`).

## 5. Gap yang diketahui (jujur) — diperbarui sesi 2
- ~~`views.jsx` inline style + hex~~ **LUNAS**: `views.jsx` ditulis ulang token-only (class di `app.css`), `alert/confirm` → `src/ui.js` (toast/confirmSheet/infoSheet/chooseSheet), reload hanya setelah wipe data. Dijaga test statik `tests/ui-views.test.js` (tanpa hex/alert/confirm/inline style). `charts.js` membaca warna dari token CSS (`tokenColor`), `share.js` memakai toast bersama.
- Sisa hex di luar tokens.css: `charts.js` `TOKEN_FALLBACK` (fallback bila computed style kosong), `range.js`/`search.js`/`pwa.js`/`print.js`/`theme.js` (Wave 1–2, belum direfactor — bukan views; dijadwalkan).
- ~~Belum ada test untuk: highlight `<mark>` + worker path search, PWA install sheet, range picker sheet, habit detail/hapus, transaksi detail/hapus~~ **LUNAS** (sesi 3: `tests/search-ui`, `tests/pwa`, `tests/detail-range`). Masih tanpa test: SW offline/precache nyata (butuh browser).
- Sisa hex di luar tokens.css (diperbarui): `charts.js` `TOKEN_FALLBACK` (sengaja), `print.js`/`theme.js` (bukan view; dijadwalkan). `search.js`/`range.js`/`pwa.js` **sudah token-only** (sesi 3).
- **Standar seragam modul UI (syarat tambahan reviewer, 19 Sep 2026) — LUNAS**: `pwa.js` 2 innerHTML statis (offline banner, SW update prompt) → DOM API; sekalian disamakan di `views-auth.jsx` (3 `style=` inline + 9 innerHTML statis → `hubContent()`/DOM), `charts.js` (3 placeholder), `ui.js`/`views-auth.jsx` (`scrim.style.opacity` → `.scrim.exiting`), `views.jsx` (bar budget `style.width` → `<progress value>` — tidak ada lagi pengecualian), `orientation.js` (tombol fullscreen → `.chart-fs-btn`), `share.js` (textarea fallback → `.sr-only`). Dijaga `tests/guardrails.test.js` `UI_MODULES` (11 modul; komentar tidak dihitung; `BeforeInstallPromptEvent.prompt()` bukan dialog sistem). Pengecualian tercatat: `gestures.js`/`motion.js`/`keyboard.js`/`theme.js` (bukan pembangun UI).
- ~~(T11) `charts.js renderScatterIfNeeded` `disclaimer.style.*` + `onclick` inline~~ **LUNAS (syarat merge (a))**: seluruh `charts.js` token-only — ring/streak dots/tabel data/disclaimer memakai class `app.css` (`.ring-*`, `.streak-dot`, `.chart-data*`, `.chart-disclaimer`), transisi ring dari `--motion-emphasized`/`--easing-enter`, tombol "Perluas" via `addEventListener`, border donut dari `tokenColor("--surface-elevated")`; hex tersisa hanya `TOKEN_FALLBACK`. Dijaga `tests/guardrails.test.js`. Scatter ECharts nyata tetap NOT TESTED (happy-dom).
- **Checklist permanen (syarat merge (b))**: paritas allowlist event klien == PHP ×3 + registry di spec 05 — `tests/guardrails.test.js` (gagal bila ada event hanya di satu sisi / tidak terdokumentasi). Temuan saat dipasang: 9 event Wave 1–2 (`permission_*`, `range_*`, `search_*`) belum ada di spec 05 → ditambahkan ke registry (spec 05 amandemen).
- Tidak ada perangkat fisik/CDP di sandbox ini → semua klaim visual/perf ditandai NOT TESTED. Chromium tidak dapat diunduh (CDN ECONNRESET) — dicoba 2×.
