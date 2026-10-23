import { query, queryOne } from './db';
import { HttpError } from './errors';

/** Data layer for the loans table - all SQL lives here, no SQL in the routes. */

export type LoanStatus = 'open' | 'overdue' | 'repaid';

export interface Loan {
  id: number;
  friend_name: string;
  amount: number;
  due_date: string; // always 'YYYY-MM-DD'
  note: string | null;
  receipt_path: string | null;
  repaid_at: string | null;
  created_at: string;
  status: LoanStatus;
}

export interface LoanSummary {
  total_lent: number;
  total_repaid: number;
  overdue_amount: number;
  entry_count: number;
  overdue_count: number;
}

/**
 * "Is this overdue?" is decided in SQL, in one place, so the mobile app can
 * just render the status it is given.
 *
 * The casts matter:
 *  - `amount::float8`   node-pg returns NUMERIC as a *string* to avoid losing
 *                       precision; casting gives the API a JSON number.
 *  - `to_char(due_date)` node-pg returns DATE as a JS Date at local midnight,
 *                       which shifts by a day across timezones. A plain
 *                       'YYYY-MM-DD' string cannot drift.
 */
const LOAN_COLUMNS = `
  id,
  friend_name,
  amount::float8 AS amount,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  note,
  receipt_path,
  repaid_at,
  created_at,
  CASE
    WHEN repaid_at IS NOT NULL THEN 'repaid'
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS status
`;

export async function listLoans(userId: number): Promise<Loan[]> {
  return query<Loan>(
    `SELECT ${LOAN_COLUMNS}
       FROM loans
      WHERE user_id = $1
      ORDER BY repaid_at IS NULL DESC, due_date ASC, id DESC`,
    [userId],
  );
}

export interface CreateLoanInput {
  userId: number;
  friendName: string;
  amount: number;
  dueDate: string;
  note: string | null;
  receiptPath: string | null;
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const row = await queryOne<Loan>(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, note, receipt_path)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${LOAN_COLUMNS}`,
    [input.userId, input.friendName, input.amount, input.dueDate, input.note, input.receiptPath],
  );
  if (!row) throw new HttpError(500, 'Could not save the loan');
  return row;
}

/**
 * COALESCE makes this idempotent: calling it twice keeps the original
 * timestamp instead of silently moving the repayment date forward.
 * Returns null when no row matched, which the route turns into a 404 -
 * that also covers "id belongs to someone else", so users cannot mark
 * other people's loans repaid.
 */
export async function markRepaid(userId: number, loanId: number): Promise<Loan | null> {
  return queryOne<Loan>(
    `UPDATE loans
        SET repaid_at = COALESCE(repaid_at, now())
      WHERE id = $1 AND user_id = $2
      RETURNING ${LOAN_COLUMNS}`,
    [loanId, userId],
  );
}

/**
 * Postgres FILTER keeps the summary to one round-trip instead of three
 * separate SUM queries. Everything defaults to 0 so a brand-new user gets
 * sensible numbers rather than nulls.
 */
export async function getSummary(userId: number): Promise<LoanSummary> {
  const row = await queryOne<LoanSummary>(
    `SELECT
       COALESCE(SUM(amount), 0)::float8 AS total_lent,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NOT NULL), 0)::float8 AS total_repaid,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0)::float8 AS overdue_amount,
       COUNT(*)::int AS entry_count,
       COUNT(*) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE)::int AS overdue_count
     FROM loans
     WHERE user_id = $1`,
    [userId],
  );

  return row ?? { total_lent: 0, total_repaid: 0, overdue_amount: 0, entry_count: 0, overdue_count: 0 };
}
