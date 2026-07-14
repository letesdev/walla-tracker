import dotenv from 'dotenv'
dotenv.config()

import pino from 'pino'
import { db } from './db'
import { Poller } from './poller'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

async function main() {
  log.info('Connected to PostgreSQL (Neon)')

  const pollInterval = Number(process.env.POLL_INTERVAL_SECONDS || '300')
  const poller = new Poller(db, { intervalSeconds: pollInterval })
  await poller.start()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
