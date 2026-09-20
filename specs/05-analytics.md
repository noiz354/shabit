# Spec: 05 — Measurement & Analytics Plan (P05, privacy-conscious)

## Objective
Ukur activation/engagement/retention/trust tanpa PII di payload. Vendor OPEN (Firebase/Mixpanel atau setara belum diputuskan).

## Metric tree
Activation (first habit <3mnt, first manual tx), Engagement (habit_completed/hari), Retention (D7/D30), Trust (sync recovery, permission grant kontekstual), Business (trial/subscribe hanya bila disetujui).

## Event dictionary (P0 ≤25, snake_case, ISO8601)
| Event | Trigger tepat | Properties (tanpa PII) | Req |
|---|---|---|---|
| `signup_completed` | Akun dibuat, bukan tap tombol | {method, day} | HW-PRD |
| `onboarding_completed` | First habit completion | {duration_s, skipped} | HW-PRD |
| `habit_completed` | Progress=100% + confirm | {habit_id_hash, habit_type, streak_day, time_of_day} | HW-HAB |
| `habit_skipped_day` | Lewat day-boundary | {streak_reset} | HW-HAB |
| `transaction_created` | Record manual tersimpan | {kind, category, has_note} | HW-MNY |
| `category_corrected` | User ubah kategori AI/kondisional | {from_to_hash} | HW-MNY |
| `budget_threshold_hit` | Capai 80%/100% | {pct, month} | HW-MNY |
| `connection_started/completed/failed` | OAuth kondisional R1.1 | {source_type, error_code} | HW-DAT |
| `sync_failed/recovered` | Gagal/pulih | {scope, retry_count} | HW-DAT |
| `notification_opened/dismissed` | Tap/swipe | {category, deep_link} | HW-NTF |
| `export_requested/deletion_requested` | Tombol confirm | {scope} | HW-SET |
| `paywall_shown/dismissed` | Hanya bila premium disetujui | {variant} | HW-BIZ |
| `insight_viewed` (amandemen T11, 19 Sep 2026) | Ringkasan insight tampil (opt-in ON) | {period, has_scatter, confidence} | HW-INS |
| `goal_created/completed/withdrawn` (T11) | Celengan dibuat / target tercapai / tarik dikonfirmasi | {daily_bucket} / {days} / {reason} — **tanpa nominal** | HW-INS |
| `celebration_shared/dismissed` (T11) | Share card / tutup sheet perayaan | {streak_day} / {streak_day, never_again} | HW-INS |

Larangan: nama, email, no rekening mentah, deskripsi transaksi, judul habit, nilai health di properties. Gunakan hash id.

## Funnels
install→signup→first habit→first tx→(R1.1) first connection→D7→D30. Recovery funnel sync_failed→recovered.

## Quality
Dedup via idempotency key, offline queue flush berurutan, clock-skew pakai server-timeужн, retry backoff. Consent: analytics opsional, minimisasi data.

## Motion/analytics mapping
Setiap push/notifikasi yang di-tap fire `notification_opened`; milestone habit fire `habit_completed` + `task_succeeded` haptic sekali.
