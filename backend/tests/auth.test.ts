import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { __expireOtp, __peekOtp } from '../src/otp';
import { app, authHeader, loginAs, wrongCode } from './helpers';

describe('POST /auth/request-otp', () => {
  it('normalises a messy number to E.164 and does not leak the code', async () => {
    const res = await request(app).post('/auth/request-otp').send({ phone: '98765 43210' }).expect(202);

    expect(res.body.phone).toBe('+919876543210');
    expect(res.body.ttlSeconds).toBe(300);
    expect(res.body.code).toBeUndefined(); // the code belongs in the server log only
    expect(__peekOtp('+919876543210')).toMatch(/^\d{6}$/);
  });

  it('rejects a malformed phone number', async () => {
    const res = await request(app).post('/auth/request-otp').send({ phone: '12345' }).expect(400);
    expect(res.body.error).toMatch(/valid phone/i);
  });

  it('rejects a missing body', async () => {
    await request(app).post('/auth/request-otp').send({}).expect(400);
  });

  it('rate-limits a second request inside the resend window', async () => {
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(202);
    const res = await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(429);
    expect(res.body.code).toBe('OTP_RATE_LIMITED');
  });
});

describe('POST /auth/verify-otp', () => {
  it('accepts the real code and returns a JWT', async () => {
    const { token, userId } = await loginAs('9876543210');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
    expect(userId).toBeGreaterThan(0);
  });

  it('rejects a wrong code', async () => {
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(202);
    const real = __peekOtp('+919876543210')!;

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '9876543210', code: wrongCode(real) })
      .expect(401);

    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('rejects a code that is not six digits', async () => {
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(202);
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', code: '12345' }).expect(400);
  });

  it('rejects an expired code', async () => {
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(202);
    __expireOtp('+919876543210');

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '9876543210', code: '123456' })
      .expect(401);

    expect(res.body.error).toMatch(/expired/i);
  });

  it('rejects any code once the attempt budget is spent', async () => {
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(202);
    const real = __peekOtp('+919876543210')!;

    // 5 failures are tolerated, the 6th refuses outright...
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/auth/verify-otp')
        .send({ phone: '9876543210', code: wrongCode(real) })
        .expect(401);
    }
    const lockedOut = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '9876543210', code: wrongCode(real) })
      .expect(401);
    expect(lockedOut.body.error).toMatch(/too many attempts/i);

    // ...and even the correct code is now dead, so guessing is pointless.
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', code: real }).expect(401);
  });

  it('creates the user once, and reuses it on the next login', async () => {
    const first = await loginAs('9876543210');
    const second = await loginAs('9876543210');
    expect(second.userId).toBe(first.userId);
  });
});

describe('auth middleware', () => {
  it('protects /loans when no token is sent', async () => {
    const res = await request(app).get('/loans').expect(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('protects /loans when the token is garbage', async () => {
    await request(app).get('/loans').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('protects /loans when the token is signed with the wrong key', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: '1' }, 'some-other-secret', { algorithm: 'HS256', expiresIn: '1h' });
    await request(app).get('/loans').set(authHeader(forged)).expect(401);
  });

  it('protects the summary endpoint too', async () => {
    await request(app).get('/loans/summary').expect(401);
  });
});

describe('GET /health', () => {
  it('is public and does not require auth', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toMatchObject({ ok: true, service: 'miniledger-api' });
  });
});
