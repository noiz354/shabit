-- 002_webauthn.sql — ADR-0001 / spec 18 §Passkey (R1.1). TERPISAH dari schema init lib/db.php (syarat owner #2).
-- Dialek: SQLite (dev/shared host saat ini). Catatan MySQL di bawah. JANGAN dijalankan sebelum ADR-0001 §5 diputuskan.
-- Tidak menyimpan biometrik apa pun: hanya kunci publik + counter + metadata.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL,
  credential_id    TEXT    NOT NULL UNIQUE,   -- base64url rawId
  credential_hash  TEXT    NOT NULL UNIQUE,   -- SHA-256(credential_id) — dipakai di API/log, rawId tidak pernah dilog
  public_key       TEXT    NOT NULL,          -- COSE key base64url (atau PEM SPKI setelah konversi, tergantung lib)
  alg              INTEGER NOT NULL,          -- -7 ES256 | -257 RS256
  sign_count       INTEGER NOT NULL DEFAULT 0,
  transports       TEXT,                      -- JSON array, mis. ["internal"]
  aaguid           TEXT,
  label            TEXT,                      -- nama perangkat pilihan user (maks 60)
  status           TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspect','revoked')),
  created_at       INTEGER NOT NULL,          -- unix epoch
  last_used_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id, status);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          TEXT    PRIMARY KEY,            -- random id
  user_id     TEXT,                           -- NULL untuk login-options tanpa sesi (conditional UI)
  challenge   TEXT    NOT NULL,               -- base64url random_bytes(32)
  type        TEXT    NOT NULL CHECK (type IN ('register','login','re-auth')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,               -- created_at + 300 (TTL ≤ 5 menit)
  used_at     INTEGER                         -- sekali pakai; NULL = belum dipakai
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expiry ON webauthn_challenges(expires_at);

-- Pembersihan berkala (cron/kesempatan request): DELETE FROM webauthn_challenges WHERE expires_at < strftime('%s','now') OR used_at IS NOT NULL;

-- MySQL/MariaDB (bila host memakai MySQL): ganti AUTOINCREMENT→AUTO_INCREMENT, TEXT kunci unik → VARCHAR(255),
-- CHECK didukung MariaDB ≥10.2 / MySQL ≥8.0.16; gunakan ENGINE=InnoDB DEFAULT CHARSET=utf8mb4.
