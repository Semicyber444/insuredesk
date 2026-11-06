#!/usr/bin/env node
// Database CLI: migrate | seed | reset | create-user. Reads DATABASE_URL (see .env.example).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { hashPassword } from '../src/lib/auth/password.mjs';

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db');
const ROLES = ['viewer', 'editor', 'reviewer', 'admin'];

function databaseConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set (copy .env.example to .env.local)');
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name: "${database}"`);
  return { url, database };
}

async function connect() {
  const { url, database } = databaseConfig();
  const server = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    // MAMP turns TCP off; the app's pool reads the same ?socketPath= from the URL.
    socketPath: url.searchParams.get('socketPath') || undefined,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    multipleStatements: true,
    timezone: 'Z',
    charset: 'utf8mb4',
  });
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await server.query(`USE \`${database}\`; SET time_zone = '+00:00'`);
  return server;
}

async function migrate(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(255) NOT NULL PRIMARY KEY,
       applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
     )`
  );
  const [rows] = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(path.join(DB_DIR, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.query(await readFile(path.join(DB_DIR, 'migrations', file), 'utf8'));
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`applied ${file}`);
  }
  console.log('migrations up to date');
}

async function seed(db) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM plans');
  if (total > 0) throw new Error('Refusing to seed: plans already contains data');
  await db.query(await readFile(path.join(DB_DIR, 'seed.sql'), 'utf8'));
  console.log('seed data loaded');
}

async function reset(db) {
  const { database } = databaseConfig();
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset in production');
  await db.query(`DROP DATABASE \`${database}\``);
  await db.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${database}\``
  );
  await migrate(db);
  await seed(db);
}

async function createUser(db, args) {
  const option = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const email = option('email')?.trim().toLowerCase();
  const name = option('name')?.trim();
  const roles = (option('role') ?? 'viewer').split(',').map((r) => r.trim());
  const password = process.env.INSUREDESK_USER_PASSWORD;
  if (!email || !name) {
    throw new Error(
      'Usage: INSUREDESK_USER_PASSWORD=... npm run db:create-user -- --email a@b.co --name "Name" --role admin'
    );
  }
  if (!password || password.length < 12) {
    throw new Error('Set INSUREDESK_USER_PASSWORD to a password of at least 12 characters');
  }
  const invalid = roles.filter((r) => !ROLES.includes(r));
  if (invalid.length > 0) throw new Error(`Unknown role(s): ${invalid.join(', ')}`);

  const id = randomUUID();
  await db.query('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)', [
    id,
    email,
    await hashPassword(password),
    name,
  ]);
  for (const role of roles) {
    await db.query('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [randomUUID(), id, role]);
  }
  console.log(`created ${email} (${roles.join(', ')})`);
}

const [command, ...args] = process.argv.slice(2);
const commands = { migrate, seed, reset, 'create-user': (db) => createUser(db, args) };

if (!commands[command]) {
  console.error('Usage: node scripts/db.mjs <migrate|seed|reset|create-user>');
  process.exit(1);
}

let db;
try {
  db = await connect();
  await commands[command](db);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db?.end();
}
