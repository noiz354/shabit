<?php
// Validator per-field + pesan Indonesia. NOL-DEP. Pakai filter_var/checkdate/regex.
// TODO(T18): aturan per resource (specs/18).
declare(strict_types=1);

function v_required(mixed $v): bool {
    return $v !== null && $v !== '' && $v !== [];
}

function v_int_min(mixed $v, int $min): bool {
    return filter_var($v, FILTER_VALIDATE_INT) !== false && (int) $v >= $min;
}

function v_date_id(string $v): bool {
    // Format YYYY-MM-DD.
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return false;
    [$y, $m, $d] = array_map('intval', explode('-', $v));
    return checkdate($m, $d, $y);
}

function v_in(mixed $v, array $allowed): bool {
    return in_array($v, $allowed, true);
}

/** Lempar ValidationException bila ada field gagal. */
function v_assert(array $rules, array $input): void {
    $fields = [];
    foreach ($rules as $name => $checks) {
        foreach ($checks as [$fn, $args, $message]) {
            if (!$fn($input[$name] ?? null, ...$args)) {
                $fields[$name] = $message;
                break;
            }
        }
    }
    if ($fields) throw new ValidationException('Periksa kembali isian.', $fields);
}
