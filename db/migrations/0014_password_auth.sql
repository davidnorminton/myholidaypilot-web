ALTER TABLE users ADD COLUMN password_hash TEXT;
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
