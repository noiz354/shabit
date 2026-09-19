<?php
// PDO helper NOL-DEP. DSN dari env di luar docroot di produksi.
// TODO(T18): tabel idempotency_keys + entitas bisnis (migrasi terpisah).
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = getenv('HW_DSN') ?: 'sqlite::memory:'; // scaffold default; produksi: mysql:host=..;dbname=..
    $pdo = new PDO($dsn, (string) getenv('HW_DB_USER'), (string) getenv('HW_DB_PASS'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
