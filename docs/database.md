# Database

MongoDB runs locally on port `27000` (mapped from the container's default `27017`).  
Database name: **`wallapop_tracker`**

There are two collections: `searches` and `products`.

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
