import 'dotenv/config'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { getDb } from './client.js'

await migrate(getDb(), { migrationsFolder: './db/migrations' })
console.log('✓ migrations applied to', process.env.DATABASE_URL || 'file:./local.db')
process.exit(0)
