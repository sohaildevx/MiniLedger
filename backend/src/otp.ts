import { randomInt } from 'crypto';
import { config } from './config';
import { HttpError } from './errors';

/**
 * Mock OTP store.
 *
 * The brief says "mock OTP - just print the OTP in the server log", so codes
 * live in a Map in memory rather than being sent by SMS or written to the DB.
 *
 * Trade-off worth being able to explain: this resets on restart and does not
 * work across multiple server instances. A real deployment would put these in
 * Redis with a TTL, and swap `console.log` for an SMS provider call.
 */
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const store = new Map<string, OtpRecord>();
const MAX_ATTEMPTS = 5;

export interface IssuedOtp {
  code: string;
  ttlSeconds: number;
}

export function issueOtp(phone: string): IssuedOtp {
  const now = Date.now();
  const existing = store.get(phone);

  if (existing && now - existing.lastSentAt < config.OTP_RESEND_SECONDS * 1000) {
    const waitSeconds = Math.ceil((config.OTP_RESEND_SECONDS * 1000 - (now - existing.lastSentAt)) / 1000);
    throw new HttpError(
      429,
      `Please wait ${waitSeconds}s before requesting another code`,
      'OTP_RATE_LIMITED',
    );
  }

  const record: OtpRecord = {
    // randomInt is crypto-secure; Math.random() would be guessable.
    code: String(randomInt(100000, 1000000)),
    expiresAt: now + config.OTP_TTL_SECONDS * 1000,
    attempts: 0,
    lastSentAt: now,
  };
  store.set(phone, record);

  return { code: record.code, ttlSeconds: config.OTP_TTL_SECONDS };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyOtp(phone: string, code: string): VerifyResult {
  const record = store.get(phone);
  if (!record) return { ok: false, reason: 'No code requested for this number' };

  if (Date.now() > record.expiresAt) {
    store.delete(phone);
    return { ok: false, reason: 'That code has expired, request a new one' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    store.delete(phone);
    return { ok: false, reason: 'Too many attempts, request a new code' };
  }

  // Count the attempt BEFORE comparing, otherwise an attacker can brute-force
  // all 1,000,000 codes because failures never increment the counter.
  record.attempts += 1;

  if (record.code !== code) return { ok: false, reason: 'Incorrect code' };

  store.delete(phone); // single-use: the same code cannot be replayed
  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Test-only helpers. These are never wired to a route, so there is no HTTP
 * path that leaks a code - tests import the module directly instead of trying
 * to scrape console.log.
 * ---------------------------------------------------------------------- */

export function __peekOtp(phone: string): string | undefined {
  return store.get(phone)?.code;
}

export function __expireOtp(phone: string): void {
  const record = store.get(phone);
  if (record) record.expiresAt = Date.now() - 1;
}

export function __clearOtps(): void {
  store.clear();
}
