import { pool } from '../src/db';

/** One-off: removes the E2E test user created while verifying the API. */
async function main(): Promise<void> {
  const result = await pool.query('DELETE FROM users WHERE phone = $1', ['+919000000001']);
  console.log(`deleted ${result.rowCount} test user (loans cascade-deleted)`);
}

main()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
