import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, addLoan, authHeader, fakeReceipt, futureDate, loginAs } from './helpers';

describe('POST /loans', () => {
  it('creates a loan from a JSON body', async () => {
    const { token } = await loginAs();

    const res = await request(app)
      .post('/loans')
      .set(authHeader(token))
      .send({ friend_name: 'Priya', amount: 1500, due_date: futureDate(), note: 'movie tickets' })
      .expect(201);

    expect(res.body).toMatchObject({
      friend_name: 'Priya',
      amount: 1500, // a number in the response, not the string NUMERIC returns
      due_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      status: 'open',
      receipt_path: null,
      repaid_at: null,
    });
  });

  it('creates a loan from a multipart form with a receipt photo', async () => {
    const { token } = await loginAs();
    const { buffer, options } = fakeReceipt();

    const res = await request(app)
      .post('/loans')
      .set(authHeader(token))
      .field('friend_name', 'Rahul')
      .field('amount', '250') // form fields arrive as strings
      .field('due_date', futureDate())
      .attach('receipt', buffer, options)
      .expect(201);

    expect(res.body.amount).toBe(250);
    expect(res.body.receipt_path).toMatch(/^\/uploads\/\d{13}-[0-9a-f]{8}\.png$/);
  });

  it('rejects a receipt that is not an image', async () => {
    const { token } = await loginAs();

    const res = await request(app)
      .post('/loans')
      .set(authHeader(token))
      .field('friend_name', 'Rahul')
      .field('amount', '250')
      .field('due_date', futureDate())
      .attach('receipt', Buffer.from('PK...'), { filename: 'notes.zip', contentType: 'application/zip' })
      .expect(415);

    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a blank friend name', async () => {
    const { token } = await loginAs();
    const res = await request(app)
      .post('/loans')
      .set(authHeader(token))
      .send({ friend_name: '   ', amount: 100, due_date: futureDate() })
      .expect(400);

    expect(res.body.error).toMatch(/friend_name/i);
  });

  it('rejects a zero, negative or non-numeric amount', async () => {
    const { token } = await loginAs();

    for (const amount of [0, -50, 'not-a-number']) {
      const res = await request(app)
        .post('/loans')
        .set(authHeader(token))
        .send({ friend_name: 'Priya', amount, due_date: futureDate() })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects a malformed or impossible due_date', async () => {
    const { token } = await loginAs();

    for (const due_date of ['15-01-2027', '2027-13-45', 'tomorrow']) {
      await request(app)
        .post('/loans')
        .set(authHeader(token))
        .send({ friend_name: 'Priya', amount: 100, due_date })
        .expect(400);
    }
  });

  it('rejects a note longer than the column allows', async () => {
    const { token } = await loginAs();
    await request(app)
      .post('/loans')
      .set(authHeader(token))
      .send({ friend_name: 'Priya', amount: 100, due_date: futureDate(), note: 'x'.repeat(281) })
      .expect(400);
  });

  it('requires authentication', async () => {
    await request(app)
      .post('/loans')
      .send({ friend_name: 'Priya', amount: 100, due_date: futureDate() })
      .expect(401);
  });
});

describe('GET /loans', () => {
  it('returns only the logged-in user\'s loans, most urgent first', async () => {
    const mine = await loginAs('9876543210');
    const theirs = await loginAs('1111111111');

    await addLoan(mine.token, { friend_name: 'Zoe', amount: '100', due_date: futureDate(60) });
    await addLoan(mine.token, { friend_name: 'Amy', amount: '100', due_date: futureDate(10) });
    await addLoan(theirs.token, { friend_name: 'Stranger', amount: '999', due_date: futureDate(5) });

    const res = await request(app).get('/loans').set(authHeader(mine.token)).expect(200);

    expect(res.body.loans.map((l: { friend_name: string }) => l.friend_name)).toEqual(['Amy', 'Zoe']);
  });

  it('puts repaid entries below the ones still outstanding', async () => {
    const { token } = await loginAs();
    const dueSoon = await addLoan(token, { friend_name: 'Due soon', amount: '10', due_date: futureDate(2) });
    const paid = await addLoan(token, { friend_name: 'Already paid', amount: '10', due_date: futureDate(1) });

    await request(app).post(`/loans/${paid.id}/repaid`).set(authHeader(token)).expect(200);

    const res = await request(app).get('/loans').set(authHeader(token)).expect(200);
    expect(res.body.loans.map((l: { id: number }) => l.id)).toEqual([dueSoon.id, paid.id]);
  });

  it('returns an empty list for a brand-new user', async () => {
    const { token } = await loginAs();
    const res = await request(app).get('/loans').set(authHeader(token)).expect(200);
    expect(res.body.loans).toEqual([]);
  });

  it('flags an unrepaid loan past its due date as overdue', async () => {
    const { token } = await loginAs();
    await addLoan(token, { friend_name: 'Old friend', amount: '900', due_date: '2020-01-01' });

    const res = await request(app).get('/loans').set(authHeader(token)).expect(200);
    expect(res.body.loans[0]).toMatchObject({ status: 'overdue', amount: 900 });
  });

  it('keeps a repaid loan out of the overdue bucket even with a past due date', async () => {
    const { token } = await loginAs();
    const loan = await addLoan(token, { friend_name: 'Settled', amount: '300', due_date: '2020-01-01' });

    await request(app).post(`/loans/${loan.id}/repaid`).set(authHeader(token)).expect(200);

    const res = await request(app).get('/loans').set(authHeader(token)).expect(200);
    expect(res.body.loans[0].status).toBe('repaid');
  });
});

describe('POST /loans/:id/repaid', () => {
  it('marks a loan repaid and keeps the timestamp stable on repeat calls', async () => {
    const { token } = await loginAs();
    const loan = await addLoan(token, { friend_name: 'Priya', amount: '1500', due_date: futureDate() });

    const first = await request(app).post(`/loans/${loan.id}/repaid`).set(authHeader(token)).expect(200);
    expect(first.body.status).toBe('repaid');
    expect(first.body.repaid_at).not.toBeNull();

    // Idempotent: a double-tap on the button must not move the repayment date.
    const second = await request(app).post(`/loans/${loan.id}/repaid`).set(authHeader(token)).expect(200);
    expect(second.body.repaid_at).toBe(first.body.repaid_at);
  });

  it('404s for an unknown id', async () => {
    const { token } = await loginAs();
    await request(app).post('/loans/999999/repaid').set(authHeader(token)).expect(404);
  });

  it('404s for a loan that belongs to another user', async () => {
    const owner = await loginAs('9876543210');
    const stranger = await loginAs('1111111111');
    const loan = await addLoan(owner.token, { friend_name: 'Priya', amount: '10', due_date: futureDate() });

    await request(app).post(`/loans/${loan.id}/repaid`).set(authHeader(stranger.token)).expect(404);

    // And the owner's loan is untouched.
    const res = await request(app).get('/loans').set(authHeader(owner.token)).expect(200);
    expect(res.body.loans[0].status).toBe('open');
  });
});

describe('GET /loans/summary', () => {
  it('totals lent, repaid and overdue in one response', async () => {
    const { token } = await loginAs();

    await addLoan(token, { friend_name: 'Open', amount: '1000', due_date: futureDate() });
    await addLoan(token, { friend_name: 'Late', amount: '500', due_date: '2020-01-01' });
    const settled = await addLoan(token, { friend_name: 'Settled', amount: '250', due_date: '2020-02-01' });
    await request(app).post(`/loans/${settled.id}/repaid`).set(authHeader(token)).expect(200);

    const res = await request(app).get('/loans/summary').set(authHeader(token)).expect(200);

    expect(res.body).toEqual({
      total_lent: 1750, // every entry, repaid or not
      total_repaid: 250,
      overdue_amount: 500, // the settled one is excluded despite its past due date
      entry_count: 3,
      overdue_count: 1,
    });
  });

  it('returns zeroes rather than nulls for a user with no entries', async () => {
    const { token } = await loginAs();
    const res = await request(app).get('/loans/summary').set(authHeader(token)).expect(200);
    expect(res.body).toEqual({
      total_lent: 0,
      total_repaid: 0,
      overdue_amount: 0,
      entry_count: 0,
      overdue_count: 0,
    });
  });
});
