<?php
// Validator per-field + pesan Indonesia. NOL-DEP. Pakai filter_var/checkdate/regex.
// T18: aturan per resource (specs/18) — AUD-API-01
declare(strict_types=1);

function v_required(mixed $v): bool {
    return $v !== null && $v !== '' && $v !== [];
}

function v_int_min(mixed $v, int $min): bool {
    if ($v === null || $v === '') return false;
    return filter_var($v, FILTER_VALIDATE_INT) !== false && (int) $v >= $min;
}

function v_date_id(mixed $v): bool {
    if (!is_string($v)) return false;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return false;
    [$y, $m, $d] = array_map('intval', explode('-', $v));
    return checkdate($m, $d, $y);
}

function v_in(mixed $v, array $allowed): bool {
    return in_array($v, $allowed, true);
}

function v_string_max(mixed $v, int $max): bool {
    if (!is_string($v)) return false;
    return mb_strlen($v) <= $max;
}

function v_email(mixed $v): bool {
    if (!is_string($v)) return false;
    return filter_var($v, FILTER_VALIDATE_EMAIL) !== false;
}

/** Lempar ValidationException bila ada field gagal. */
function v_assert(array $rules, array $input): void {
    $fields = [];
    foreach ($rules as $name => $checks) {
        foreach ($checks as [$fn, $args, $message]) {
            $fnName = $fn;
            if (!function_exists($fnName)) {
                // Allow closure? For now skip
                continue;
            }
            $val = $input[$name] ?? null;
            $ok = false;
            try {
                $ok = $fnName($val, ...$args);
            } catch (Throwable $e) {
                $ok = false;
            }
            if (!$ok) {
                $fields[$name] = $message;
                break;
            }
        }
    }
    if ($fields) throw new ValidationException('Periksa kembali isian.', $fields);
}
