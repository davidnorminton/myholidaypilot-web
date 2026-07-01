import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema.js'

// Local (Mac):   DATABASE_URL=file:./local.db        (a plain SQLite file, nothing to install)
// Vercel/Turso:  DATABASE_URL=libsql://<db>.turso.io  + DATABASE_AUTH_TOKEN=<token>
// Postgres swap: replace these three lines with drizzle-orm/neon-http; the schema + queries are unchanged.
const url = process.env.DATABASE_URL || 'file:./local.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

let _db
export function getDb() {
  if (!_db) {
    const client = createClient(authToken ? { url, authToken } : { url })
    _db = drizzle(client, { schema })
  }
  return _db
}

export { schema }
