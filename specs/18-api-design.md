# Spec: 18 — API Design (`/api/v1/*`, session-cookie)

> Keputusan locked 19 Sep 2026: auth session-cookie saja (sementara). Web Push + VAPID didesain di sini untuk R1.1.

## Objective
Kontrak JSON penuh untuk CSR — tipis, idempoten, tanpa PII di log/analytics. PHP: PDO prepared, tanpa ORM. Base: `/api/v1/`. Envelope: `{ok:true,data:{...}}` / `{ok:false,error:{code,message,request_id}}`. Header: `X-Request-Id` (server generate bila absen), `Idempotency-Key` untuk semua mutasi (retry/outbox aman).

## Auth & keamanan
- Session cookie `HttpOnly; Secure; SameSite=Lax`; login/logout; CSRF token (header `X-CSRF-Token`) untuk POST/PATCH/DELETE cookie-based.
- Re-auth biometrik/PIN (keputusan klien) diwajibkan server untuk: reveal saldo penuh, ubah nominal goal, export, delete (`POST .../re-auth` → token sekali pakai 5 mnt).
- Rate-limit sederhana per IP+sesi; `Cache-Control: no-store` untuk semua API; CORS: same-origin saja (mendasari CSR satu host).
- Error codes: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `STALE`, `OFFLINE_QUEUED` (klien), `RATE_LIMITED`, `SYNC_FAILED`, `PROVIDER_UNAVAILABLE`, `INTERNAL`.

## Konvensi umum
- Tanggal: `YYYY-MM-DD`; uang: integer minor (rupiah, tanpa desimal); timezone param `tz=Asia/Jakarta`; list: cursor paging `{items, next_cursor}` + filter `from/to` (lihat specs/17) + text search `q` + `sort/order` (lihat specs/19; nilai `q` mentah tidak masuk log/analytics).
- Masking: nomor akun `BCA •••• 4821`; saldo penuh hanya setelah re-auth; deskripsi mentah tidak pernah ke log/analytics.

## Endpoints MVP (v1.0)
| Method & path | Deskripsi | Body/query kunci |
|---|---|---|
| `GET /health` | Liveness | — |
| `POST /auth/signup|login|logout|re-auth` | Sesi (passkey kondisional) | `{email|provider, ...}` |
| `GET/POST /habits`, `PATCH/DELETE /habits/:id` | CRUD habit | `{title,schedule,goal_type,reminder?}` |
| `GET/POST /habit-entries`, `PATCH /habit-entries/:id` | Complete/undo/koreksi | `{habit_id,date,status,source}` + idempotency |
| `GET /habits/:id/history?from&to` | Histori + streak | cursor |
| `GET/POST /transactions`, `PATCH /transactions/:id` | Manual income/expense/transfer + rekategori | `{kind,amount,category,date,account_ref,note?}` |
| `GET /transactions?from&to&cat&source&q&sort&cursor` | Feed terfilter + search | paging |
| `GET /habits/:id/history?from&to&q&cursor` | Histori + search judul/catatan | cursor |
| `GET /budgets?q&month` | Budget + search kategori | — |
| `GET /help/search?q` | FAQ/bantuan (tanpa auth berat, rate-limited) | max 10 |
| `GET/PUT /budgets`, `GET /budgets/status?month` | Budget + status 80/100% | `{category,limit,month}` |
| `GET/POST /savings-goals`, `POST /savings-goals/:id/allocate|withdraw` | Virtual goal (BUKAN transfer uang) | `{name,daily_amount,source_ref}` |
| `GET /dashboard/summary?from&to&tz` | Agregat ringan untuk Beranda + chart | — |
| `POST /export/requests`, `GET /export/requests/:id` | Export (estimasi waktu OPEN) | — |
| `POST /account/deletion-requests`, `DELETE .../cancel` | Delete request + batal (jendela per kebijakan) | re-auth wajib |
| `GET/PATCH /notification-preferences` | Preferensi per kategori + quiet hours | — |

## R1.1 — Sync kondisional (hanya bila partner verified)
- `POST /connections`, `DELETE /connections/:id`, `POST /connections/:id/reconnect`, `GET /sync-runs?source` → `{status: synced|syncing|failed|expired|partial, last_success_ts, error_code}`.
- Jangan klaim coverage/OAuth scope sebelum verifikasi (D-04). Token-expired → klien tampilkan banner reconnect (spec 09).

## R1.1 — Web Push + VAPID (desain sekarang, implementasi nanti)
- Server: generate VAPID pair via `openssl` (EC P-256); public key di `GET /push/vapid-public-key`; private TIDAK keluar server.
- `POST /push/subscriptions {endpoint, keys{auth,p256dh}, tz, categories[]}`; `DELETE /push/subscriptions/:endpoint_hash`.
- `POST /push/test` (dev only, re-auth) untuk verifikasi; pengiriman nyata oleh worker PHP saat event relevan + hormati Quiet Hours + kategori mute; payload terenkripsi (RFC 8291) tanpa nominal sensitif.
- Rotasi VAPID + cleanup endpoint 410/404 documented.

## Validasi & contoh
- `POST /transactions` 422 contoh: `{ok:false,error:{code:"VALIDATION",message:"amount harus > 0",request_id:"..."}}`.
- Konflik outbox:Ul retry dengan `Idempotency-Key` sama → respons hasil asli (tidak duplikat).
- `GET /dashboard/summary?from=2026-09-01&to=2026-09-30&tz=Asia/Jakarta` → `{habits:{done,total}, cashflow:{in,out}, by_category:[{key,total}], freshness:{ts}}`.

## NFR
Perf: ringkasan <500ms p95 lokal; payload list ≤50 item/page. Observability: audit redacted. Skema DB final tetap ADR OPEN — endpoint tidak mengunci skema.
