import fs from 'fs';
import path from 'path';
import { pool } from '../src/db';

/**
 * Applies sql/schema.sql. Safe to run repeatedly - the schema uses
 * CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 *
 * Deliberately plain SQL rather than a migration tool: for an app with two
 * tables, a migration framework is more code to explain than the SQL itself.
 */
async function main(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`Applying ${schemaPath}...`);
  await pool.query(sql);
  console.log('✅ Schema is up to date.');
}

main()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  });
