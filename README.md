# Wallapop Tracker

Self-hosted tool that watches Wallapop listings and tracks price changes over time.

---

## Monorepo structure

```
wallapop-tracker/
  api/        Node.js background worker + PostgreSQL schema (Neon + Drizzle)
  app/        Web frontend (coming soon)
```

Each package is independent. Navigate into the package you want to work on.

---

## api — Background worker

Polls the Wallapop API on a schedule, persists listings to a PostgreSQL database on Neon, and tracks price changes over time.

```bash
cd api
cp .env.example .env    # set DB_URI and WALLAPOP_API_BASE_URL
pnpm install
pnpm run db:push        # create tables on first run
pnpm run seed-search --keywords="Garmin Fenix 6"
pnpm run dev            # continuous polling
# or
pnpm run once           # single poll then exit
```

Full docs: [`api/docs/`](api/docs/README.md)

---

## app — Frontend

A Next.js full-stack dashboard. Server Components read the shared Drizzle schema directly; the background poller remains independent.

```bash
cd app
cp .env.example .env.local
pnpm install
pnpm dev
```
