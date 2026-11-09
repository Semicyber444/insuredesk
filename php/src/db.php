<?php
declare(strict_types=1);

/** Splits mysql://user:pass@host:port/name?socketPath=... into its parts. */
function database_config(string $raw): array
{
    $url = parse_url($raw);
    if (!$url || empty($url['host'])) throw new RuntimeException('DATABASE_URL is not valid');
    parse_str($url['query'] ?? '', $query);
    $name = rawurldecode(ltrim($url['path'] ?? '', '/'));
    if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) throw new RuntimeException("Invalid database name: \"$name\"");
    return [
        'server' => empty($query['socketPath'])
            ? "mysql:host={$url['host']};port=" . ($url['port'] ?? 3306)
            : "mysql:unix_socket={$query['socketPath']}",
        'user' => rawurldecode($url['user'] ?? ''),
        'password' => rawurldecode($url['pass'] ?? ''),
        'database' => $name,
    ];
}

function pdo_connect(array $config, bool $useDatabase = true): PDO
{
    $dsn = $config['server'] . ';charset=utf8mb4' . ($useDatabase ? ";dbname={$config['database']}" : '');
    $pdo = new PDO($dsn, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Native prepares: real parameter binding, and integers come back as integers.
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $raw = getenv('DATABASE_URL');
        if (!$raw) throw new RuntimeException('DATABASE_URL is not set');
        $pdo = pdo_connect(database_config($raw));
    }
    return $pdo;
}

function db_param(mixed $value): mixed
{
    return is_bool($value) ? (int) $value : $value;
}

/** Returns rows typed like the Next.js app: numbers, booleans, DATE as Y-m-d, DATETIME as ISO UTC. */
function select(string $sql, array $params = []): array
{
    $statement = db()->prepare($sql);
    $statement->execute(array_map('db_param', $params));

    $casts = [];
    for ($i = 0; $i < $statement->columnCount(); $i++) {
        $meta = $statement->getColumnMeta($i);
        $type = $meta['native_type'] ?? '';
        if ($type === 'NEWDECIMAL') $casts[$meta['name']] = 'decimal';
        elseif ($type === 'DATETIME' || $type === 'TIMESTAMP') $casts[$meta['name']] = 'datetime';
        elseif ($type === 'TINY' && $meta['len'] === 1) $casts[$meta['name']] = 'bool';
    }

    $rows = $statement->fetchAll();
    if ($casts) {
        foreach ($rows as &$row) {
            foreach ($casts as $column => $cast) {
                if ($row[$column] === null) continue;
                $row[$column] = match ($cast) {
                    'decimal' => (float) $row[$column],
                    'datetime' => str_replace(' ', 'T', $row[$column]) . 'Z',
                    'bool' => (bool) $row[$column],
                };
            }
        }
    }
    return $rows;
}

function execute(string $sql, array $params = []): void
{
    db()->prepare($sql)->execute(array_map('db_param', $params));
}

function with_transaction(callable $work): mixed
{
    db()->beginTransaction();
    try {
        $result = $work();
        db()->commit();
        return $result;
    } catch (Throwable $err) {
        db()->rollBack();
        throw $err;
    }
}

function column_value(string $column, mixed $value): mixed
{
    if (is_string($value) && str_ends_with($column, '_at') && preg_match('/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/', $value)) {
        return str_replace(['T', 'Z'], [' ', ''], $value);
    }
    if (is_array($value)) return json_encode($value, JSON_UNESCAPED_UNICODE);
    return db_param($value);
}

/** $table and the row's keys must come from code, never from user input. */
function insert_row(string $table, array $row): void
{
    $columns = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
    $marks = implode(', ', array_fill(0, count($row), '?'));
    $values = array_map('column_value', array_keys($row), array_values($row));
    execute("INSERT INTO `$table` ($columns) VALUES ($marks)", $values);
}

/** $table and the keys of $fields must come from code, never from user input. */
function update_row(string $table, string $id, array $fields): void
{
    $assignments = implode(', ', array_map(fn($c) => "`$c` = ?", array_keys($fields)));
    $values = array_map('column_value', array_keys($fields), array_values($fields));
    execute("UPDATE `$table` SET $assignments WHERE id = ?", [...$values, $id]);
}

function placeholders(array $values): string
{
    return implode(', ', array_fill(0, count($values), '?'));
}
