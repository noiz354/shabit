<?php
// Envelope JSON + exception validasi. NOL-DEP.
declare(strict_types=1);

class ValidationException extends Exception {
    public array $fields;
    public function __construct(string $message, array $fields = []) {
        parent::__construct($message);
        $this->fields = $fields;
    }
}

function json_ok(mixed $data): string {
    return (string) json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
}

function json_error(string $code, string $message, string $requestId, array $fields = []): string {
    $error = ['code' => $code, 'message' => $message, 'request_id' => $requestId];
    if ($fields) $error['fields'] = $fields;
    return (string) json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
}
