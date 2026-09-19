<?php
// HabitWealth API v1 — front controller NOL-DEP, PHP >= 8.1 features only.
// Deploy: file ini + lib/ di public_html/api/v1/. Rewrite via .htaccess ke index.php.
// Kontrak: specs/18-api-design.md. Envelope: {ok,data,error{code,message,request_id}}.
declare(strict_types=1);

require __DIR__ . '/lib/response.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/validate.php';

$requestId = bin2hex(random_bytes(8));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Request-Id: ' . $requestId);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// .htaccess menulis path ke ?_route= ; fallback ke REQUEST_URI parsing.
$route = $_GET['_route'] ?? trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
$route = preg_replace('#^(api/v1/)?#', '', (string) $route);

$routes = [
    'GET health' => function () {
        return ['php' => PHP_VERSION, 'time' => gmdate('c')];
    },
    // TODO(T18): habits, habit-entries, transactions, budgets, savings-goals,
    // dashboard/summary, export/requests, deletion-requests, notification-preferences.
];

$key = $method . ' ' . $route;
if (!isset($routes[$key])) {
    $known = array_filter(array_keys($routes), fn($k) => explode(' ', $k, 2)[1] === $route);
    http_response_code($known ? 405 : 404);
    echo json_error($known ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND', 'Rute tidak dikenal.', $requestId);
    exit;
}

try {
    $data = $routes[$key]();
    echo json_ok($data);
} catch (ValidationException $e) {
    http_response_code(422);
    echo json_error('VALIDATION', $e->getMessage(), $requestId, $e->fields);
} catch (Throwable $e) {
    error_log('[api] ' . $requestId . ' ' . get_class($e)); // tanpa PII/payload
    http_response_code(500);
    echo json_error('INTERNAL', 'Terjadi kesalahan. Coba lagi.', $requestId);
}
