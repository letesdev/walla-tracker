# Configuration

The worker is configured via environment variables. Copy `.env.example` to `.env` and edit the values before running.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DB_URI` | _(required)_ | Neon PostgreSQL connection string |
| `WALLAPOP_API_BASE_URL` | _(required)_ | Base URL for the Wallapop v3 API |
| `WALLAPOP_API_KEY` | _(optional)_ | Bearer token. Sent as `Authorization` header when set |
| `WALLAPOP_USER_AGENT` | `USER_AGENT` | `User-Agent` header value sent to the API |
| `POLL_INTERVAL_SECONDS` | `300` | How often the worker polls, in seconds (5 min default) |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error` |

`DB_URI` must be a valid Neon connection string. You can find it in the Neon console under **Connection Details**. Use the **pooled** connection string for the worker.

---

## Search defaults

When a search row is missing a field, the worker falls back to these values (defined in `src/defaults.ts`):

| Field | Default value | Notes |
|---|---|---|
| `order_by` | `most_relevance` | Also accepts `newest`, `closest` |
| `language` | `es_ES` | Wallapop locale string |
| `latitude` | `41.6213378` | Valladolid, Spain |
| `longitude` | `-4.7423786` | Valladolid, Spain |
| `distance_in_km` | `100` | Search radius |
| `pageSize` | `50` | Max results per poll (also the API page size) |

Change the code-level defaults in `src/defaults.ts`, or override them per search via the `searches` table.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | Start the worker with hot-reload (development) |
| `pnpm start` | Start the compiled worker (production) |
| `pnpm run once` | Run one poll and exit |
| `pnpm run seed-search` | Insert a search row into the database |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run typecheck` | Type-check without emitting files |
| `pnpm run db:push` | Push current schema to Neon (development / first setup) |
| `pnpm run db:generate` | Generate a SQL migration file |
| `pnpm run db:migrate` | Apply pending migrations |

### `seed-search` arguments

```bash
pnpm run seed-search \
  --keywords="Garmin Fenix 6" \
  --order_by=newest \
  --max_sale_price=400 \
  --distance_in_km=50 \
  --time_filter=lastWeek \
  --maxResults=100
```

All arguments are optional except `keywords`. Unset arguments fall back to the defaults table above. The script refuses to insert a duplicate (same `query` + `order_by`).

---

## Pausing a search

```sql
UPDATE searches SET status = 'inactive' WHERE query = 'Garmin Fenix 6';
```

The worker skips any row with `status = 'inactive'` on every poll.
