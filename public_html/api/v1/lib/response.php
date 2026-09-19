<?php
// Envelope JSON + exception validasi + helpers — NOL-DEP
// Kontrak: {ok:true,data:{...}} / {ok:false,error:{code,message,request_id}}
declare(strict_types=1);

class ValidationException extends Exception {
    public array $fields;
    public function __construct(string $message, array $fields = []) {
        parent::__construct($message);
        $this->fields = $fields;
    }
}

function json_ok(mixed $data, int $code = 200): string {
    http_response_code($code);
    return (string) json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function json_error(string $code, string $message, string $requestId, array $fields = [], int $httpCode = 400): string {
    http_response_code($httpCode);
    $error = ['code' => $code, 'message' => $message, 'request_id' => $requestId];
    if ($fields) $error['fields'] = $fields;
    return (string) json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
}

function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function now_ms(): int {
    return (int) (microtime(true) * 1000);
}

function gen_id(string $prefix = ''): string {
    return $prefix . bin2hex(random_bytes(8)) . '_' . time();
}

function redact_for_log(mixed $data): string {
    // Never log PII: email, amount, note, title, etc
    if (!is_array($data)) return substr((string)$data, 0, 200);
    $copy = $data;
    $sensitive = ['email','password','token','amount','note','title','description','phone','account','q','query','name'];
    foreach ($copy as $k => $v) {
        $low = strtolower($k);
        foreach ($sensitive as $s) {
            if (str_contains($low, $s) && !str_ends_with($low, '_hash')) {
                $copy[$k] = '[REDACTED]';
                break;
            }
        }
    }
    return json_encode($copy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
