-- MiniLedger schema.
-- Money is NUMERIC(12,2), never a float: binary floating point cannot represent
-- 0.1 exactly, so float arithmetic produces values like 0.30000000000000004.

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,          -- stored in E.164, e.g. "+919876543210"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loans (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date     DATE NOT NULL,
  note         TEXT,
  receipt_path TEXT,                         -- e.g. "/uploads/1735...-ab12cd.png"
  repaid_at    TIMESTAMPTZ,                  -- NULL means "still owes me"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT loans_friend_name_not_blank CHECK (btrim(friend_name) <> '')
);

-- Every query in the app filters by owner, so index it.
CREATE INDEX IF NOT EXISTS loans_user_id_idx ON loans (user_id);
