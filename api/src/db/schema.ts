import { pgTable, uuid, text, doublePrecision, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const searches = pgTable('searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  query: text('query').notNull(),
  orderBy: text('order_by').notNull().default('most_relevance'),
  language: text('language').notNull().default('es_ES'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  distanceInKm: doublePrecision('distance_in_km'),
  minSalePrice: doublePrecision('min_sale_price'),
  maxSalePrice: doublePrecision('max_sale_price'),
  timeFilter: text('time_filter'),
  maxResults: integer('max_results').default(50),
  status: text('status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallapopId: text('wallapop_id').unique().notNull(),
  searchId: uuid('search_id').references(() => searches.id),
  title: text('title'),
  description: text('description'),
  url: text('url'),
  reserved: boolean('reserved').default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  wallapopCreatedAt: timestamp('wallapop_created_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const productPrices = pgTable('product_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  price: text('price').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  isLatest: boolean('is_latest').notNull().default(false),
})

export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
})

export const productLocations = pgTable('product_locations', {
  productId: uuid('product_id').primaryKey().references(() => products.id, { onDelete: 'cascade' }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  postalCode: text('postal_code'),
  city: text('city'),
  region: text('region'),
  region2: text('region2'),
  countryCode: text('country_code'),
})

export const productShipping = pgTable('product_shipping', {
  productId: uuid('product_id').primaryKey().references(() => products.id, { onDelete: 'cascade' }),
  itemIsShippable: boolean('item_is_shippable'),
  userAllowsShipping: boolean('user_allows_shipping'),
  costConfigurationId: text('cost_configuration_id'),
})
