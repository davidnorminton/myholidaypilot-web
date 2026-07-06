CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
