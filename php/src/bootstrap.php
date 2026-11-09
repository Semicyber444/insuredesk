<?php
declare(strict_types=1);

const APP_ROOT = __DIR__ . '/..';
const DOCUMENTS_DIR = APP_ROOT . '/storage/documents';

date_default_timezone_set('UTC');

foreach (is_file(APP_ROOT . '/.env') ? file(APP_ROOT . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [] as $line) {
    if ($line[0] === '#' || !str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    // Real environment variables win over the file.
    if (getenv(trim($key)) === false) putenv(trim($key) . '=' . trim($value));
}

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/icons.php';
require __DIR__ . '/validation.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/store.php';
require __DIR__ . '/queries.php';
require __DIR__ . '/actions.php';
