import { Pool } from 'pg';
import { config } from './config';

/**
 * One shared connection pool for the whole process.
 * pg pools connections rather than opening one per request, which is what
 * makes Express safe to hammer without exhausting Postgres.
 *
 * Tests deliberately use a different database (TEST_DATABASE_URL) because the
 * suite truncates its tables between cases.
 */
const connectionString =
  config.NODE_ENV === 'test' && config.TEST_DATABASE_URL ? config.TEST_DATABASE_URL : config.DATABASE_URL;

export const pool = new Pool({ connectionString, max: 10 });

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
