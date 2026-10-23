import { queryOne } from './db';

/** Users are created lazily on first successful OTP verification. */

export interface User {
  id: number;
  phone: string;
  created_at: string;
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  return queryOne<User>('SELECT id, phone, created_at FROM users WHERE phone = $1', [phone]);
}

export async function createUser(phone: string): Promise<User> {
  const row = await queryOne<User>(
    `INSERT INTO users (phone)
     VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone, created_at`,
    [phone],
  );
  // ON CONFLICT turns a race between two logins into an UPDATE of the same row,
  // so we never throw a duplicate-key error at a legitimate user.
  return row as User;
}
