// Seed the curated airport list (currently Italy) into the database — and
// nothing else. Idempotent; safe to run against prod:
//   DATABASE_URL=... DATABASE_AUTH_TOKEN=... node scripts/seed-airports.mjs
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { getDb, schema } = await import(path.join(root, 'db/client.js'))
const { AIRPORTS_ITALY } = await import(path.join(root, 'db/airports-data.mjs'))
const db = getDb()
await db.insert(schema.airports).values(AIRPORTS_ITALY).onConflictDoNothing()
console.log(`✓ airports seeded/confirmed: ${AIRPORTS_ITALY.length} (italy)`)
