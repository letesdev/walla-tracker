import pino from 'pino'
import { eq, and } from 'drizzle-orm'
import { WallapopClient } from './wallapop-client'
import { WALLAPOP_DEFAULTS } from './defaults'
import type { Db } from './db'
import {
    searches,
    products,
    productPrices,
    productImages,
    productLocations,
    productShipping,
} from './db/schema'

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

export type PollerOptions = {
    intervalSeconds: number
}

export class Poller {
    private db: Db
    private opts: PollerOptions
    private timer: NodeJS.Timeout | null = null
    private client: WallapopClient

    constructor(db: Db, opts: PollerOptions) {
        this.db = db
        this.opts = opts
        this.client = new WallapopClient(process.env.WALLAPOP_API_BASE_URL || '', process.env.WALLAPOP_API_KEY)
    }

    async start() {
        log.info({ interval: this.opts.intervalSeconds }, 'Starting poller')
        await this.pollOnce()
        this.timer = setInterval(() => this.pollOnce().catch((err) => log.error(err)), this.opts.intervalSeconds * 1000)
    }

    async stop() {
        if (this.timer) clearInterval(this.timer)
        log.info('Poller stopped')
    }

    /**
     * Perform a single poll of all searches. Public so it can be used by one-shot runners.
     */
    async pollOnce() {
        log.info('Polling searches...')
        const allSearches = await this.db.select().from(searches)

        for (const s of allSearches) {
            if (s.status === 'inactive') continue

            try {
                const keywords = s.query
                if (!keywords || keywords.trim() === '') {
                    log.warn({ searchId: s.id }, 'Skipping search with no keywords')
                    continue
                }

                const defaults = WALLAPOP_DEFAULTS
                const normalized = {
                    order_by: s.orderBy || defaults.order_by,
                    language: s.language || defaults.language,
                    latitude: s.latitude ?? defaults.latitude,
                    longitude: s.longitude ?? defaults.longitude,
                    min_sale_price: s.minSalePrice ?? undefined,
                    max_sale_price: s.maxSalePrice ?? undefined,
                    distance_in_km: s.distanceInKm ?? defaults.distance_in_km,
                    time_filter: (s.timeFilter as any) || undefined,
                }
                const limit = typeof s.maxResults === 'number' && s.maxResults > 0
                    ? s.maxResults
                    : WALLAPOP_DEFAULTS.pageSize

                log.info({ searchId: s.id, query: keywords }, 'Fetching search')
                const listings = await this.client.fetchSearchResults(keywords, limit, normalized)
                await this.handleProductsForSearch(s, listings)
            } catch (err) {
                log.error({ err, searchId: s.id }, 'Error polling search')
            }
        }
    }

    /** Convenience wrapper for one-shot runs. */
    async runOnce() {
        await this.pollOnce()
        await this.stop()
    }

