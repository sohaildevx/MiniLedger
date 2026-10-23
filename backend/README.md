# MiniLedger — API

Backend for **MiniLedger**, a small app that tracks money you've lent to friends.

Handles phone-number login with a mock OTP, creating and settling loans, and a
running summary of what's outstanding.

---

## Tech stack, and why

| Concern | Choice | Reasoning |
|---|---|---|
| Runtime | Node 22 + TypeScript (strict) | Required by the brief |
| HTTP | Express 4 | Boring and universally understood — nothing clever to defend |
| Database | PostgreSQL via **`pg` + plain SQL** | The whole app is four queries. An ORM would add a code-generation step and more magic than the SQL it hides. Every query lives in [`src/loans.ts`](src/loans.ts) and [`src/users.ts`](src/users.ts), so nothing SQL-shaped leaks into the routes |
| Validation | **zod** | One schema per request body gives runtime validation *and* the TypeScript type for free |
| Auth | phone → mock OTP → **JWT** (HS256) | Exactly as specified. The OTP is printed to the server log instead of being sent by SMS |
| Uploads | **multer** (disk storage) | Receipt photo upload, ~15 lines |
| Tests | **Vitest + Supertest** | Tests drive the real Express app over HTTP without binding a port |

There is deliberately **no** ORM, no state library, no DI container. Fewer moving
parts means fewer things to be asked about in an interview that you can't explain.

---

## Prerequisites

