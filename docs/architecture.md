# Architecture

## Overview

The system is made of two things: a MongoDB database and a Node.js worker.

```
┌─────────────────────────────────────────────┐
│                Docker host                  │
│                                             │
│  ┌──────────────────┐   ┌────────────────┐  │
│  │   MongoDB :27000 │◄──│  Worker (Node) │  │
│  └──────────────────┘   └───────┬────────┘  │
│                                 │           │
└─────────────────────────────────┼───────────┘
                                  │ HTTPS
                              Wallapop API
```

The worker is the only moving part. It reads search configs from the database, calls the Wallapop API, and writes the results back.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20 + TypeScript | Typed, fast to iterate |
| Package manager | pnpm | Efficient installs |
| Database | MongoDB 7 (Docker) | Flexible schema, easy to query |
| MongoDB driver | `mongodb` v7 (official) | No ODM overhead |
| Logging | `pino` | Structured JSON logs |
| Dev runner | `ts-node-dev` | Hot-reload during development |

---

## Components

### `Poller`

The core class (`worker/src/poller.ts`). It drives everything.

- On startup it runs one poll immediately, then repeats on a timer.
- Each tick it reads every document from the `searches` collection.
- It skips searches marked `status: "inactive"`.
- For each active search it calls `WallapopClient.fetchSearchResults()` and passes the results to `handleProductsForSearch()`.

### `WallapopClient`

A thin HTTP client (`worker/src/wallapop-client.ts`).

- Wraps the Wallapop v3 REST API.
- Handles pagination automatically via the `meta.next_page` token.
- Collects results until it reaches the requested `limit`.
- Supports optional filters: price range, location, distance, time window.

### Entry points

| Script | What it does |
|---|---|
| `src/index.ts` | Starts the poller on a repeating interval (long-running process) |
| `src/once.ts` | Runs exactly one poll then exits (useful for cron jobs) |
| `src/scripts/seed-search.ts` | CLI helper to insert a search document into MongoDB |

---

## Data flow (single poll cycle)

```
Poller.pollOnce()
  │
  ├─ Read all documents from `searches`
  │
  └─ For each active search:
       │
       ├─ WallapopClient.fetchSearchResults(keywords, limit, filters)
       │    └─ GET /api/v3/search  (one or more paginated requests)
       │
       └─ handleProductsForSearch(search, products)
            ├─ New product  → insert into `products`
            └─ Known product → update title/description/price/lastSeenAt
```

---

## Deployment modes

**Continuous worker** (`pnpm run dev` / `pnpm start`)

The process stays alive. Polls every `POLL_INTERVAL_SECONDS` (default: 300 s).

**One-shot** (`pnpm run once`)

Polls once and exits. Pair with a system cron or a scheduled container restart for serverless-style deployments.
