import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DB_URI
if (!connectionString) throw new Error('DB_URI environment variable is not set')

// `prepare: false` is required when Neon runs behind PgBouncer in transaction mode
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
export type Db = typeof db
