import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { pool } from '../src/db';
import { __clearOtps } from '../src/otp';
import { ensureUploadDir } from '../src/uploads';

// process.cwd() rather than __dirname: vitest transforms these files to ESM,
// where __dirname does not exist.
const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'sql', 'schema.sql'), 'utf8');

beforeAll(async () => {
  ensureUploadDir();
  await pool.query(schemaSql); // idempotent, so it can run before every file
});

beforeEach(async () => {
  // Wipe state between cases so tests are order-independent.
  await pool.query('TRUNCATE users, loans RESTART IDENTITY CASCADE');
  __clearOtps(); // otherwise the resend rate-limit would leak across tests
});

afterAll(async () => {
  await pool.end();
});
