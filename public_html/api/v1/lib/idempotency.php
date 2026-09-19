<?php
// Idempotency helper — AUD-API-01 + spec 18
// Header Idempotency-Key untuk semua mutasi (retry/outbox aman)
// Konflik outbox: retry dengan Idempotency-Key sama → respons hasil asli (tidak duplikat)
declare(strict_types=1);

function get_idempotency_key(): ?string {
    $key = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? $_SERVER['HTTP_IDEMPOTENCY-KEY'] ?? null;
    if (!$key) {
        // Also check X-Idempotency-Key
        $key = $_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? null;
    }
    if ($key && is_string($key)) {
        $key = trim($key);
        if (strlen($key) >= 8 && strlen($key) <= 128) {
            return $key;
        }
    }
    return null;
}

function check_idempotency(PDO $pdo, string $key, string $method, string $path): ?array {
    try {
        $stmt = $pdo->prepare("SELECT response_code, response_body FROM idempotency_keys WHERE idempotency_key = :k AND method = :m AND path = :p");
        $stmt->execute([':k' => $key, ':m' => $method, ':p' => $path]);
        $row = $stmt->fetch();
        if ($row) {
            return ['code' => (int)$row['response_code'], 'body' => $row['response_body']];
        }
    } catch (Throwable $e) {
        error_log('[idempotency] check failed ' . $e->getMessage());
    }
    return null;
}

function store_idempotency(PDO $pdo, string $key, string $method, string $path, int $code, string $body): void {
    try {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO idempotency_keys (idempotency_key, method, path, response_code, response_body, created_at) VALUES (:k, :m, :p, :c, :b, :t)");
        $stmt->execute([
            ':k' => $key,
            ':m' => $method,
            ':p' => $path,
            ':c' => $code,
            ':b' => $body,
            ':t' => time(),
        ]);
    } catch (Throwable $e) {
        error_log('[idempotency] store failed ' . $e->getMessage());
    }
}

// Cleanup old keys (7 days)
function cleanup_idempotency(PDO $pdo): void {
    try {
        $pdo->exec("DELETE FROM idempotency_keys WHERE created_at < " . (time() - 7*24*60*60));
    } catch {}
}
