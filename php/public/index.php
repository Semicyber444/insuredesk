<?php
declare(strict_types=1);

// `php -S` serves real files itself when the router declines.
if (PHP_SAPI === 'cli-server' && is_file(__DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH))) return false;

require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/web.php';

dispatch();
