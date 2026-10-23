import { pool, query } from '../src/db';
import { createUser, findUserByPhone } from '../src/users';
import { signToken } from '../src/middleware/auth';

/**
 * One-off: seeds a demo account so the home screen has something to show
 * (handy for the screen recording) and prints a JWT for it.
 *
 *   npx tsx scripts/seed-demo.ts
 *
 * Idempotent - re-running replaces that account's loans rather than duplicating
 * them.
 */

const PHONE = '+919000000000';

const DEMO = [
  { friend: 'Priya Sharma', amount: 1500, due: daysFromNow(-8), note: 'Movie tickets + dinner' },
  { friend: 'Rahul Verma', amount: 450, due: daysFromNow(-5), note: 'Auto fare split' },
  { friend: 'Ananya Iyer', amount: 2400, due: daysFromNow(13), note: 'Concert tickets' },
  { friend: 'Karan Mehta', amount: 800, due: daysFromNow(-13), note: null, repaid: true },
];

function daysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const user = (await findUserByPhone(PHONE)) ?? (await createUser(PHONE));

  await query('DELETE FROM loans WHERE user_id = $1', [user.id]);

  for (const row of DEMO) {
    const [saved] = await query<{ id: number }>(
      `INSERT INTO loans (user_id, friend_name, amount, due_date, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, row.friend, row.amount, row.due, row.note],
    );
    if (row.repaid && saved) {
      await query('UPDATE loans SET repaid_at = now() WHERE id = $1', [saved.id]);
    }
  }

  console.log(`demo user: ${PHONE}  (id ${user.id})`);
  console.log(`seeded ${DEMO.length} loans`);
  console.log(`TOKEN=${signToken(user.id)}`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
