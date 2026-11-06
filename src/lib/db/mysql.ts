import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

/** Anything that can run a statement: the pool, or a connection inside a transaction. */
export type Db = Pick<Pool | PoolConnection, 'query'>;

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/;

// Survives Next.js dev reloads, which would otherwise leak a pool on every edit.
const globalForPool = globalThis as unknown as { insuredeskPool?: Pool };

export function getPool(): Pool {
  if (globalForPool.insuredeskPool) return globalForPool.insuredeskPool;

  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL is not set');

  const pool = mysql.createPool({
    uri,
    charset: 'utf8mb4',
    timezone: 'Z',
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE) || 10,
    decimalNumbers: true,
    // query() would otherwise expand an object parameter into `col = value` SQL fragments.
    stringifyObjects: true,
    // Return rows in the shape src/types/database.ts declares.
    typeCast(field, next) {
      if (field.type === 'DATE') return field.string('utf8');
      if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
        const value = field.string('utf8');
        return value === null ? null : `${value.replace(' ', 'T')}Z`;
      }
      if (field.type === 'TINY' && field.length === 1) {
        const value = field.string('utf8');
        return value === null ? null : value === '1';
      }
      return next();
    },
  });
  globalForPool.insuredeskPool = pool;
  return pool;
}

export async function selectRows<T>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

export async function execute(db: Db, sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(work: (tx: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

function toColumnValue(column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (column.endsWith('_at') && typeof value === 'string' && ISO_TIMESTAMP.test(value)) {
    return new Date(value);
  }
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

/** `table` and the row's keys must come from code, never from user input. */
export async function insertRow(db: Db, table: string, row: object): Promise<void> {
  const entries = Object.entries(row);
  const columns = entries.map(([column]) => `\`${column}\``).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const values = entries.map(([column, value]) => toColumnValue(column, value));
  await execute(db, `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`, values);
}

/** `table` and the keys of `fields` must come from code, never from user input. */
export async function updateRow(db: Db, table: string, id: string, fields: object): Promise<void> {
  const entries = Object.entries(fields);
  const assignments = entries.map(([column]) => `\`${column}\` = ?`).join(', ');
  const values = entries.map(([column, value]) => toColumnValue(column, value));
  await execute(db, `UPDATE \`${table}\` SET ${assignments} WHERE id = ?`, [...values, id]);
}
