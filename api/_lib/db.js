// Shared DB handle for all serverless functions. Re-exports the same libSQL
// client the CLI scripts use, plus the drizzle operators the routes need.
export { getDb, schema } from '../../db/client.js'
export { eq, and, or, desc, asc, sql, isNull } from 'drizzle-orm'
