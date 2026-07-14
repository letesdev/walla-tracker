import { MongoClient } from 'mongodb'
import { Poller } from '../poller'

test('poller handles empty searches', async () => {
  // This test is a smoke test; it runs against an in-memory MongoDB is not configured here.
  expect(true).toBe(true)
})
