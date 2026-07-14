# Database

PostgreSQL on [Neon](https://neon.tech). Connection string is configured via the `DB_URI` environment variable.

The schema is defined in `src/db/schema.ts` and managed with [Drizzle ORM](https://orm.drizzle.team).

---

## Tables

### `searches`

Each row describes one saved search. The worker reads this table on every poll.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `query` | TEXT | Keywords to search for |
| `order_by` | TEXT | `most_relevance` \| `newest` \| `closest` |
| `language` | TEXT | Wallapop locale (e.g. `es_ES`) |
| `latitude` | DOUBLE PRECISION | |
| `longitude` | DOUBLE PRECISION | |
| `distance_in_km` | DOUBLE PRECISION | Search radius |
| `min_sale_price` | DOUBLE PRECISION | Optional |
| `max_sale_price` | DOUBLE PRECISION | Optional |
| `time_filter` | TEXT | `today` \| `lastWeek` \| `lastMonth` |
| `max_results` | INTEGER | Max listings to fetch per poll (default 50) |
| `status` | TEXT | Set to `inactive` to pause this search |
| `created_at` | TIMESTAMPTZ | |

### `products`

One row per Wallapop listing. Keyed by `wallapop_id` — if two searches find the same listing it is stored once.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `wallapop_id` | TEXT UNIQUE | Wallapop's own listing ID |
| `search_id` | UUID FK → searches | The search that first found this listing |
| `title` | TEXT | |
| `description` | TEXT | |
| `url` | TEXT | Direct link to the listing |
| `reserved` | BOOLEAN | Seller has marked it reserved |
| `last_seen_at` | TIMESTAMPTZ | When the worker last observed this listing |
| `wallapop_created_at` | TIMESTAMPTZ | When the listing was created on Wallapop |
| `created_at` | TIMESTAMPTZ | When the tracker first recorded it |

### `product_prices`

Append-only price history. Only the row with `is_latest = true` is the current price.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → products CASCADE | |
| `price` | TEXT | e.g. `"314.99 EUR"` |
| `recorded_at` | TIMESTAMPTZ | When this price was observed |
| `is_latest` | BOOLEAN | `true` for the current price |

### `product_images`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → products CASCADE | |
| `url` | TEXT | |
| `position` | INTEGER | Order from the Wallapop listing |

### `product_locations`

One row per product (PK on `product_id`). Updated in place on each poll via `ON CONFLICT DO UPDATE`.

| Column | Type |
|---|---|
| `product_id` | UUID PK FK → products CASCADE |
| `latitude` | DOUBLE PRECISION |
| `longitude` | DOUBLE PRECISION |
| `postal_code` | TEXT |
| `city` | TEXT |
| `region` | TEXT |
| `region2` | TEXT |
| `country_code` | TEXT |

### `product_shipping`

One row per product (PK on `product_id`). Upserted on each poll.

| Column | Type |
|---|---|
| `product_id` | UUID PK FK → products CASCADE |
| `item_is_shippable` | BOOLEAN |
| `user_allows_shipping` | BOOLEAN |
| `cost_configuration_id` | TEXT |

---

## Price history logic

1. **First sighting** — a new `products` row is inserted inside a transaction together with the first `product_prices` row (`is_latest = true`).
2. **Same price** — only `last_seen_at` is updated. No new price row is created.
3. **Price changed** — inside a transaction, all existing price rows for that product are set to `is_latest = false`, then a new row is inserted with the new price and `is_latest = true`.

This gives a full, queryable audit trail of every price ever observed.

---

## Schema management

```bash
# Push current schema to the database (development / first setup)
pnpm run db:push

# Generate a SQL migration file (production-style workflow)
pnpm run db:generate

# Apply pending migrations
pnpm run db:migrate
```

---

## How to add a search

**Option 1 — CLI (recommended)**

```bash
pnpm run seed-search --keywords="Garmin Fenix 6" --max_sale_price=400
```

Accepts all fields as `--key=value` arguments. Skips the insert if a search with the same `query` + `order_by` already exists.

**Option 2 — SQL / Neon console**

```sql
INSERT INTO searches (query, order_by, language, latitude, longitude, distance_in_km, max_results)
VALUES ('Garmin Fenix 6', 'most_relevance', 'es_ES', 41.6213378, -4.7423786, 100, 50);
```

---

## Useful queries

Current price for a listing:
```sql
SELECT price FROM product_prices
WHERE product_id = '...' AND is_latest = true;
```

Listings with a price drop:
```sql
SELECT p.wallapop_id, p.title, pp.price
FROM products p
JOIN product_prices pp ON pp.product_id = p.id AND pp.is_latest = true
WHERE (SELECT COUNT(*) FROM product_prices WHERE product_id = p.id) > 1;
```

All listings for a specific search:
```sql
SELECT * FROM products WHERE search_id = '...';
```

---

## Pausing a search

```sql
UPDATE searches SET status = 'inactive' WHERE query = 'Garmin Fenix 6';
```

---

## Collection: `searches`

Each document describes one saved search. The worker reads this collection on every poll.

### Document schema

```js
{
  _id: ObjectId,          // MongoDB auto-generated ID

  // Search criteria
  query: String,          // Keywords to search for (e.g. "Garmin Fenix 6")
  order_by: String,       // "most_relevance" | "newest" | "closest"
  language: String,       // Locale string (e.g. "es_ES")

  // Location
  latitude: Number,       // Decimal degrees
  longitude: Number,      // Decimal degrees
  distance_in_km: Number, // Search radius

  // Price filters (optional)
  min_sale_price: Number,
  max_sale_price: Number,

  // Time filter (optional)
  time_filter: String,    // "today" | "lastWeek" | "lastMonth"

  // Pagination
  maxResults: Number,     // How many listings to fetch per poll (default: 50)

  // Control
  status: String,         // Set to "inactive" to pause this search

  createdAt: Date
}
```

### How to add a search

**Option 1 — CLI (recommended)**

```bash
cd worker
pnpm run seed-search --keywords="Garmin Fenix 6" --max_sale_price=400
```

Accepts all fields as `--key=value` arguments. Skips the insert if an identical search (same keywords + location + order) already exists.

**Option 2 — MongoDB playground**

Open `insert-search.mongodb.js` in VS Code with the MongoDB extension and run it directly against the database.

**Option 3 — mongo shell / Compass**

Insert a document manually into `wallapop_tracker.searches`.

---

## Collection: `products`

Each document represents one Wallapop listing. Products are shared across searches — if two searches find the same listing, it is stored once (keyed by `wallapopId`).

### Document schema

```js
{
  _id: ObjectId,               // MongoDB auto-generated ID
  wallapopId: String,          // Wallapop's own listing ID (unique key)
  WallapopTrackerId: ObjectId, // Reference to the `searches` document that first found this

  title: String,
  description: String,
  url: String,                 // Direct link to the listing
  images: [String],            // Array of image URLs

  // Price history (see below)
  prices: [
    {
      timestamp: Date,
      price: String,   // e.g. "314.99 EUR"
      latest: Boolean  // true for the most recent price, false for all older ones
    }
  ],

  // Extra metadata from the Wallapop response
  reserved: Boolean,           // Whether the seller has marked it reserved
  location: Object,            // { city, country_code, … }
  shipping: Object,            // Shipping options if available
  created_at: Date,            // When the listing was created on Wallapop

  lastSeenAt: Date             // When the worker last found this listing
}
```

### Price history logic

The worker tracks price changes without deleting old data.

1. **First sighting** — a new document is inserted with a single entry in `prices` where `latest: true`.
2. **Same price** — only `lastSeenAt` is updated. The `prices` array is not touched.
3. **Price changed** — all existing entries are set to `latest: false`, and a new entry with the current price is appended with `latest: true`.

This means `prices` is a full audit trail of every price the worker has ever observed for a listing.

### Useful queries

Get the current price for a listing:
```js
db.products.findOne({ wallapopId: "abc123" }).prices.find(p => p.latest)
```

Find listings that had a price drop:
```js
db.products.find({ "prices.1": { $exists: true } })
```
(Any product with more than one price entry has had at least one change.)

Find listings below a target price:
```js
db.products.find({
  prices: { $elemMatch: { latest: true, price: /^[0-9]+/ } }
})
```
> Prices are stored as strings (`"199.99 EUR"`). For numeric comparison, add a migration or filter in application code.

Find all listings for a specific search:
```js
db.products.find({ WallapopTrackerId: ObjectId("...") })
```

---

## Storage

Data is persisted in `./data/db/` on the host machine via a Docker volume mount. Stopping or removing the container does not delete your data.
