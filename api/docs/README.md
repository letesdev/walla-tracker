# Wallapop Tracker — Documentation

Wallapop Tracker is a self-hosted background worker that watches Wallapop listings for you.

You define a set of searches (keywords, location, price range…). The worker hits the Wallapop API on a schedule, stores every matching product in a PostgreSQL database on Neon, and tracks price changes over time.

## Why does this exist?

Wallapop has no built-in price alerts or history. This project fills that gap. You point it at anything you are hunting for — a camera, a watch, a guitar — and it builds a queryable database you can query however you want.

## Docs index

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Components, data flow, tech stack |
| [Database](./database.md) | Tables, schema, price history logic |
| [Configuration](./configuration.md) | Environment variables, defaults, how to add a search |

## Quick start

```bash
# 1. Install dependencies (run from api/)
cd api
pnpm install

# 2. Configure environment
cp .env.example .env   # then set DB_URI to your Neon connection string

# 3. Push schema to Neon (creates tables on first run)
pnpm run db:push

# 4. Seed your first search
pnpm run seed-search --keywords="Garmin Fenix 6"

# 5. Run the worker (continuous polling)
pnpm run dev

# Or run a single poll and exit
pnpm run once
```

See [Configuration](./configuration.md) for all available options.
