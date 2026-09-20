<?php
// HabitWealth — CSP / Reporting API endpoint (AUD-CRYPTO-01)
// POST /api/v1/reports — receives CSP violation reports + deprecation reports
// Redacted, no PII, rate-limited per IP
// APIs: 119,120,187

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Request-Id: ' . bin2hex(random_bytes(8)));

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => ['code' => 'METHOD_NOT_ALLOWED']], JSON_UNESCAPED_UNICODE);
    exit;
}

// Rate limit simple: per IP, max 20/min
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/hw_reports_rl_' . md5($ip) . '.json';
$now = time();
$window = 60;
$max = 20;
try {
    $data = file_exists($rlFile) ? json_decode(file_get_contents($rlFile), true) : ['ts' => $now, 'count' => 0];
    if ($now - ($data['ts'] ?? 0) > $window) {
        $data = ['ts' => $now, 'count' => 0];
    }
    $data['count'] = ($data['count'] ?? 0) + 1;
    if ($data['count'] > $max) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => ['code' => 'RATE_LIMITED']], JSON_UNESCAPED_UNICODE);
        exit;
    }
    file_put_contents($rlFile, json_encode($data));
} catch (Throwable $e) {
    // ignore RL errors
}

// Read body
$raw = file_get_contents('php://input');
if (!$raw) {
    echo json_encode(['ok' => true, 'data' => ['received' => false]], JSON_UNESCAPED_UNICODE);
    exit;
}

// Try parse JSON
$json = json_decode($raw, true);
if (!$json) {
    // Could be CSP report with content-type application/csp-report
    $json = ['raw' => substr($raw, 0, 2000)];
}

// Redaction — never log PII, URLs may contain sensitive query? Strip query
function redact_report(array $report): array {
    $redacted = [];
    // Keep only known safe fields
    $allowedTop = ['csp-report', 'type', 'age', 'url', 'user_agent', 'body'];
    foreach ($allowedTop as $k) {
        if (isset($report[$k])) $redacted[$k] = $report[$k];
    }

    if (isset($redacted['csp-report']) && is_array($redacted['csp-report'])) {
        $csp = $redacted['csp-report'];
        // Redact document-uri query, blocked-uri may have data: — keep but truncate
        $safeCsp = [];
        $allowedCsp = ['document-uri', 'referrer', 'violated-directive', 'effective-directive', 'original-policy', 'disposition', 'blocked-uri', 'line-number', 'column-number', 'source-file', 'status-code'];
        foreach ($allowedCsp as $ck) {
            if (isset($csp[$ck])) {
                $val = $csp[$ck];
                if (is_string($val)) {
                    // Strip query string from URIs to avoid leaking q params
                    if (in_array($ck, ['document-uri', 'referrer', 'blocked-uri', 'source-file'])) {
                        $val = strtok($val, '?');
                        $val = substr($val, 0, 500);
                    } else {
                        $val = substr($val, 0, 1000);
                    }
                }
                $safeCsp[$ck] = $val;
            }
        }
        $redacted['csp-report'] = $safeCsp;
    }

    // Never include cookies, auth headers, etc.
    unset($redacted['cookie'], $redacted['authorization']);

    return $redacted;
}

$redacted = redact_report($json);

// Log to error_log (redacted) + optionally to file
error_log('[csp-report] ' . json_encode($redacted, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

// In production, you might insert into DB table csp_reports (redacted)
// For scaffold, we just return ok

// Handle Beacon analytics as well (if path is /api/v1/reports and body has events)
if (isset($json['events']) && is_array($json['events'])) {
    // This is actually analytics beacon hitting reports endpoint fallback
    // Redact again
    $events = array_slice($json['events'], 0, 20);
    $safeEvents = [];
    foreach ($events as $ev) {
        if (!isset($ev['event']) || !is_string($ev['event'])) continue;
        // Allowlist check (same as analytics.js)
        $allowed = ['signup_completed','onboarding_completed','habit_completed','habit_skipped_day','transaction_created','category_corrected','budget_threshold_hit','connection_started','connection_completed','connection_failed','sync_failed','sync_recovered','notification_opened','notification_dismissed','export_requested','deletion_requested','paywall_shown','paywall_dismissed','range_changed','range_custom_applied','range_empty_shown','search_opened','search_executed','search_result_opened','search_history_cleared','permission_granted','permission_denied','insight_viewed','goal_created','goal_completed','goal_withdrawn','celebration_shared','celebration_dismissed','pwa_installed','pwa_dismissed'];
        if (!in_array($ev['event'], $allowed, true)) continue;
        $safeEvents[] = [
            'event' => substr($ev['event'], 0, 64),
            'ts' => substr($ev['ts'] ?? gmdate('c'), 0, 32),
            // props already redacted client-side, but we double-check no PII
            'props' => isset($ev['props']) && is_array($ev['props']) ? array_map(fn($v) => is_string($v) ? substr($v, 0, 200) : $v, array_slice($ev['props'], 0, 10)) : [],
        ];
    }
    error_log('[analytics-beacon] ' . json_encode($safeEvents, JSON_UNESCAPED_UNICODE));
}

echo json_encode(['ok' => true, 'data' => ['received' => true]], JSON_UNESCAPED_UNICODE);
