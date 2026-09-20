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

## Registry allowlist (amandemen 19 Sep 2026 — syarat merge PR #2 (b), checklist permanen)
**Aturan**: setiap nama event di `src/analytics.js` `ALLOWED_EVENTS` **harus** (1) tercantum di spec ini, dan (2) identik (set yang sama) dengan `$allowed` di `public_html/api/v1/analytics.php`, `index.php`, dan `reports.php`. Dijaga otomatis oleh `tests/guardrails.test.js` (gagal bila ada event yang hanya ada di satu sisi atau tidak terdokumentasi di sini). Menambah event = ubah **keempat** daftar + baris di spec ini dalam satu commit.

Event Wave 1–2 yang sebelumnya hanya terdokumentasi di spec lain (dipindahkan ke registry ini agar satu sumber):
| Event | Trigger | Props (tanpa PII/nominal) | Spec asal |
|---|---|---|---|
| `permission_granted/denied` | Hasil dialog izin sistem setelah primer | {scope} | 07 / 11 |
| `range_changed` | Preset/rentang global berubah | {preset, days, module} | 17 |
| `range_custom_applied` | Rentang kustom diterapkan | {days} | 17 |
| `range_empty_shown` | Rentang tanpa data | {module, days} | 17 |
| `search_opened` | Sheet pencarian dibuka | {entry} | 19 |
| `search_executed` | Query ≥2 karakter dijalankan (nilai `q` TIDAK dikirim) | {scope, result_count, char_len, offline} | 19 |
| `search_result_opened` | Hasil dibuka | {scope} | 19 |
| `search_history_cleared` | Riwayat dihapus | {} | 19 |
