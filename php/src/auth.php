<?php
declare(strict_types=1);

const SESSION_COOKIE = 'insuredesk_session';
const SESSION_TTL_SECONDS = 7 * 86400;
const ROLE_PRIORITY = ['admin', 'reviewer', 'editor', 'viewer'];
const DEMO_USER_IDS = [
    'admin' => '00000000-0000-0000-0000-000000000001',
    'reviewer' => '00000000-0000-0000-0000-000000000004',
    'editor' => '00000000-0000-0000-0000-000000000002',
    'viewer' => '00000000-0000-0000-0000-000000000003',
];
const SCRYPT_KEY_LENGTH = 64;
const MAX_FAILED_ATTEMPTS = 10;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LOCKED_MESSAGE = 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่';

function is_demo_auth_enabled(): bool
{
    return getenv('ENABLE_DEMO_AUTH') === 'true';
}

function is_demo_user(string $userId): bool
{
    return in_array($userId, DEMO_USER_IDS, true);
}

// These limits select N=2^14, r=8, p=1: the Node crypto.scrypt defaults the existing hashes use.
function scrypt_key(string $password, string $salt, int $length): string
{
    return sodium_crypto_pwhash_scryptsalsa208sha256($length, $password, $salt, 524288, 16777216);
}

/** Same `scrypt$salt$key` format as the Next.js app, so accounts carry over. */
function hash_password(string $password): string
{
    $salt = bin2hex(random_bytes(16));
    return "scrypt\$$salt\$" . bin2hex(scrypt_key($password, $salt, SCRYPT_KEY_LENGTH));
}

function verify_password(string $password, string $stored): bool
{
    $parts = explode('$', $stored);
    if (count($parts) !== 3 || $parts[0] !== 'scrypt' || strlen($parts[1]) !== 32 || !ctype_xdigit($parts[2])) return false;
    return hash_equals(hex2bin($parts[2]), scrypt_key($password, $parts[1], (int) (strlen($parts[2]) / 2)));
}

function hash_token(string $token): string
{
    return hash('sha256', $token);
}

function cookie_options(int $expires): array
{
    return [
        'expires' => $expires,
        'path' => url('/') ,
        'httponly' => true,
        'samesite' => 'Lax',
        // Set SESSION_COOKIE_INSECURE=true only when production is served over plain HTTP.
        'secure' => getenv('APP_ENV') === 'production' && getenv('SESSION_COOKIE_INSECURE') !== 'true',
    ];
}

function current_session(): ?array
{
    static $resolved = false, $session = null;
    if ($resolved) return $session;
    $resolved = true;

    $token = $_COOKIE[SESSION_COOKIE] ?? null;
    if (!is_string($token) || $token === '') return null;

    try {
        // Section 14: deactivated accounts are denied even with a valid session.
        $user = select(
            'SELECT u.id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.is_active = TRUE',
            [hash_token($token)]
        )[0] ?? null;
        if (!$user || (is_demo_user($user['id']) && !is_demo_auth_enabled())) return null;

        $held = array_column(select('SELECT role FROM user_roles WHERE user_id = ?', [$user['id']]), 'role');
        $roles = array_values(array_intersect(ROLE_PRIORITY, $held));
        $session = ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['display_name'], 'roles' => $roles ?: ['viewer']];
    } catch (Throwable $err) {
        error_log('Error reading session: ' . $err->getMessage());
    }
    return $session;
}

function start_session(string $userId): void
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $expires = time() + SESSION_TTL_SECONDS;
    execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3)');
    execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash_token($token), $userId, gmdate('Y-m-d H:i:s', $expires)]);
    if (PHP_SAPI !== 'cli') setcookie(SESSION_COOKIE, $token, cookie_options($expires));
}

function end_session(): void
{
    $token = $_COOKIE[SESSION_COOKIE] ?? null;
    if (is_string($token)) execute('DELETE FROM sessions WHERE token_hash = ?', [hash_token($token)]);
    if (PHP_SAPI !== 'cli') setcookie(SESSION_COOKIE, '', cookie_options(1));
}

/**
 * Records this attempt, then counts it with the others, and returns true when the email is locked.
 * Storing before counting means a burst of simultaneous guesses can't all pass while the count is zero.
 */
function register_login_attempt(string $email): bool
{
    $key = hash('sha256', $email);
    $window = LOGIN_WINDOW_MINUTES;
    execute("DELETE FROM login_attempts WHERE attempted_at <= UTC_TIMESTAMP(3) - INTERVAL $window MINUTE");
    execute('INSERT INTO login_attempts (email_hash, attempted_at) VALUES (?, UTC_TIMESTAMP(3))', [$key]);
    $count = select("SELECT COUNT(*) AS attempts FROM login_attempts WHERE email_hash = ? AND attempted_at > UTC_TIMESTAMP(3) - INTERVAL $window MINUTE", [$key]);
    return $count[0]['attempts'] > MAX_FAILED_ATTEMPTS;
}

function clear_failed_logins(string $email): void
{
    execute('DELETE FROM login_attempts WHERE email_hash = ?', [hash('sha256', $email)]);
}
