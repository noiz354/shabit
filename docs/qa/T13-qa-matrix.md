# T13 — QA Matrix, Traceability & Go/No-Go (spec 14)

> Status per item: **PASS** (ada bukti otomatis/terukur), **PARTIAL** (bukti sebagian), **NOT TESTED** (belum ada bukti — bukan klaim lolos), **BLOCKED** (butuh prasyarat), **FAIL**.
> Sesuai kill-criteria P00 §10: tidak ada klaim PASS tanpa bukti. Bukti = file test (`tests/*.test.js`, `npm test`), output build (`npm run build`), smoke browser (bila ada).
> Lingkungan bukti sesi ini: sandbox Linux, Node 22, vitest + happy-dom + fake-indexeddb (**bukan perangkat fisik**). LCP/CLS di device = NOT TESTED.

## 0. Cara menjalankan bukti
```
npm ci
npm test            # vitest run → tests/{auth,auth-views,core}.test.js
npm run build       # ukuran bundle + precache
npm run dev         # smoke manual: #/auth → carousel → hub → consent → passkey → first-habit → #/beranda?first=1
```

## 1. Traceability (req → layar → event → modul → bukti)
| Req | Layar (spec 02) | Event (spec 05) | Modul | Bukti | Status |
|---|---|---|---|---|---|
| HW-PRD (first value <3mnt) | AuthSplash → AuthOnboarding → AuthHub → AuthConsent → PasskeyEnrollment → FirstHabit → HomeDashboard(first-use) | `signup_completed{method,day}`, `onboarding_completed{duration_s,skipped}` | `src/auth.js`, `src/views-auth.jsx`, `src/router.js` (authGate) | `tests/auth.test.js` (state machine, guard, events tanpa email), `tests/auth-views.test.js` (DOM: consent, Nanti Saja, hub states, first habit + completion) | **PASS** (unit/DOM); durasi <3mnt di manusia = NOT TESTED |
| HW-HAB | HabitToday/Editor/Detail | `habit_completed{habit_id_hash,habit_type,time_of_day}` | `src/habit.js`, `src/views.jsx` | `tests/auth-views.test.js › AuthFirstHabit` (create + complete + entry IDB + flag first-habit) | **PARTIAL** (CRUD undo/detail belum ada test) |
| HW-MNY | MoneyOverview/Feed/Add | `transaction_created{kind,category,has_note}` | `src/money.js` | `tests/core.test.js › Uang` (masking default `Rp••••••`, `Rp10.000`, re-auth 5 mnt, expiry) | **PASS** (masking/format); feed/filter = NOT TESTED |
| HW-DAT (sync/recovery) | System states offline/stale/partial; crash-recovery notice di Splash | `sync_failed/recovered` | `src/storage/outbox.js`, `src/auth.js restoreSession` | `tests/auth.test.js › restoreSession` (pendingSync count) | **PARTIAL** (drain tanpa duplikat = NOT TESTED; R1.1 partner = BLOCKED) |
| HW-NTF | PermissionPrimer (post first-habit), NotificationPreferences | `permission_granted/denied{scope}`, `notification_opened` | `src/permissions.js`, `src/notifications.js`, `showPermissionPrimer` | `tests/core.test.js › Permissions` ("Later" tidak memicu dialog sistem; denied cooldown 7 hari), `tests/auth-views.test.js › Permission primer` (Nanti/Izinkan/deny fallback copy) | **PASS** (logika); tampilan notifikasi OS = NOT TESTED |
| HW-SET | SettingsHub › Akun/Data & Privasi (riwayat consent + cabut), Export/Delete | `export_requested`, `deletion_requested` | `src/settings.js`, `src/views.jsx`, `src/auth.js revokeConsent` | `tests/auth.test.js › consent` (riwayat berversi, revoke) | **PARTIAL** (export/delete flow = NOT TESTED) |
| Spec 17 range | Picker global + hash state | `range_changed` | `src/range.js`, `src/router.js` | `tests/core.test.js › Router`, `› Range presets` | **PASS** (parse/build/restore, preset from≤to) |
| Spec 19 search | Search sheet 4 scope | `search_executed{char_len,result_count,scope}` | `src/search.js`, `src/storage/prefs.js` | `tests/core.test.js › Search history` (max-5, dedup), `› Analytics` (tanpa `q` mentah) | **PARTIAL** (ranking/highlight/offline badge = NOT TESTED) |
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
| Security | Re-auth untuk saldo penuh; "Later" tak memicu dialog sistem; passkey tidak difake; tidak ada kredensial mentah tersimpan (hanya hash email untuk deteksi duplikat lokal) | `core.test.js › Permissions/WebAuthn/Uang` | PASS (logika); CSP/headers di server = NOT TESTED sesi ini |
| Perf | Bundle awal: main JS 167.62 kB / gzip **53.64 kB** (<200 kB), CSS 17.62 kB / gzip 4.07 kB; ECharts lazy | `npm run build` 19 Sep 2026 | PASS (budget bundle); **LCP/CLS device = NOT TESTED** |
| Recovery | Splash crash-recovery notice bila outbox pending + "Sync Sekarang"; biometrik 3× → AuthRecovery | `auth.test.js › restoreSession`, `› biometrik 3×`; `auth-views.test.js › AuthRecovery` | PASS (logika); drain tanpa duplikat = NOT TESTED |
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

**Verdict sesi ini: NO-GO untuk rilis** (wajar — belum ada bukti device/LCP/a11y/legal), **GO untuk lanjut Wave 3 gated + T10–T12** setelah keputusan ADR (lihat `docs/mobile-api-audit/07-wave3-gates.md`).

## 5. Gap yang diketahui (jujur)
- `views.jsx` (Wave 2) masih memakai inline style + beberapa warna hardcode (`#0381FE`, `#999`) — melanggar aturan "tanpa hardcode warna" AGENTS.md; T5 baru memakai token murni. Perlu refactor bertahap (bukan blocker fungsional).
- `alert()/confirm()` masih dipakai di Pengaturan (Wave 2) — ganti ke sheet One UI di iterasi berikutnya.
- Belum ada test untuk: undo habit, feed/filter transaksi, export/delete, drain outbox tanpa duplikat, search ranking/highlight, SW offline.
- Tidak ada perangkat fisik/CDP di sandbox ini → semua klaim visual/perf ditandai NOT TESTED.
