<?php
// HabitWealth — Analytics endpoint (AUD-ANAL-01)
// POST /api/v1/analytics — receives redacted events via fetch/beacon
// Vendor OPEN — for now just validates and logs redacted

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$requestId = bin2hex(random_bytes(8));
header('X-Request-Id: ' . $requestId);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => ['code' => 'METHOD_NOT_ALLOWED', 'request_id' => $requestId]], JSON_UNESCAPED_UNICODE);
    exit;
}

// Simple rate limit
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/hw_analytics_rl_' . md5($ip) . '.json';
$now = time();
try {
    $data = file_exists($rlFile) ? json_decode(file_get_contents($rlFile), true) : ['ts' => $now, 'count' => 0];
    if ($now - ($data['ts'] ?? 0) > 60) $data = ['ts' => $now, 'count' => 0];
    $data['count'] = ($data['count'] ?? 0) + 1;
    if ($data['count'] > 60) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => ['code' => 'RATE_LIMITED', 'request_id' => $requestId]], JSON_UNESCAPED_UNICODE);
        exit;
    }
    file_put_contents($rlFile, json_encode($data));
} catch (Throwable $e) {}

$raw = file_get_contents('php://input');
$json = json_decode($raw, true);
if (!$json || !isset($json['events']) || !is_array($json['events'])) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'events required', 'request_id' => $requestId]], JSON_UNESCAPED_UNICODE);
    exit;
}

$allowed = ['signup_completed','onboarding_completed','habit_completed','habit_skipped_day','transaction_created','category_corrected','budget_threshold_hit','connection_started','connection_completed','connection_failed','sync_failed','sync_recovered','notification_opened','notification_dismissed','export_requested','deletion_requested','paywall_shown','paywall_dismissed','range_changed','range_custom_applied','range_empty_shown','search_opened','search_executed','search_result_opened','search_history_cleared','permission_granted','permission_denied','insight_viewed','goal_created','goal_completed','goal_withdrawn','celebration_shared','celebration_dismissed'];

$safe = [];
foreach (array_slice($json['events'], 0, 20) as $ev) {
    if (!isset($ev['event']) || !is_string($ev['event'])) continue;
    if (!in_array($ev['event'], $allowed, true)) continue;
    // Redact props — only allow known safe keys
    $props = $ev['props'] ?? [];
    $safeProps = [];
    $allowedProps = ['method','day','duration_s','skipped','habit_type','streak_day','time_of_day','kind','category','has_note','from_to_hash','pct','month','source_type','error_code','scope','retry_count','deep_link','char_len','result_count','offline','preset','days','module','entry','sort','order','cat'];
    if (is_array($props)) {
        foreach ($props as $k => $v) {
            if (in_array($k, $allowedProps, true)) {
                $safeProps[$k] = is_string($v) ? substr($v, 0, 100) : $v;
            } elseif (str_ends_with($k, '_hash')) {
                $safeProps[$k] = is_string($v) ? substr($v, 0, 128) : $v;
            }
        }
    }
    $safe[] = [
        'event' => substr($ev['event'], 0, 64),
        'ts' => substr($ev['ts'] ?? gmdate('c'), 0, 32),
        'props' => $safeProps,
    ];
}

// Log redacted
error_log('[analytics] ' . $requestId . ' ' . json_encode($safe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

echo json_encode(['ok' => true, 'data' => ['received' => count($safe), 'request_id' => $requestId]], JSON_UNESCAPED_UNICODE);
