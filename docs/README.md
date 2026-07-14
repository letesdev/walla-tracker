# Wallapop Tracker — Documentation

Wallapop Tracker is a self-hosted background worker that watches Wallapop listings for you.

You define a set of searches (keywords, location, price range…). The worker hits the Wallapop API on a schedule, stores every matching product in MongoDB, and tracks price changes over time.

## Why does this exist?

Wallapop has no built-in price alerts or history. This project fills that gap. You point it at anything you are hunting for — a camera, a watch, a guitar — and it builds a local database you can query however you want.

## Docs index

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Components, data flow, tech stack |
| [Database](./database.md) | Collections, document schemas, price history logic |
| [Configuration](./configuration.md) | Environment variables, defaults, how to add a search |

## Quick start

```bash
# 1. Start MongoDB
docker-compose up -d

# 2. Install worker dependencies
cd worker
pnpm install
cp .env.example .env   # then edit .env

# 3. Seed your first search
pnpm run seed-search --keywords="Garmin Fenix 6"

# 4. Run the worker (continuous polling)
pnpm run dev

# Or run a single poll and exit
pnpm run once
```

See [Configuration](./configuration.md) for all available options.
