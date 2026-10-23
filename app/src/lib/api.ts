import { API_URL } from './config';
import type { Loan, LoanSummary } from './types';

/**
 * Thin API client. One `request()` helper owns the three things every call
 * needs - the base URL, the auth header, and turning a non-2xx response into a
 * thrown error the screens can render.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Network problems become a friendly message rather than a red box of JSON. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  token?: string;
  json?: unknown;
  form?: FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      0,
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your running API.',
      'NO_API_URL',
    );
  }

  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    // Do NOT set Content-Type for FormData - the runtime has to add the
    // multipart boundary itself, and a manual header breaks that.
    body = options.form;
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${API_URL}. Check that the backend is running and that EXPO_PUBLIC_API_URL uses your computer's LAN IP, not localhost.`,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? `Request failed with status ${response.status}`,
      payload?.code,
    );
  }

  return payload as T;
}

export interface CreateLoanInput {
  friend_name: string;
  amount: number;
  due_date: string;
  note?: string;
}

/** Shape the picker returns; `file` is populated on web only. */
export interface Receipt {
  uri: string;
  fileName: string;
  mimeType: string;
  file?: File;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ phone: string; ttlSeconds: number }>('/auth/request-otp', {
      method: 'POST',
      json: { phone },
    }),

  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: { id: number; phone: string } }>('/auth/verify-otp', {
      method: 'POST',
      json: { phone, code },
    }),

  listLoans: (token: string) => request<{ loans: Loan[] }>('/loans', { token }),

  summary: (token: string) => request<LoanSummary>('/loans/summary', { token }),

  markRepaid: (token: string, loanId: number) =>
    request<Loan>(`/loans/${loanId}/repaid`, { method: 'POST', token }),

  createLoan: (token: string, input: CreateLoanInput, receipt?: Receipt) => {
    const form = new FormData();
    form.append('friend_name', input.friend_name);
    form.append('amount', String(input.amount));
    form.append('due_date', input.due_date);
    if (input.note) form.append('note', input.note);

    if (receipt) {
      if (receipt.file) {
        // Web: the picker hands back a real File, which is what fetch expects.
        form.append('receipt', receipt.file);
      } else {
        // Native: React Native's FormData accepts this local-file shape.
        // It is not in the TypeScript DOM types, hence the cast.
        form.append('receipt', {
          uri: receipt.uri,
          name: receipt.fileName,
          type: receipt.mimeType,
        } as unknown as Blob);
      }
    }

    return request<Loan>('/loans', { method: 'POST', token, form });
  },
};

/** Mirrors the server's 5 MB limit so the user is told before a slow upload. */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
