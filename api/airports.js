import { getDb, schema, eq, asc } from './_lib/db.js'
import { send, fail, handler } from './_lib/util.js'
const { airports } = schema

// Public list of airports for a country, for the trip planner's
// arrive/depart picker.
export default handler(async (req, res) => {
  if (req.method !== 'GET') throw fail(405, 'Method not allowed')
  const url = new URL(req.url, 'http://x')
  const country = url.searchParams.get('country') || 'italy'
  const db = getDb()
  const rows = await db.select().from(airports)
    .where(eq(airports.countryId, country)).orderBy(asc(airports.city), asc(airports.name))
  send(res, 200, rows)
})
