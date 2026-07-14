# Configuration

The worker is configured via environment variables. Copy `.env.example` to `.env` inside the `worker/` directory and edit the values before running.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27000/wallapop_tracker` | Full MongoDB connection string |
| `WALLAPOP_API_BASE_URL` | _(required)_ | Base URL for the Wallapop v3 API |
| `WALLAPOP_API_KEY` | _(optional)_ | Bearer token. Sent as `Authorization` header when set |
| `WALLAPOP_USER_AGENT` | `USER_AGENT` | `User-Agent` header value sent to the API |
| `POLL_INTERVAL_SECONDS` | `300` | How often the worker polls, in seconds (5 min default) |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error` |

---

## Search defaults

When a search document is missing a field, the worker falls back to these values (defined in `worker/src/defaults.ts`):

| Field | Default value | Notes |
|---|---|---|
| `order_by` | `most_relevance` | Also accepts `newest`, `closest` |
| `language` | `es_ES` | Wallapop locale string |
| `latitude` | `41.6213378` | Valladolid, Spain |
| `longitude` | `-4.7423786` | Valladolid, Spain |
| `distance_in_km` | `100` | Search radius |
| `pageSize` | `50` | Max results per poll (also the API page size) |

Change the code-level defaults in `worker/src/defaults.ts`, or override them per search by setting the fields in the `searches` document.

---

## Docker (MongoDB)

MongoDB is configured in `docker-compose.yml`:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27000:27017"          # host:container
    environment:
      MONGO_INITDB_DATABASE: wallapop_tracker
    volumes:
      - ./data/db:/data/db     # persistent local storage
```

Run with:

```bash
docker-compose up -d    # start in background
docker-compose down     # stop (data is preserved)
```

---

## Worker scripts

All scripts are run from inside the `worker/` directory.

| Command | What it does |
|---|---|
| `pnpm run dev` | Start the worker with hot-reload (development) |
| `pnpm start` | Start the compiled worker (production) |
| `pnpm run once` | Run one poll and exit |
| `pnpm run seed-search` | Insert a search into the database (see below) |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run typecheck` | Type-check without emitting files |

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

All arguments are optional except `keywords`. Unset arguments fall back to the defaults table above. The script refuses to insert a duplicate (same keywords + location + order).

---

## Pausing a search

Set `status: "inactive"` on a `searches` document. The worker will skip it on every poll until you remove or change the field.

```js
// MongoDB shell
db.searches.updateOne(
  { query: "Garmin Fenix 6" },
  { $set: { status: "inactive" } }
)
```
