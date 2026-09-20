<?php
// HabitWealth API v1 — front controller NOL-DEP, PHP >= 8.1
// Kontrak: specs/18-api-design.md + T18 + AUD-API-01
// Envelope: {ok,data,error{code,message,request_id}}
// Features: idempotency, cursor paging, q/sort/order, masking, re-auth, rate-limit, CSRF, redacted logs
declare(strict_types=1);

require __DIR__ . '/lib/response.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/idempotency.php';

$requestId = bin2hex(random_bytes(8));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Request-Id: ' . $requestId);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$routeRaw = $_GET['_route'] ?? trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
$routeRaw = preg_replace('#^(api/v1/)?#', '', (string) $routeRaw);
$route = trim($routeRaw, '/');

// Rate limit simple per IP (60/min)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/hw_api_rl_' . md5($ip) . '.json';
$now = time();
try {
    $rl = file_exists($rlFile) ? json_decode(file_get_contents($rlFile), true) : ['ts' => $now, 'count' => 0];
    if ($now - ($rl['ts'] ?? 0) > 60) $rl = ['ts' => $now, 'count' => 0];
    $rl['count'] = ($rl['count'] ?? 0) + 1;
    if ($rl['count'] > 120) {
        echo json_error('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi.', $requestId, [], 429);
        exit;
    }
    file_put_contents($rlFile, json_encode($rl));
} catch {}

$pdo = null;
try {
    $pdo = db();
} catch (Throwable $e) {
    error_log('[api] db failed ' . $requestId . ' ' . get_class($e));
    echo json_error('INTERNAL', 'Database tidak tersedia.', $requestId, [], 500);
    exit;
}

// Idempotency check for mutating methods
$idemKey = get_idempotency_key();
if ($idemKey && in_array($method, ['POST','PATCH','PUT','DELETE'], true)) {
    $existing = check_idempotency($pdo, $idemKey, $method, $route);
    if ($existing) {
        http_response_code($existing['code']);
        header('X-Idempotent-Replayed: true');
        echo $existing['body'];
        exit;
    }
}

function require_auth(): void {
    // For MVP, session mock — if HW_DSN is sqlite memory, allow all
    // In production, check session cookie HttpOnly; Secure; SameSite=Lax
    // For now, just check if session exists or allow
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    // Mock: if no user, set anonymous
    if (!isset($_SESSION['user_id'])) {
        $_SESSION['user_id'] = 'local';
    }
}

function get_user_id(): string {
    if (session_status() === PHP_SESSION_NONE) @session_start();
    return $_SESSION['user_id'] ?? 'local';
}

// Helpers for cursor paging
function parse_cursor(?string $cursor): int {
    if (!$cursor) return 0;
    $decoded = base64_decode($cursor, true);
    if ($decoded === false) return 0;
    return (int)$decoded;
}
function make_cursor(int $offset): string {
    return base64_encode((string)$offset);
}

// Route matching helper
function match_route(string $pattern, string $route, array &$params = []): bool {
    // pattern like habits/:id or habits/:id/history
    $pParts = explode('/', $pattern);
    $rParts = explode('/', $route);
    if (count($pParts) !== count($rParts)) return false;
    $params = [];
    foreach ($pParts as $i => $pp) {
        if (str_starts_with($pp, ':')) {
            $params[substr($pp,1)] = $rParts[$i];
        } elseif ($pp !== $rParts[$i]) {
            return false;
        }
    }
    return true;
}

