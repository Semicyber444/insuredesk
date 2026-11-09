#!/usr/bin/env php
<?php
// Database CLI: migrate | seed | reset | create-user. Reads DATABASE_URL (see .env.example).
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/../src/bootstrap.php';

function db_connect(): array
{
    $raw = getenv('DATABASE_URL');
    if (!$raw) throw new RuntimeException('DATABASE_URL is not set (copy .env.example to .env)');
    $config = database_config($raw);
    $server = pdo_connect($config, false);
    $server->exec("CREATE DATABASE IF NOT EXISTS `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $server->exec("USE `{$config['database']}`");
    return [$server, $config];
}

/** Runs a file of ;-separated statements. Emulated prepares allow multi-statement exec. */
function run_sql_file(PDO $pdo, string $file): void
{
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
    $statement = $pdo->prepare((string) file_get_contents($file));
    $statement->execute();
    do { $statement->fetchAll(); } while ($statement->nextRowset());
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
}

function migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
    $applied = $pdo->query('SELECT name FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
    $files = glob(APP_ROOT . '/db/migrations/*.sql');
    sort($files);
    foreach ($files as $file) {
        $name = basename($file);
        if (in_array($name, $applied, true)) continue;
        run_sql_file($pdo, $file);
        $pdo->prepare('INSERT INTO schema_migrations (name) VALUES (?)')->execute([$name]);
        echo "applied $name\n";
    }
    echo "migrations up to date\n";
}

function seed(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM plans')->fetchColumn() > 0) throw new RuntimeException('Refusing to seed: plans already contains data');
    run_sql_file($pdo, APP_ROOT . '/db/seed.sql');
    echo "seed data loaded\n";
}

function reset_database(PDO $pdo, array $config): void
{
    if (getenv('APP_ENV') === 'production') throw new RuntimeException('Refusing to reset in production');
    $pdo->exec("DROP DATABASE `{$config['database']}`");
    $pdo->exec("CREATE DATABASE `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$config['database']}`");
    migrate($pdo);
    seed($pdo);
}

function create_user(PDO $pdo, array $args): void
{
    $option = function (string $name) use ($args) {
        $i = array_search("--$name", $args, true);
        return $i === false ? null : ($args[$i + 1] ?? null);
    };
    $email = strtolower(trim((string) $option('email')));
    $name = trim((string) $option('name'));
    $roles = array_map('trim', explode(',', $option('role') ?? 'viewer'));
    $password = getenv('INSUREDESK_USER_PASSWORD');
    if ($email === '' || $name === '') throw new RuntimeException('Usage: INSUREDESK_USER_PASSWORD=... php bin/db.php create-user --email a@b.co --name "Name" --role admin');
    if (!$password || strlen($password) < 12) throw new RuntimeException('Set INSUREDESK_USER_PASSWORD to a password of at least 12 characters');
    $invalid = array_diff($roles, array_keys(ROLE_PERMISSIONS));
    if ($invalid) throw new RuntimeException('Unknown role(s): ' . implode(', ', $invalid));

    $id = uuid();
    $pdo->prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)')->execute([$id, $email, hash_password($password), $name]);
    $insert = $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)');
    foreach ($roles as $role) $insert->execute([uuid(), $id, $role]);
    echo "created $email (" . implode(', ', $roles) . ")\n";
}

$command = $argv[1] ?? '';
if (!in_array($command, ['migrate', 'seed', 'reset', 'create-user'], true)) {
    fwrite(STDERR, "Usage: php bin/db.php <migrate|seed|reset|create-user>\n");
    exit(1);
}

try {
    [$pdo, $config] = db_connect();
    match ($command) {
        'migrate' => migrate($pdo),
        'seed' => seed($pdo),
        'reset' => reset_database($pdo, $config),
        'create-user' => create_user($pdo, array_slice($argv, 2)),
    };
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
