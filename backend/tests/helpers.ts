import request from 'supertest';
import { createApp } from '../src/app';
import { __peekOtp } from '../src/otp';
import { normalizePhone } from '../src/phone';

export const app = createApp();

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Walks the real login flow: request a code, read it, verify it. */
export async function loginAs(phoneInput = '9876543210') {
  const phone = normalizePhone(phoneInput);

  await request(app).post('/auth/request-otp').send({ phone: phoneInput }).expect(202);

  const code = __peekOtp(phone);
  if (!code) throw new Error(`No OTP was issued for ${phone}`);

  const res = await request(app).post('/auth/verify-otp').send({ phone: phoneInput, code }).expect(200);
  return { token: res.body.token as string, userId: res.body.user.id as number, phone };
}

/** A code guaranteed to differ from the real one, without a 1-in-a-million flake. */
export function wrongCode(real: string): string {
  return real === '000000' ? '111111' : '000000';
}

/**
 * Stands in for an uploaded photo. The bytes are not a valid PNG on purpose -
 * what the API actually validates at upload time is the MIME type and size,
 * and asserting on real image bytes would test multer, not this codebase.
 */
export function fakeReceipt() {
  return {
    buffer: Buffer.from('pretend-this-is-a-receipt'),
    options: { filename: 'receipt.png', contentType: 'image/png' },
  };
}

export async function addLoan(token: string, fields: Record<string, string>) {
  const req = request(app).post('/loans').set(authHeader(token));
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  return (await req.expect(201)).body;
}

/** A date comfortably in the future, so the test never rots. */
export function futureDate(daysFromNow = 365): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}