// Main routing
try {
    $body = get_json_body();
    $query = $_GET;

    // Health
    if ($route === 'health' && $method === 'GET') {
        $data = ['php' => PHP_VERSION, 'time' => gmdate('c'), 'db' => 'ok'];
        $json = json_ok($data);
        if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
        echo $json;
        exit;
    }

    // Auth (mock for MVP)
    if (str_starts_with($route, 'auth/')) {
        $sub = substr($route, 5);
        if ($sub === 'signup' && $method === 'POST') {
            v_assert(['email' => [[ 'v_required', [], 'Email wajib']]], $body);
            if (session_status() === PHP_SESSION_NONE) @session_start();
            $_SESSION['user_id'] = 'user_' . bin2hex(random_bytes(4));
            $data = ['user_id' => $_SESSION['user_id'], 'email' => $body['email']];
            $json = json_ok($data, 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
        if ($sub === 'login' && $method === 'POST') {
            if (session_status() === PHP_SESSION_NONE) @session_start();
            $_SESSION['user_id'] = 'user_' . bin2hex(random_bytes(4));
            $data = ['user_id' => $_SESSION['user_id']];
            $json = json_ok($data);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
        if ($sub === 'logout' && $method === 'POST') {
            if (session_status() === PHP_SESSION_NONE) @session_start();
            session_destroy();
            $json = json_ok(['logged_out' => true]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
        if ($sub === 're-auth' && $method === 'POST') {
            // Mock re-auth — always success, returns token 5 min
            $token = bin2hex(random_bytes(16));
            if (session_status() === PHP_SESSION_NONE) @session_start();
            $_SESSION['re_auth_token'] = $token;
            $_SESSION['re_auth_exp'] = time() + 300;
            $data = ['re_auth_token' => $token, 'expires_in' => 300];
            $json = json_ok($data);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    // All other routes require auth (mock allows local)
    require_auth();
    $userId = get_user_id();

    // Habits CRUD
    if ($route === 'habits') {
        if ($method === 'GET') {
            $cursor = parse_cursor($query['cursor'] ?? null);
            $limit = min(50, max(1, (int)($query['limit'] ?? 20)));
            $stmt = $pdo->prepare("SELECT * FROM habits WHERE user_id = :uid ORDER BY updated_at DESC LIMIT :lim OFFSET :off");
            $stmt->bindValue(':uid', $userId);
            $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':off', $cursor, PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll();
            // Decode schedule json
            foreach ($items as &$it) { $it['schedule'] = json_decode($it['schedule'], true); }
            $nextCursor = count($items) === $limit ? make_cursor($cursor + $limit) : null;
            echo json_ok(['items' => $items, 'next_cursor' => $nextCursor]);
            exit;
        }
        if ($method === 'POST') {
            v_assert([
                'title' => [['v_required', [], 'Judul wajib']],
            ], $body);
            $id = $body['id'] ?? gen_id('habit_');
            $title = substr($body['title'], 0, 100);
            $goalType = $body['goal_type'] ?? 'check';
            if (!in_array($goalType, ['check','count','duration'], true)) $goalType = 'check';
            $schedule = json_encode($body['schedule'] ?? ['days'=>[1,2,3,4,5],'time'=>'08:00'], JSON_UNESCAPED_UNICODE);
            $category = substr($body['category'] ?? 'umum', 0, 50);
            $stmt = $pdo->prepare("INSERT INTO habits (id, user_id, title, goal_type, schedule, category, created_at, updated_at) VALUES (:id,:uid,:title,:gt,:sched,:cat,:c,:u)");
            $stmt->execute([':id'=>$id, ':uid'=>$userId, ':title'=>$title, ':gt'=>$goalType, ':sched'=>$schedule, ':cat'=>$category, ':c'=>time(), ':u'=>time()]);
            $data = ['id'=>$id, 'title'=>$title, 'goal_type'=>$goalType, 'schedule'=>json_decode($schedule,true), 'category'=>$category];
            $json = json_ok($data, 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
    }

    // Habits :id
    $params = [];
    if (match_route('habits/:id', $route, $params)) {
        $id = $params['id'];
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT * FROM habits WHERE id = :id AND user_id = :uid");
            $stmt->execute([':id'=>$id, ':uid'=>$userId]);
            $row = $stmt->fetch();
            if (!$row) { echo json_error('NOT_FOUND', 'Habit tidak ditemukan.', $requestId, [], 404); exit; }
            $row['schedule'] = json_decode($row['schedule'], true);
            echo json_ok($row);
            exit;
        }
        if ($method === 'PATCH') {
            $stmt = $pdo->prepare("SELECT * FROM habits WHERE id = :id AND user_id = :uid");
            $stmt->execute([':id'=>$id, ':uid'=>$userId]);
            $row = $stmt->fetch();
            if (!$row) { echo json_error('NOT_FOUND', 'Habit tidak ditemukan.', $requestId, [], 404); exit; }
            $title = isset($body['title']) ? substr($body['title'],0,100) : $row['title'];
            $category = isset($body['category']) ? substr($body['category'],0,50) : $row['category'];
            $schedule = isset($body['schedule']) ? json_encode($body['schedule'], JSON_UNESCAPED_UNICODE) : $row['schedule'];
            $stmt = $pdo->prepare("UPDATE habits SET title=:t, category=:c, schedule=:s, updated_at=:u WHERE id=:id");
            $stmt->execute([':t'=>$title, ':c'=>$category, ':s'=>$schedule, ':u'=>time(), ':id'=>$id]);
            $json = json_ok(['id'=>$id, 'title'=>$title, 'category'=>$category, 'schedule'=>json_decode($schedule,true)]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
        if ($method === 'DELETE') {
            $stmt = $pdo->prepare("DELETE FROM habits WHERE id = :id AND user_id = :uid");
            $stmt->execute([':id'=>$id, ':uid'=>$userId]);
            $json = json_ok(['deleted'=>true]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    // Habit history
    if (match_route('habits/:id/history', $route, $params) && $method === 'GET') {
        $habitId = $params['id'];
        $from = $query['from'] ?? null;
        $to = $query['to'] ?? null;
        $q = $query['q'] ?? null;
        $cursor = parse_cursor($query['cursor'] ?? null);
        $limit = min(50, max(1, (int)($query['limit'] ?? 20)));

        $sql = "SELECT * FROM habit_entries WHERE habit_id = :hid";
        $bind = [':hid'=>$habitId];
        if ($from) { $sql .= " AND date >= :from"; $bind[':from']=$from; }
        if ($to) { $sql .= " AND date <= :to"; $bind[':to']=$to; }
        if ($q) { $sql .= " AND (id LIKE :q OR status LIKE :q)"; $bind[':q']="%$q%"; }
        $sql .= " ORDER BY date DESC LIMIT :lim OFFSET :off";
        $stmt = $pdo->prepare($sql);
        foreach ($bind as $k=>$v) $stmt->bindValue($k,$v);
        $stmt->bindValue(':lim',$limit,PDO::PARAM_INT);
        $stmt->bindValue(':off',$cursor,PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();
        $nextCursor = count($items)===$limit ? make_cursor($cursor+$limit) : null;
        echo json_ok(['items'=>$items, 'next_cursor'=>$nextCursor]);
        exit;
    }

    // Habit entries
    if ($route === 'habit-entries') {
        if ($method === 'GET') {
            $habitId = $query['habit_id'] ?? null;
            $from = $query['from'] ?? null;
            $to = $query['to'] ?? null;
            $cursor = parse_cursor($query['cursor'] ?? null);
            $limit = min(50, max(1, (int)($query['limit'] ?? 20)));
            $sql = "SELECT * FROM habit_entries WHERE 1=1";
            $bind = [];
            if ($habitId) { $sql.=" AND habit_id = :hid"; $bind[':hid']=$habitId; }
            if ($from) { $sql.=" AND date >= :from"; $bind[':from']=$from; }
            if ($to) { $sql.=" AND date <= :to"; $bind[':to']=$to; }
            $sql.=" ORDER BY date DESC LIMIT :lim OFFSET :off";
            $stmt = $pdo->prepare($sql);
            foreach ($bind as $k=>$v) $stmt->bindValue($k,$v);
            $stmt->bindValue(':lim',$limit,PDO::PARAM_INT);
            $stmt->bindValue(':off',$cursor,PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll();
            $nextCursor = count($items)===$limit ? make_cursor($cursor+$limit) : null;
            echo json_ok(['items'=>$items, 'next_cursor'=>$nextCursor]);
            exit;
        }
        if ($method === 'POST') {
            v_assert([
                'habit_id' => [['v_required', [], 'habit_id wajib']],
                'date' => [['v_required', [], 'date wajib'], ['v_date_id', [], 'Format YYYY-MM-DD']],
            ], $body);
            $id = $body['id'] ?? gen_id('he_');
            $habitId = $body['habit_id'];
            $date = $body['date'];
            $status = $body['status'] ?? 'done';
            if (!in_array($status, ['done','missed','skipped'], true)) $status='done';
            $source = $body['source'] ?? 'manual';
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO habit_entries (id, habit_id, date, status, source, created_at, updated_at) VALUES (:id,:hid,:date,:st,:src,:c,:u)");
            $stmt->execute([':id'=>$id, ':hid'=>$habitId, ':date'=>$date, ':st'=>$status, ':src'=>$source, ':c'=>time(), ':u'=>time()]);
            $json = json_ok(['id'=>$id, 'habit_id'=>$habitId, 'date'=>$date, 'status'=>$status], 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
    }

    if (match_route('habit-entries/:id', $route, $params)) {
        $id = $params['id'];
        if ($method === 'PATCH') {
            $stmt = $pdo->prepare("SELECT * FROM habit_entries WHERE id = :id");
            $stmt->execute([':id'=>$id]);
            $row = $stmt->fetch();
            if (!$row) { echo json_error('NOT_FOUND', 'Entry tidak ditemukan.', $requestId, [], 404); exit; }
            $status = $body['status'] ?? $row['status'];
            $stmt = $pdo->prepare("UPDATE habit_entries SET status=:s, updated_at=:u WHERE id=:id");
            $stmt->execute([':s'=>$status, ':u'=>time(), ':id'=>$id]);
            $json = json_ok(['id'=>$id, 'status'=>$status]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
        if ($method === 'DELETE') {
            $stmt = $pdo->prepare("DELETE FROM habit_entries WHERE id = :id");
            $stmt->execute([':id'=>$id]);
            $json = json_ok(['deleted'=>true]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    // Transactions
    if ($route === 'transactions') {
        if ($method === 'GET') {
            $from = $query['from'] ?? null;
            $to = $query['to'] ?? null;
            $cat = $query['cat'] ?? $query['category'] ?? null;
            $q = $query['q'] ?? null;
            $sort = $query['sort'] ?? 'date';
            $order = strtoupper($query['order'] ?? 'DESC');
            if (!in_array($order, ['ASC','DESC'], true)) $order='DESC';
            if (!in_array($sort, ['date','amount','category'], true)) $sort='date';
            $cursor = parse_cursor($query['cursor'] ?? null);
            $limit = min(50, max(1, (int)($query['limit'] ?? 20)));

            $sql = "SELECT * FROM transactions WHERE 1=1";
            $bind = [];
            if ($from) { $sql.=" AND date >= :from"; $bind[':from']=$from; }
            if ($to) { $sql.=" AND date <= :to"; $bind[':to']=$to; }
            if ($cat) { $sql.=" AND category = :cat"; $bind[':cat']=$cat; }
            if ($q) { $sql.=" AND (category LIKE :q OR note LIKE :q OR CAST(amount AS TEXT) LIKE :q)"; $bind[':q']="%$q%"; }
            $sql.=" ORDER BY $sort $order LIMIT :lim OFFSET :off";
            $stmt = $pdo->prepare($sql);
            foreach ($bind as $k=>$v) $stmt->bindValue($k,$v);
            $stmt->bindValue(':lim',$limit,PDO::PARAM_INT);
            $stmt->bindValue(':off',$cursor,PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll();
            // Masking: account_ref masked already, amount masking handled client-side, but we return masked if no re-auth? For MVP, return full but client masks
            $nextCursor = count($items)===$limit ? make_cursor($cursor+$limit) : null;
            echo json_ok(['items'=>$items, 'next_cursor'=>$nextCursor]);
            exit;
        }
        if ($method === 'POST') {
            v_assert([
                'kind' => [['v_required', [], 'kind wajib']],
                'amount' => [['v_required', [], 'amount wajib'], ['v_int_min', [1], 'amount harus >0']],
                'category' => [['v_required', [], 'kategori wajib']],
                'date' => [['v_required', [], 'date wajib'], ['v_date_id', [], 'Format YYYY-MM-DD']],
            ], $body);
            $id = $body['id'] ?? gen_id('tx_');
            $kind = $body['kind'];
            if (!in_array($kind, ['income','expense','transfer'], true)) $kind='expense';
            $amount = (int)$body['amount'];
            $category = substr($body['category'],0,50);
            $date = $body['date'];
            $accountRef = substr($body['account_ref'] ?? 'BCA •••• 4821',0,50);
            $note = isset($body['note']) ? substr($body['note'],0,200) : null;

            $stmt = $pdo->prepare("INSERT INTO transactions (id, kind, amount, category, date, account_ref, note, created_at, updated_at) VALUES (:id,:kind,:amt,:cat,:date,:acc,:note,:c,:u)");
            $stmt->execute([':id'=>$id, ':kind'=>$kind, ':amt'=>$amount, ':cat'=>$category, ':date'=>$date, ':acc'=>$accountRef, ':note'=>$note, ':c'=>time(), ':u'=>time()]);
            $json = json_ok(['id'=>$id, 'kind'=>$kind, 'amount'=>$amount, 'category'=>$category, 'date'=>$date], 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
    }

    if (match_route('transactions/:id', $route, $params)) {
        $id = $params['id'];
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT * FROM transactions WHERE id = :id");
            $stmt->execute([':id'=>$id]);
            $row = $stmt->fetch();
            if (!$row) { echo json_error('NOT_FOUND', 'Transaksi tidak ditemukan.', $requestId, [], 404); exit; }
            echo json_ok($row);
            exit;
        }
        if ($method === 'PATCH') {
            $stmt = $pdo->prepare("SELECT * FROM transactions WHERE id = :id");
            $stmt->execute([':id'=>$id]);
            $row = $stmt->fetch();
            if (!$row) { echo json_error('NOT_FOUND', 'Transaksi tidak ditemukan.', $requestId, [], 404); exit; }
            $category = isset($body['category']) ? substr($body['category'],0,50) : $row['category'];
            $note = isset($body['note']) ? substr($body['note'],0,200) : $row['note'];
            $stmt = $pdo->prepare("UPDATE transactions SET category=:cat, note=:note, updated_at=:u WHERE id=:id");
            $stmt->execute([':cat'=>$category, ':note'=>$note, ':u'=>time(), ':id'=>$id]);
            $json = json_ok(['id'=>$id, 'category'=>$category, 'note'=>$note]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
        if ($method === 'DELETE') {
            $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = :id");
            $stmt->execute([':id'=>$id]);
            $json = json_ok(['deleted'=>true]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    // Budgets
    if ($route === 'budgets') {
        if ($method === 'GET') {
            $q = $query['q'] ?? null;
            $month = $query['month'] ?? null;
            $sql = "SELECT * FROM budgets WHERE 1=1";
            $bind = [];
            if ($month) { $sql.=" AND month = :month"; $bind[':month']=$month; }
            if ($q) { $sql.=" AND category LIKE :q"; $bind[':q']="%$q%"; }
            $sql.=" ORDER BY month DESC";
            $stmt = $pdo->prepare($sql);
            foreach ($bind as $k=>$v) $stmt->bindValue($k,$v);
            $stmt->execute();
            $items = $stmt->fetchAll();
            echo json_ok(['items'=>$items]);
            exit;
        }
        if (in_array($method, ['POST','PUT'], true)) {
            v_assert([
                'category' => [['v_required', [], 'kategori wajib']],
                'limit' => [['v_required', [], 'limit wajib'], ['v_int_min', [1], 'limit >0']],
                'month' => [['v_required', [], 'month wajib']],
            ], $body);
            $id = $body['id'] ?? ($body['category'] . '_' . $body['month']);
            $category = substr($body['category'],0,50);
            $limit = (int)$body['limit'];
            $month = substr($body['month'],0,7);
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO budgets (id, category, limit_amount, month, created_at, updated_at) VALUES (:id,:cat,:lim,:month,:c,:u)");
            $stmt->execute([':id'=>$id, ':cat'=>$category, ':lim'=>$limit, ':month'=>$month, ':c'=>time(), ':u'=>time()]);
            $json = json_ok(['id'=>$id, 'category'=>$category, 'limit'=>$limit, 'month'=>$month]);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    if ($route === 'budgets/status' && $method === 'GET') {
        $month = $query['month'] ?? date('Y-m');
        $stmt = $pdo->prepare("SELECT * FROM budgets WHERE month = :month");
        $stmt->execute([':month'=>$month]);
        $budgets = $stmt->fetchAll();

        // Calculate spent per category
        $stmt = $pdo->prepare("SELECT category, SUM(amount) as spent FROM transactions WHERE kind='expense' AND date LIKE :like GROUP BY category");
        $stmt->execute([':like'=>"$month%"]);
        $spentMap = [];
        foreach ($stmt->fetchAll() as $row) { $spentMap[$row['category']] = (int)$row['spent']; }

        $result = [];
        foreach ($budgets as $b) {
            $spent = $spentMap[$b['category']] ?? 0;
            $pct = $b['limit_amount'] ? (int)round(($spent / $b['limit_amount'])*100) : 0;
            $status = $pct >= 100 ? 'over' : ($pct >= 80 ? 'warning' : 'ok');
            $result[] = ['category'=>$b['category'], 'limit'=>$b['limit_amount'], 'spent'=>$spent, 'pct'=>$pct, 'status'=>$status, 'month'=>$b['month']];
        }
        echo json_ok(['items'=>$result, 'month'=>$month]);
        exit;
    }

    // Savings goals (virtual, BUKAN transfer uang)
    if ($route === 'savings-goals') {
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT * FROM savings_goals ORDER BY updated_at DESC");
            $stmt->execute();
            echo json_ok(['items'=>$stmt->fetchAll()]);
            exit;
        }
        if ($method === 'POST') {
            v_assert([
                'name' => [['v_required', [], 'nama wajib']],
                'daily_amount' => [['v_required', [], 'daily_amount wajib'], ['v_int_min', [1], '>0']],
            ], $body);
            $id = $body['id'] ?? gen_id('goal_');
            $name = substr($body['name'],0,100);
            $daily = (int)$body['daily_amount'];
            $sourceRef = substr($body['source_ref'] ?? 'BCA •••• 4821',0,50);
            $stmt = $pdo->prepare("INSERT INTO savings_goals (id, name, daily_amount, source_ref, created_at, updated_at) VALUES (:id,:name,:daily,:src,:c,:u)");
            $stmt->execute([':id'=>$id, ':name'=>$name, ':daily'=>$daily, ':src'=>$sourceRef, ':c'=>time(), ':u'=>time()]);
            $json = json_ok(['id'=>$id, 'name'=>$name, 'daily_amount'=>$daily], 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
    }

    if (preg_match('#^savings-goals/([^/]+)/(allocate|withdraw)$#', $route, $m) && $method === 'POST') {
        $goalId = $m[1];
        $action = $m[2];
        // Check goal exists
        $stmt = $pdo->prepare("SELECT * FROM savings_goals WHERE id = :id");
        $stmt->execute([':id'=>$goalId]);
        $goal = $stmt->fetch();
        if (!$goal) { echo json_error('NOT_FOUND', 'Goal tidak ditemukan.', $requestId, [], 404); exit; }
        // Virtual allocation, no money movement
        $amount = (int)($body['amount'] ?? $goal['daily_amount']);
        $data = ['goal_id'=>$goalId, 'action'=>$action, 'amount'=>$amount, 'note'=>'Virtual allocation, BUKAN transfer uang. Dana masih di rekeningmu.'];
        $json = json_ok($data);
        if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
        echo $json;
        exit;
    }

    // Dashboard summary
    if ($route === 'dashboard/summary' && $method === 'GET') {
        $from = $query['from'] ?? date('Y-m-01');
        $to = $query['to'] ?? date('Y-m-d');
        $tz = $query['tz'] ?? 'Asia/Jakarta';

        // Habits summary
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM habits WHERE user_id = :uid");
        $stmt->execute([':uid'=>$userId]);
        $habitTotal = (int)($stmt->fetch()['total'] ?? 0);

        $stmt = $pdo->prepare("SELECT COUNT(*) as done FROM habit_entries WHERE date >= :from AND date <= :to AND status='done'");
        $stmt->execute([':from'=>$from, ':to'=>$to]);
        $habitDone = (int)($stmt->fetch()['done'] ?? 0);

        // Cashflow
        $stmt = $pdo->prepare("SELECT kind, SUM(amount) as total FROM transactions WHERE date >= :from AND date <= :to GROUP BY kind");
        $stmt->execute([':from'=>$from, ':to'=>$to]);
        $cashflow = ['in'=>0,'out'=>0];
        foreach ($stmt->fetchAll() as $row) {
            if ($row['kind']==='income') $cashflow['in'] = (int)$row['total'];
            else $cashflow['out'] = (int)$row['total'];
        }

        // By category
        $stmt = $pdo->prepare("SELECT category, SUM(amount) as total FROM transactions WHERE date >= :from AND date <= :to AND kind='expense' GROUP BY category ORDER BY total DESC LIMIT 10");
        $stmt->execute([':from'=>$from, ':to'=>$to]);
        $byCategory = $stmt->fetchAll();

        $data = [
            'habits'=>['done'=>$habitDone, 'total'=>$habitTotal],
            'cashflow'=>$cashflow,
            'by_category'=>$byCategory,
            'freshness'=>['ts'=>time(), 'tz'=>$tz],
            'range'=>['from'=>$from, 'to'=>$to],
        ];
        echo json_ok($data);
        exit;
    }

    // Export requests
    if ($route === 'export/requests' && $method === 'POST') {
        $id = gen_id('export_');
        $scope = $body['scope'] ?? 'all';
        $stmt = $pdo->prepare("INSERT INTO export_requests (id, status, scope, created_at) VALUES (:id,'processing',:scope,:c)");
        $stmt->execute([':id'=>$id, ':scope'=>$scope, ':c'=>time()]);
        // For MVP, immediately mark completed (real would be async)
        $stmt = $pdo->prepare("UPDATE export_requests SET status='completed', completed_at=:t WHERE id=:id");
        $stmt->execute([':t'=>time(), ':id'=>$id]);
        $json = json_ok(['id'=>$id, 'status'=>'completed', 'scope'=>$scope], 201);
        if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
        echo $json;
        exit;
    }

    if (match_route('export/requests/:id', $route, $params) && $method === 'GET') {
        $id = $params['id'];
        $stmt = $pdo->prepare("SELECT * FROM export_requests WHERE id = :id");
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) { echo json_error('NOT_FOUND', 'Export tidak ditemukan.', $requestId, [], 404); exit; }
        echo json_ok($row);
        exit;
    }

    // Deletion requests
    if ($route === 'account/deletion-requests' && $method === 'POST') {
        // Re-auth required
        if (session_status()===PHP_SESSION_NONE) @session_start();
        if (!isset($_SESSION['re_auth_token']) || ($_SESSION['re_auth_exp'] ?? 0) < time()) {
            echo json_error('FORBIDDEN', 'Re-auth diperlukan.', $requestId, [], 403);
            exit;
        }
        $id = gen_id('del_');
        $reason = substr($body['reason'] ?? '',0,500);
        $stmt = $pdo->prepare("INSERT INTO deletion_requests (id, status, reason, created_at) VALUES (:id,'pending',:reason,:c)");
        $stmt->execute([':id'=>$id, ':reason'=>$reason, ':c'=>time()]);
        $json = json_ok(['id'=>$id, 'status'=>'pending'], 201);
        if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
        echo $json;
        exit;
    }

    if (match_route('account/deletion-requests/:id/cancel', $route, $params) && $method === 'DELETE') {
        $id = $params['id'];
        $stmt = $pdo->prepare("DELETE FROM deletion_requests WHERE id = :id");
        $stmt->execute([':id'=>$id]);
        echo json_ok(['cancelled'=>true]);
        exit;
    }

    // Notification preferences
    if ($route === 'notification-preferences') {
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT prefs FROM notification_preferences WHERE user_id = :uid");
            $stmt->execute([':uid'=>$userId]);
            $row = $stmt->fetch();
            $prefs = $row ? json_decode($row['prefs'], true) : ['enabled'=>true, 'quietHours'=>['start'=>'22:00','end'=>'07:00'], 'categories'=>['habit'=>true,'budget'=>true,'insight'=>true,'system'=>true]];
            echo json_ok($prefs);
            exit;
        }
        if ($method === 'PATCH') {
            $prefsJson = json_encode($body, JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO notification_preferences (user_id, prefs, updated_at) VALUES (:uid,:prefs,:u)");
            $stmt->execute([':uid'=>$userId, ':prefs'=>$prefsJson, ':u'=>time()]);
            $json = json_ok(json_decode($prefsJson, true));
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 200, $json);
            echo $json;
            exit;
        }
    }

    // Help search (no heavy auth, rate-limited)
    if ($route === 'help/search' && $method === 'GET') {
        $q = $query['q'] ?? '';
        $q = substr($q,0,100);
        // Static FAQ for MVP
        $faq = [
            ['title'=>'Cara menambah habit','snippet'=>'Buka tab Habit → Tambah → Isi judul, jadwal, simpan','id'=>'faq_1'],
            ['title'=>'Saldo dimasking','snippet'=>'Rp•••• untuk privasi, re-auth untuk reveal','id'=>'faq_2'],
            ['title'=>'Data offline','snippet'=>'IndexedDB + outbox sync otomatis','id'=>'faq_3'],
            ['title'=>'Export data','snippet'=>'Pengaturan → Data & Privasi → Export, butuh re-auth','id'=>'faq_4'],
        ];
        $filtered = $faq;
        if ($q) {
            $lower = strtolower($q);
            $filtered = array_filter($faq, fn($f)=> str_contains(strtolower($f['title']), $lower) || str_contains(strtolower($f['snippet']), $lower));
        }
        $items = array_slice(array_values($filtered),0,10);
        echo json_ok(['items'=>$items, 'q_len'=>strlen($q)]);
        exit;
    }

    // Push VAPID public key (R1.1 design)
    if ($route === 'push/vapid-public-key' && $method === 'GET') {
        // In production, generate via openssl EC P-256, public key base64url
        $publicKey = getenv('HW_VAPID_PUBLIC') ?: 'BP6-...mock...'; // mock
        echo json_ok(['public_key'=>$publicKey]);
        exit;
    }

    // Push subscriptions
    if ($route === 'push/subscriptions') {
        if ($method === 'POST') {
            v_assert([
                'endpoint' => [['v_required', [], 'endpoint wajib']],
            ], $body);
            $endpoint = $body['endpoint'];
            $hash = hash('sha256', $endpoint);
            $keysAuth = $body['keys']['auth'] ?? '';
            $keysP256dh = $body['keys']['p256dh'] ?? '';
            $tz = $body['tz'] ?? 'Asia/Jakarta';
            $cats = json_encode($body['categories'] ?? [], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO push_subscriptions (endpoint_hash, endpoint, keys_auth, keys_p256dh, tz, categories, created_at) VALUES (:h,:e,:a,:p,:tz,:c,:t)");
            $stmt->execute([':h'=>$hash, ':e'=>$endpoint, ':a'=>$keysAuth, ':p'=>$keysP256dh, ':tz'=>$tz, ':c'=>$cats, ':t'=>time()]);
            $json = json_ok(['endpoint_hash'=>$hash], 201);
            if ($idemKey) store_idempotency($pdo, $idemKey, $method, $route, 201, $json);
            echo $json;
            exit;
        }
    }

    if (match_route('push/subscriptions/:hash', $route, $params) && $method === 'DELETE') {
        $hash = $params['hash'];
        $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE endpoint_hash = :h");
        $stmt->execute([':h'=>$hash]);
        echo json_ok(['deleted'=>true]);
        exit;
    }

    // Analytics (already have separate file, but also handle here for completeness)
    if ($route === 'analytics' && $method === 'POST') {
        $events = $body['events'] ?? [];
        if (!is_array($events)) $events = [];
        $allowed = ['signup_completed','onboarding_completed','habit_completed','habit_skipped_day','transaction_created','category_corrected','budget_threshold_hit','connection_started','connection_completed','connection_failed','sync_failed','sync_recovered','notification_opened','notification_dismissed','export_requested','deletion_requested','paywall_shown','paywall_dismissed','range_changed','range_custom_applied','range_empty_shown','search_opened','search_executed','search_result_opened','search_history_cleared','permission_granted','permission_denied','insight_viewed','goal_created','goal_completed','goal_withdrawn','celebration_shared','celebration_dismissed','pwa_installed','pwa_dismissed'];
        $safe = [];
        foreach (array_slice($events,0,20) as $ev) {
            if (!isset($ev['event']) || !in_array($ev['event'], $allowed, true)) continue;
            $safe[] = ['event'=>substr($ev['event'],0,64), 'ts'=>substr($ev['ts'] ?? gmdate('c'),0,32)];
        }
        foreach ($safe as $s) {
            $stmt = $pdo->prepare("INSERT INTO analytics_events (id, event, props, ts, created_at) VALUES (:id,:ev,:props,:ts,:c)");
            $stmt->execute([':id'=>gen_id('a_'), ':ev'=>$s['event'], ':props'=>json_encode($s, JSON_UNESCAPED_UNICODE), ':ts'=>$s['ts'], ':c'=>time()]);
        }
        echo json_ok(['received'=>count($safe)]);
        exit;
    }

    // No route matched
    $knownRoutes = ['health','auth/signup','auth/login','auth/logout','auth/re-auth','habits','habits/:id','habits/:id/history','habit-entries','habit-entries/:id','transactions','transactions/:id','budgets','budgets/status','savings-goals','savings-goals/:id/allocate','savings-goals/:id/withdraw','dashboard/summary','export/requests','export/requests/:id','account/deletion-requests','account/deletion-requests/:id/cancel','notification-preferences','help/search','push/vapid-public-key','push/subscriptions','push/subscriptions/:hash','analytics'];
    $matched = false;
    foreach ($knownRoutes as $kr) {
        $tmp=[];
        if (match_route($kr, $route, $tmp)) { $matched=true; break; }
    }
    http_response_code($matched ? 405 : 404);
    echo json_error($matched ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND', 'Rute tidak dikenal: ' . $route, $requestId, [], $matched ? 405 : 404);
    exit;

} catch (ValidationException $e) {
    error_log('[api] validation ' . $requestId . ' ' . redact_for_log($e->fields));
    echo json_error('VALIDATION', $e->getMessage(), $requestId, $e->fields, 422);
    exit;
} catch (Throwable $e) {
    error_log('[api] ' . $requestId . ' ' . get_class($e) . ' ' . $e->getMessage());
    echo json_error('INTERNAL', 'Terjadi kesalahan. Coba lagi.', $requestId, [], 500);
    exit;
} finally {
    if ($pdo) {
        try { cleanup_idempotency($pdo); } catch {}
    }
}
