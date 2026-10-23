# MiniLedger

A small app for tracking money you've lent to friends. Log who owes you what,
when it's due, and see at a glance what's overdue.

Built for the take-home brief: phone-number login with a mock OTP, loan entries
with a due date, one-tap repayment, a running summary, and an optional receipt
photo.

```
┌─────────────┐   HTTP/JSON    ┌──────────────────┐      ┌────────────┐
│  Expo app   │ ─────────────► │  Express API     │ ───► │ PostgreSQL │
│  (RN, TS)   │ ◄───────────── │  (Node, TS)      │      │  (Neon)    │
└─────────────┘                └──────────────────┘      └────────────┘
  src/app/*.tsx                   src/routes/*.ts           sql/schema.sql
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | Node 22, TypeScript, **Express 4** | Boring on purpose — nothing clever to defend |
| Database | **PostgreSQL** via `pg` + plain SQL | Four queries in the whole app; an ORM would hide more than it saves |
| Validation | **zod** | One schema per payload gives runtime checks *and* TypeScript types |
| Auth | phone → mock OTP → **JWT** | Exactly as briefed. The OTP is printed to the API log |
| Uploads | **multer** | Receipt photos, on local disk |
| App | **Expo SDK 58** (React Native 0.88), Expo Router | `npx expo start` + a QR code; runs on a real phone via Expo Go with no Xcode or Android Studio |
| Tests | **Vitest + Supertest** (API) | 33 cases driving the real Express app over HTTP |

Full reasoning, including what was deliberately *not* used, lives in
[`backend/README.md`](backend/README.md) and [`app/README.md`](app/README.md).

---

## Quick start

You need Node 20+ and a PostgreSQL database. **Neon's free tier is the
simplest** — about two minutes, no local install.

### 1. Database

Create a Neon project, then in its SQL editor run once:

```sql
CREATE DATABASE miniledger_test;
```

Two databases because the test suite truncates its tables between cases.

### 2. API

```bash
cd backend
npm install
cp .env.example .env      # paste your Neon connection string into both URLs
npm run db:init           # applies sql/schema.sql
npm run dev               # http://0.0.0.0:4000
```

On startup it prints the URL your phone should use — **not** `localhost`.

Verify it:

```bash
curl http://localhost:4000/health
npm test                  # 33 tests
```

### 3. App

```bash
cd app
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL to the LAN IP above
npx expo start
```

Scan the QR code with **Expo Go**, or press `w` to run it in a browser.

> ⚠️ **On a physical phone, `EXPO_PUBLIC_API_URL` must be your computer's LAN
> IP**, not `localhost` — on a phone, `localhost` means the phone itself. This
> is the single most common reason the app appears to do nothing.

### 4. Sign in

Enter any 10-digit number. The **6-digit OTP is printed in the API terminal**:

```
🔐  [MiniLedger] OTP for +919876543210: 622467  (expires in 300s)
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/request-otp` | Issue a code (printed to the log) |
| `POST` | `/auth/verify-otp` | Swap code for a JWT |
| `GET` | `/loans` | List, with a derived `status` |
| `GET` | `/loans/summary` | `{ total_lent, total_repaid, overdue_amount }` |
| `POST` | `/loans` | Create — JSON or multipart with a `receipt` photo |
| `POST` | `/loans/:id/repaid` | Mark settled (idempotent) |

`status` is computed in SQL: `repaid` if `repaid_at` is set, else `overdue` if
`due_date` has passed, else `open`. Every `/loans` route requires
`Authorization: Bearer <token>`.

Response errors are always `{ "error": "...", "code": "SNAKE_CASE" }`.

---

## Project structure

```
miniledger/
├── backend/              Express API
│   ├── sql/schema.sql
│   ├── scripts/migrate.ts
│   ├── src/
│   │   ├── routes/       auth.ts, loans.ts
│   │   ├── middleware/   auth.ts (JWT), error.ts
│   │   ├── loans.ts      all loan SQL
│   │   ├── users.ts      all user SQL
│   │   ├── otp.ts        mock OTP store
│   │   └── ...
│   └── tests/            33 cases
├── app/                  Expo app
│   └── src/
│       ├── app/          index, login, home, add
│       ├── components/   SummaryCard, LoanItem, Field, PrimaryButton
│       └── lib/          api, auth, format, types
└── README.md
```

---

## Testing

```bash
cd backend && npm test
```

Covers phone normalisation, OTP rate-limiting and lockout, JWT rejection
(including a token forged with the wrong key), every validation branch,
receipt upload and rejection, cross-user isolation, the overdue-vs-repaid
distinction, summary arithmetic, and idempotent repayment.

**Not yet covered:** the React Native app has no automated tests. It is
verified by typecheck, lint, and full production bundles for both web and
Android (Hermes bytecode) — see below.

---

## What's been verified

| Check | Result |
|---|---|
| `backend`: `tsc --noEmit` | ✅ clean |
| `backend`: `tsc -p tsconfig.build.json` | ✅ clean |
| `backend`: `npm audit` | ✅ 0 vulnerabilities |
| `backend`: live API smoke test | ✅ health, OTP issue + log, normalisation, 400/401/404/429 paths |
| `backend`: `npm test` | ⏳ needs a live database — run after pasting your Neon URL |
| `app`: `tsc --noEmit` | ✅ clean |
| `app`: `expo lint` | ✅ clean |
| `app`: `expo export --platform web` | ✅ all 5 routes bundled |
| `app`: `expo export --platform android` | ✅ Hermes bytecode built |

---

## Known limitations

- **Mock OTP.** Codes live in an in-memory `Map` and are logged, not sent.
  They reset on restart and won't work across multiple server instances;
  production would move this to Redis and swap the `console.log` for an SMS
  provider call.
- **Overdue uses `CURRENT_DATE`**, which is UTC on Neon. Between local midnight
  and 05:30 IST a loan due "today" won't yet flag as overdue. The fix is to
  store the user's timezone and compare against `now() AT TIME ZONE $tz`.
- **Receipts are on local disk.** Fine for a demo; production would use S3 or
  R2 and store the resulting URL.
- **App is light-mode only.** A deliberate scope decision — dark mode would
  double every colour decision for a demo that doesn't need it.

---

## Demo recording checklist

Suggested 2–3 minute script:

1. **API terminal showing the OTP printed** — this is an explicit brief
   requirement, so show it.
2. Login screen → phone → paste the OTP → land on the list.
3. **Summary card** at the top: lent / repaid / overdue.
4. Add an entry **with a receipt photo** (the bonus).
5. Point at an **overdue entry** — red wash, red left edge, `OVERDUE` badge.
6. **Mark it repaid** → watch the summary numbers move.

Before you hit record, send one request to the API so Neon's compute is awake —
it autosuspends after ~5 minutes idle, and the first request then takes a few
seconds.

Record with QuickTime (macOS) or Xbox Game Bar / phone screen recorder
(Windows), upload to Google Drive, and set sharing to *anyone with the link*.
