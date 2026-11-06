import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const TABLES = [
  'audit_logs',
  'source_documents',
  'option_coverage_overrides',
  'version_coverages',
  'price_options',
  'eligibility_rules',
  'plan_versions',
  'plans',
  'vehicle_models',
  'insurers',
  'sessions',
  'login_attempts',
  'user_roles',
  'users',
];
const seedSql = readFileSync(path.join(process.cwd(), 'db', 'seed.sql'), 'utf8');

export async function resetDatabase(): Promise<void> {
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    multipleStatements: true,
    timezone: 'Z',
    charset: 'utf8mb4',
  });
  try {
    await connection.query(
      `SET time_zone = '+00:00'; ${TABLES.map((t) => `DELETE FROM ${t};`).join(' ')} ${seedSql}`
    );
  } finally {
    await connection.end();
  }
}