    /**
     * Persist fetched products for a single search.
     *
     * Behaviour:
     * - New product → insert into `products` + related tables in a transaction.
     * - Known product → update changed fields; manage price history in a
     *   transaction (mark previous latest as false, append new row).
     * - `last_seen_at` is always refreshed.
     *
     * Tables touched: products, product_prices, product_images,
     *                 product_locations, product_shipping.
     */
    private async handleProductsForSearch(search: typeof searches.$inferSelect, listings: any[]) {
        for (const p of listings) {
            const now = new Date()

            let priceStr = ''
            if (p.raw?.price && typeof p.raw.price === 'object') {
                priceStr = `${p.raw.price.amount} ${p.raw.price.currency}`
            } else if (typeof p.price !== 'undefined') {
                priceStr = String(p.price)
            }

            const [existing] = await this.db
                .select()
                .from(products)
                .where(eq(products.wallapopId, p.id))
                .limit(1)

            if (!existing) {
                await this.db.transaction(async (tx) => {
                    const [newProduct] = await tx
                        .insert(products)
                        .values({
                            wallapopId: p.id,
                            searchId: search.id,
                            title: p.title,
                            description: p.description,
                            url: p.url,
                            reserved: p.raw?.reserved?.flag ?? false,
                            lastSeenAt: now,
                            wallapopCreatedAt: p.raw?.created_at
                                ? new Date(Number(p.raw.created_at))
                                : undefined,
                        })
                        .returning()

                    await tx.insert(productPrices).values({
                        productId: newProduct.id,
                        price: priceStr,
                        recordedAt: now,
                        isLatest: true,
                    })

                    if (p.images && p.images.length > 0) {
                        await tx.insert(productImages).values(
                            p.images.map((url: string, i: number) => ({
                                productId: newProduct.id,
                                url,
                                position: i,
                            }))
                        )
                    }

                    if (p.raw?.location) {
                        const loc = p.raw.location
                        await tx.insert(productLocations).values({
                            productId: newProduct.id,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            postalCode: loc.postal_code,
                            city: loc.city,
                            region: loc.region,
                            region2: loc.region2,
                            countryCode: loc.country_code,
                        })
                    }

                    if (p.raw?.shipping) {
                        const ship = p.raw.shipping
                        await tx.insert(productShipping).values({
                            productId: newProduct.id,
                            itemIsShippable: ship.item_is_shippable,
                            userAllowsShipping: ship.user_allows_shipping,
                            costConfigurationId: ship.cost_configuration_id,
                        })
                    }
                })

                log.info({ wallapopId: p.id }, 'Inserted new product')
            } else {
                const updateFields: Record<string, any> = { lastSeenAt: now }
                let changed = false

                if (existing.title !== p.title) {
                    updateFields.title = p.title
                    changed = true
                }
                if (existing.description !== p.description) {
                    updateFields.description = p.description
                    changed = true
                }

                const reservedFlag = p.raw?.reserved?.flag ?? (existing.reserved ?? false)
                if (existing.reserved !== reservedFlag) {
                    updateFields.reserved = reservedFlag
                    changed = true
                }

                // Price history: append a new row only when the price changed
                const [latestPrice] = await this.db
                    .select()
                    .from(productPrices)
                    .where(and(eq(productPrices.productId, existing.id), eq(productPrices.isLatest, true)))
                    .limit(1)

                if (!latestPrice || latestPrice.price !== priceStr) {
                    await this.db.transaction(async (tx) => {
                        await tx
                            .update(productPrices)
                            .set({ isLatest: false })
                            .where(eq(productPrices.productId, existing.id))
                        await tx.insert(productPrices).values({
                            productId: existing.id,
                            price: priceStr,
                            recordedAt: now,
                            isLatest: true,
                        })
                    })
                    changed = true
                }

                await this.db
                    .update(products)
                    .set(updateFields)
                    .where(eq(products.id, existing.id))

                // Upsert location
                if (p.raw?.location) {
                    const loc = p.raw.location
                    await this.db
                        .insert(productLocations)
                        .values({
                            productId: existing.id,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            postalCode: loc.postal_code,
                            city: loc.city,
                            region: loc.region,
                            region2: loc.region2,
                            countryCode: loc.country_code,
                        })
                        .onConflictDoUpdate({
                            target: productLocations.productId,
                            set: {
                                latitude: loc.latitude,
                                longitude: loc.longitude,
                                postalCode: loc.postal_code,
                                city: loc.city,
                                region: loc.region,
                                region2: loc.region2,
                                countryCode: loc.country_code,
                            },
                        })
                }

                // Upsert shipping
                if (p.raw?.shipping) {
                    const ship = p.raw.shipping
                    await this.db
                        .insert(productShipping)
                        .values({
                            productId: existing.id,
                            itemIsShippable: ship.item_is_shippable,
                            userAllowsShipping: ship.user_allows_shipping,
                            costConfigurationId: ship.cost_configuration_id,
                        })
                        .onConflictDoUpdate({
                            target: productShipping.productId,
                            set: {
                                itemIsShippable: ship.item_is_shippable,
                                userAllowsShipping: ship.user_allows_shipping,
                                costConfigurationId: ship.cost_configuration_id,
                            },
                        })
                }

                if (changed) {
                    log.info({ wallapopId: p.id }, 'Product updated')
                }
            }
        }
    }
}
