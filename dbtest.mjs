import 'dotenv/config'
import { getDb, schema } from './db/client.js'
console.log('publicTrips export:', Boolean(schema.publicTrips))
const db = getDb()
const rows = await db.select().from(schema.publicTrips).limit(1)
console.log('query ok, rows:', rows.length)
