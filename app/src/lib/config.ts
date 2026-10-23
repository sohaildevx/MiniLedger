/**
 * Where the API lives.
 *
 * EXPO_PUBLIC_* variables are inlined into the JavaScript bundle at build time,
 * so reading process.env here is safe on the client. The flip side: anything
 * prefixed EXPO_PUBLIC_ ships to the device in plain text - never put a secret
 * in one.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Receipts are stored on the server; this turns a relative path into a full URL. */
export function receiptUrl(path: string | null): string | null {
  return path ? `${API_URL}${path}` : null;
}
