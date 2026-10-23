/** Shapes returned by the API. Kept in sync with backend/src/loans.ts. */

export type LoanStatus = 'open' | 'overdue' | 'repaid';

export interface Loan {
  id: number;
  friend_name: string;
  amount: number;
  /** Always 'YYYY-MM-DD'. A string on purpose - see formatDate(). */
  due_date: string;
  note: string | null;
  /** Relative, e.g. "/uploads/1761267722913-a3f19c2b.png". */
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
