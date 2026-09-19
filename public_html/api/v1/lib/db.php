<?php
// PDO helper NOL-DEP + schema init (T18, AUD-STORE-01)
// DSN dari env di luar docroot di produksi. Fallback: sqlite file di sys_get_temp_dir() untuk persistensi di shared hosting
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;

    $dsn = getenv('HW_DSN');
    if (!$dsn) {
        // Try file-based sqlite for persistence (shared hosting friendly)
        $tmp = sys_get_temp_dir() . '/habitwealth.sqlite';
        $dsn = 'sqlite:' . $tmp;
    }

    $pdo = new PDO($dsn, (string) getenv('HW_DB_USER'), (string) getenv('HW_DB_PASS'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Init schema if sqlite
    if (str_starts_with($dsn, 'sqlite:')) {
        init_schema($pdo);
    }

    return $pdo;
}

function init_schema(PDO $pdo): void {
    // Idempotency keys
    $pdo->exec("CREATE TABLE IF NOT EXISTS idempotency_keys (
        idempotency_key TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        response_code INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");

    // Habits
    $pdo->exec("CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        title TEXT NOT NULL,
        goal_type TEXT NOT NULL DEFAULT 'check',
        schedule TEXT NOT NULL DEFAULT '{}',
        category TEXT NOT NULL DEFAULT 'umum',
        reminder TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )");

    // Habit entries
    $pdo->exec("CREATE TABLE IF NOT EXISTS habit_entries (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'done',
        source TEXT NOT NULL DEFAULT 'manual',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_habit_entries_habit ON habit_entries(habit_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(date)");

    // Transactions
    $pdo->exec("CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        account_ref TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)");

    // Budgets
    $pdo->exec("CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        limit_amount INTEGER NOT NULL,
        month TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month)");

    // Savings goals (virtual, BUKAN transfer uang — D-05 guardrail)
    $pdo->exec("CREATE TABLE IF NOT EXISTS savings_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        daily_amount INTEGER NOT NULL,
        source_ref TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )");

    // Export requests
    $pdo->exec("CREATE TABLE IF NOT EXISTS export_requests (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'processing',
        scope TEXT NOT NULL DEFAULT 'all',
        file_path TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
    )");

    // Deletion requests
    $pdo->exec("CREATE TABLE IF NOT EXISTS deletion_requests (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at INTEGER NOT NULL
    )");

    // Notification preferences
    $pdo->exec("CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id TEXT PRIMARY KEY,
        prefs TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
    )");

    // Push subscriptions (R1.1 design, MVP contract only)
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint_hash TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        tz TEXT NOT NULL DEFAULT 'Asia/Jakarta',
        categories TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
    )");

    // Analytics (redacted)
    $pdo->exec("CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        props TEXT NOT NULL DEFAULT '{}',
        ts TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");
}
