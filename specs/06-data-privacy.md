# Spec: 06 — Conceptual Data, Privacy & Integration Map (P06)

> Model konseptual, BUKAN skema DB final. Tidak ada nama algoritma enkripsi/retensi final tanpa ADR + legal.

## Concepts (purpose, minimal attrs, source, sensitivity, controls)
- User: id_hash, locale id-ID, appearance prefs. Sensitivity: medium.
- Consent: scope (dasar/kesehatan/finansial), granted_at, version. Legal ack terpisah dari permission opsional. Revocable.
- Habit/HabitEntry: title lokal saja, schedule, goal_type, entries(date, status, source manual/import). Timezone + day-boundary Asia/Jakarta default, late-entry + travel rules di spec habit.
- FinancialAccount/Transaction/Category/Budget: label, amount (int minor Rp), date `19 Sep 2026`, source manual/kondisional-sync, freshness_ts, pending vs posted, duplicate_of, refund_of. Masking default `Rp••••••`, `BCA •••• 4821`.
- SavingsGoal (virtual): intended_amount, source_account_ref, no fund movement (D-05 guardrail).
- Connection/SyncRun: provider generik "verified partner" (nama OPEN), status synced/syncing/failed/expired/partial, last_success_ts, error_code. Stale banner + retry + revoke + reconnect.
- NotificationPreference, AuditRecord (redacted, tanpa payload sensitif).

## Flows
Manual entry → local-first → queued write → (bila PHP ada) sync. Health/financial sync R1.1: connect kontekstual → consent → sync → freshness label → partial handling → revoke. Export: request → estimasi (mis. 24 jam via email) → completion. Deletion: request → re-auth → jelaskan yang dihapus/disimpan/pihak-ketiga → confirm → completion. Tanpa klaim "14 hari"/pasal UU sebelum legal review.

## Rules
- Jangan simpan raw credentials/biometric templates. Jangan klaim E2EE generik.
- Source-of-truth: device lokal untuk MVP; konflik: last-write + user-keep-both untuk entries; idempotency key untuk queued ops.
- Revocation memutus sync + menandai data stale, tidak menghapus riwayat manual tanpa confirm.
- Analytics/log: redacted, hash ids.

## Decisions needing specialist
Provider availability Indonesia, money-movement model, retention periods, store/UU PDP wording — semua OPEN dengan owner.
