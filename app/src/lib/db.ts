import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../../api/src/db/schema'

const connectionString = process.env.DB_URI

export const db = connectionString
  ? drizzle(postgres(connectionString, { prepare: false }), { schema })
  : null
