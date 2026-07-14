import dotenv from 'dotenv'
dotenv.config()

import { MongoClient } from 'mongodb'
import pino from 'pino'
import { Poller } from './poller'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27000/wallapop_tracker'
  const client = new MongoClient(mongoUri)
  await client.connect()
  log.info({ mongoUri }, 'Connected to MongoDB')

  const db = client.db()

  const pollInterval = Number(process.env.POLL_INTERVAL_SECONDS || '300')

  const poller = new Poller(db, { intervalSeconds: pollInterval })
  await poller.start()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
