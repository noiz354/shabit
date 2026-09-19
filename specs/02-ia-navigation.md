# Spec: 02 — IA, Navigasi & Screen Inventory (P03, canonical)

## Objective
Menetapkan satu IA + navigasi global + daftar layar kanonis. Semua screen P07–P12 harus ada di sini dulu.

## Top-level navigation (recommended)
Bottom tab (maks 5, text+icon, tanpa swipe antar-tab — aturan One UI) + FAB kontekstual:
`Beranda | Habit | Uang | Insight (R2, locked bila data < threshold) | Pengaturan`
Alasan: 4 tab inti MVP + 1 slot tumbuh; drawer ditolak (jangkauan satu tangan); top-title digantikan tab saat relevan.

- Depth maks 3: `tab → screen → detail`.
- FAB: Habit tab = tambah habit; Uang tab = tambah transaksi. Min 2 aksi di bottom toolbar bila dipakai.

## IA tree
```
├─ Auth (LoggedOut)
│  ├─ Splash/RestoreSession
│  ├─ OnboardingCarousel (3 slide, skip)
│  ├─ SignupLoginHub (email, Google, Apple, passkey-kondisional)
│  ├─ DataConsent (wajib dasar / opsional kesehatan / opsional finansial)
│  ├─ PasskeyEnrollment (boleh "Nanti Saja")
│  ├─ PermissionPrimer (kontekstual, bukan Day-1 borongan)
│  └─ Recovery/Fallback (biometrik gagal 3×, duplikat akun, sesi expired)
├─ Home (Beranda)
│  ├─ DashboardRingkas (first-use vs returning dibedakan)
│  └─ NotificationInbox (belum dibaca/arsip)
├─ Habit
│  ├─ HabitToday, HabitCreateEdit, HabitDetailHistory
│  ├─ HabitReminderSetup, HabitTemplates
│  └─ IntegrationHubHealth (CONDITIONAL R1.1)
├─ Money
│  ├─ FinanceOverview, TransactionFeed, TransactionDetailRecategorize
│  ├─ AddRecord (income/expense/transfer manual), BudgetSetupStatus
│  └─ ConnectAccount + ReconnectAccount (CONDITIONAL R1.1)
├─ Insights (R2)
│  ├─ InsightSetup (opt-in), WeeklyMonthlySummary, WhyAmISeeingThis
│  └─ VirtualSavingsGoal (intended allocation, BUKAN transfer)
├─ SettingsLifecycle
│  ├─ SettingsHub, Appearance, NotificationPreferences
│  ├─ DataPrivacy (consent history, connected services, revoke)
│  ├─ ExportRequest, DeleteAccountRequest
│  └─ HelpSupport, AboutLegal, SubscriptionLink (hanya bila tervalidasi)
└─ System states (bukan screen): offline, stale, partial, token-expired, crash-recovery
```

## Screen inventory (ringkas; penuh di QA matrix)
| Screen ID | Nama | Fase | Tier |
|---|---|---|---|
| AuthSplash | Splash/Restore | v1.0 | Free |
| AuthOnboarding | OnboardingCarousel | v1.0 | Free |
| AuthHub | SignupLoginHub | v1.0 | Free |
| AuthConsent | DataConsent | v1.0 | Free |
| HomeDashboard | DashboardRingkas | v1.0 | Free |
| HabitToday | HabitToday | v1.0 | Free |
| HabitEditor | CreateEdit | v1.0 | Free |
| MoneyOverview | FinanceOverview | v1.0 | Free |
| MoneyFeed | TransactionFeed | v1.0 | Free |
| MoneyAdd | AddRecord | v1.0 | Free |
| SettingsHub | SettingsHub | v1.0 | Free |
| DataPrivacy | DataPrivacy | v1.0 | Free |
| ExportReq/DelReq | Export/Delete | v1.0 | Free |
| HealthHub/ConnectAcct | Integrations | v1.1 | Conditional |
| InsightSummary/SaveGoal | Insights | v2.0 | Conditional |

P0 v1.0 maks 12–15 layar. Subscription/Paywall hanya bila model bisnis disetujui; muncul saat tap fitur Premium, bukan hard paywall Day-1.

## Route taxonomy (CSR hash, framework-neutral)
`#/beranda #/habit #/habit/:id #/uang #/uang/:id #/insight #/pengaturan #/notifikasi`
Deep-link produk: `habitwealth://habit/complete?id={} habitwealth://money/alert?type={} habitwealth://saving/withdraw habitwealth://settings/notifications habitwealth://referral?code={}&source={}` → dipetakan ke hash route di CSR.

## Flows
First-value (<3 mnt): Splash → Hub → Consent dasar → Primer biometrik saja → Buat 1 habit → Complete → Beranda sederhana.
Daily habit, manual transaction, sync recovery, privacy controls, deletion — masing-masing wajib punya entry/exit + back behavior di spec fitur.

## Checks
Orphan/duplicate/unreachable check wajib sebelum Gate B. Perubahan IA → bump versi + changelog.