- Node.js 20 or newer
- A PostgreSQL database — **[Neon](https://neon.tech) free tier is the easiest** (no local install, ~2 minutes)

<details>
<summary><b>Alternative: run Postgres in Docker instead</b></summary>

```bash
docker run --name miniledger-pg \
  -e POSTGRES_USER=miniledger \
  -e POSTGRES_PASSWORD=miniledger \
  -e POSTGRES_DB=miniledger \
  -p 5432:5432 -d postgres:16

docker exec miniledger-pg psql -U miniledger -c "CREATE DATABASE miniledger_test;"
```

Then point both URLs at `localhost:5432` (no `sslmode` parameter needed).

</details>

<details>
<summary><b>Alternative: a local Postgres install</b></summary>

```bash
createuser miniledger --pwprompt
createdb miniledger -O miniledger
createdb miniledger_test -O miniledger
```

</details>

---

## Setup

### 1. Create the databases (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. In the Neon console SQL editor, run once:

   ```sql
   CREATE DATABASE miniledger_test;
   ```

   Two databases are needed because **the test suite truncates its tables between
   cases** — running tests against your real data would delete it.

### 2. Configure the environment

```bash
cd backend
cp .env.example .env
```

Open `.env` and paste your Neon connection string (Neon console → *Connection
string* → *Node.js / pg driver*) into both `DATABASE_URL` and
`TEST_DATABASE_URL`. **Keep the `?sslmode=require` suffix** — Neon terminates TLS
and node-pg will refuse the connection without it.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Primary database |
| `TEST_DATABASE_URL` | Separate database used only by tests |
| `JWT_SECRET` | Signs the tokens. Any string ≥ 8 chars for dev |
| `OTP_TTL_SECONDS` | How long a code stays valid (default 300 = 5 min) |
| `OTP_RESEND_SECONDS` | Minimum gap between two codes (default 60) |
| `DEFAULT_COUNTRY_CODE` | Applied when the user types a bare 10-digit number |
| `CORS_ORIGIN` | `*` in dev; a comma-separated list in production |
| `MAX_RECEIPT_BYTES` | Upload size cap (default 5 MB) |

### 3. Create the tables

```bash
npm run db:init
```

Idempotent — safe to re-run. It just applies [`sql/schema.sql`](sql/schema.sql).

### 4. Start the server

```bash
npm run dev
```

On boot it prints the URLs a phone can use:

```
🚀 MiniLedger API listening on http://0.0.0.0:4000
   Local:      http://localhost:4000/health
   On your phone (same Wi-Fi): http://172.20.244.28:4000
```

> ⚠️ **Use the LAN address on a physical phone.** `localhost` on a phone means
> the phone itself, not your laptop. The Android emulator should use
> `10.0.2.2` instead. Set `EXPO_PUBLIC_API_URL` in the app accordingly.

---

## API

All `/loans` routes require `Authorization: Bearer <token>`.

### `POST /auth/request-otp`

```jsonc
// request
{ "phone": "98765 43210" }

// 202 response — note the code is NOT returned
{ "phone": "+919876543210", "ttlSeconds": 300 }
```

The 6-digit code is printed to the server log:

```
🔐  [MiniLedger] OTP for +919876543210: 622467  (expires in 300s)
```

Phone numbers are normalised to E.164, so `98765 43210`, `09876543210` and
`+91 98765-43210` are all the same user.

| Status | When |
|---|---|
| `202` | Code issued |
| `400` | Malformed phone number or body |
| `429` | Second request inside `OTP_RESEND_SECONDS` |

### `POST /auth/verify-otp`

```jsonc
// request
{ "phone": "9876543210", "code": "622467" }

// 200 response
{ "token": "eyJhbGciOiJIUzI1NiIs...", "user": { "id": 1, "phone": "+919876543210" } }
```

The user row is created on first successful login and reused afterwards.

| Status | When |
|---|---|
| `400` | Code isn't six digits |
| `401` | Wrong, expired, already-used, or past the 5-attempt limit |

### `GET /loans`

```jsonc
{
  "loans": [
    {
      "id": 3,
      "friend_name": "Priya",
      "amount": 1500,
      "due_date": "2026-11-15",
      "note": "movie tickets",
      "receipt_path": "/uploads/1761267722913-a3f19c2b.png",
      "repaid_at": null,
      "created_at": "2026-10-23T17:22:03.412Z",
      "status": "open"
    }
  ]
}
```

`status` is derived in SQL: `repaid` if `repaid_at` is set, else `overdue` if
`due_date` has passed, else `open`. Outstanding entries sort first, most urgent
at the top.

### `GET /loans/summary`

```jsonc
{
  "total_lent": 1750,
  "total_repaid": 250,
  "overdue_amount": 500,
  "entry_count": 3,
  "overdue_count": 1
}
```

Computed in a **single** query using `SUM(...) FILTER (WHERE ...)`. Returns
zeros, never `nulls`, for a user with no entries.

### `POST /loans`

Accepts both `application/json` and `multipart/form-data` (the latter when a
receipt photo is attached under the field name `receipt`).

```bash
curl -X POST http://localhost:4000/loans \
  -H "Authorization: Bearer $TOKEN" \
  -F friend_name="Priya" \
  -F amount=1500 \
  -F due_date=2026-11-15 \
  -F note="movie tickets" \
  -F receipt=@receipt.jpg
```

| Status | When |
|---|---|
| `201` | Created — returns the full loan |
| `400` | Validation failed (see below) |
| `401` | Missing or invalid token |
| `413` | Receipt larger than `MAX_RECEIPT_BYTES` |
| `415` | Receipt isn't PNG / JPEG / WebP |

Validation rules: `friend_name` trimmed, 2–80 chars; `amount` > 0; `due_date`
a real `YYYY-MM-DD` date (past dates allowed — you may be logging a loan you
made last month); `note` ≤ 280 chars.

Uploaded files land in `uploads/` and are served statically at `/uploads/...`.
The API returns a **relative** path so the mobile app can prepend whichever base
URL applies to its current network.

### `POST /loans/:id/repaid`

Marks an entry settled and returns it. Idempotent — a double-tap keeps the
original `repaid_at` instead of silently moving the repayment date.

`404` for an unknown id **or** for a loan owned by a different user.

### Errors

Every failure returns the same shape:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

---

## Tests

```bash
npm test          # run once
npm run test:watch
```

**33 tests** across [`tests/auth.test.ts`](tests/auth.test.ts) and
[`tests/loans.test.ts`](tests/loans.test.ts), driving the real Express app over
HTTP via Supertest. They cover phone normalisation, OTP rate-limiting and
lockout, JWT rejection (including a token forged with the wrong key), every
validation branch, receipt upload and rejection, cross-user isolation, the
overdue-vs-repaid distinction, summary arithmetic, and idempotent repayment.

Tests truncate their tables between cases and therefore **require
`TEST_DATABASE_URL` to point at a throwaway database**.

---

## Design decisions worth defending

**The OTP lives in a `Map`, not the database.** The brief asks for a *mock* OTP.
A `Map` with a TTL is the honest minimal implementation, and it keeps codes out
of durable storage entirely. The trade-off: it resets on restart and won't work
across multiple server instances. Production would move this to Redis and swap
the `console.log` for an SMS provider call.

**`crypto.randomInt`, not `Math.random`.** The latter is a seeded PRNG — an
attacker who sees a few codes can predict the next one.

**Attempts are counted before comparison.** If the counter only incremented on
success, an attacker could brute-force all 1,000,000 codes. Five failures
invalidate the code outright.

**Money is `NUMERIC(12,2)`, never `float8`.** Binary floating point cannot
represent `0.1` exactly, so float arithmetic yields values like
`0.30000000000000004`. Amounts are cast to a number only at the JSON boundary.

**`due_date` is returned via `to_char(..., 'YYYY-MM-DD')`.** node-pg parses a
Postgres `DATE` into a JS `Date` at *local* midnight, which silently shifts by a
day across timezones. A plain string cannot drift.

**Repaid marking uses `COALESCE(repaid_at, now())`.** Makes it idempotent, so a
double-tap can't rewrite history.

**Loan ownership is enforced in the `WHERE` clause**, not by an `if` after the
query — `UPDATE ... WHERE id = $1 AND user_id = $2` returns no row for someone
else's loan, which becomes a 404.

**One query for the summary.** `SUM(...) FILTER (WHERE ...)` gives three totals
plus two counts in a single round-trip.

### Known limitation

Overdue is computed with Postgres `CURRENT_DATE`, which uses the **database
session's** timezone — UTC on Neon. Between local midnight and 05:30 IST, a loan
due "today" won't yet be flagged overdue. The clean fix is to store the user's
timezone on `users` and compare against `now() AT TIME ZONE $tz`; the trade-off
is that the client, not the server, would then have to supply a trustworthy
value.

---

## Project layout

```
backend/
├── sql/schema.sql          # tables + index
├── scripts/migrate.ts      # npm run db:init
├── src/
│   ├── index.ts            # boots the server, prints LAN URLs
│   ├── app.ts              # express app factory (no .listen, so tests can use it)
│   ├── config.ts           # env vars validated once at startup
│   ├── db.ts               # pg pool + query helpers
│   ├── loans.ts            # ALL loan SQL lives here
│   ├── users.ts            # ALL user SQL lives here
│   ├── otp.ts              # mock OTP store
│   ├── phone.ts            # E.164 normalisation
│   ├── validation.ts       # zod schemas
│   ├── uploads.ts          # multer config for receipt photos
│   ├── errors.ts           # HttpError
│   ├── http.ts             # asyncHandler + parseBody
│   ├── middleware/
│   │   ├── auth.ts         # JWT sign + verify
│   │   └── error.ts        # terminal error + 404 handlers
│   └── routes/
│       ├── auth.ts         # /auth/request-otp, /auth/verify-otp
│       └── loans.ts        # /loans CRUD + summary
└── tests/
    ├── setup.ts            # applies schema, truncates between cases
    ├── helpers.ts          # loginAs(), addLoan(), fakeReceipt()
    ├── auth.test.ts
    └── loans.test.ts
```

---

## Running the whole project

```bash
# terminal 1 — API
cd backend && npm run dev

# terminal 2 — app (added next)
cd app && npx expo start
```
