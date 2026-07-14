import dotenv from 'dotenv'
dotenv.config()

import pino from 'pino'
import { db } from './db'
import { Poller } from './poller'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

async function main() {
  log.info('Connected to PostgreSQL (Neon)')

  const poller = new Poller(db, { intervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS || 300) })
  await poller.runOnce()

  log.info('One-shot poll completed')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
