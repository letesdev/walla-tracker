import { Db } from 'mongodb'
import pino from 'pino'
import { WallapopClient } from './wallapop-client'
import { WALLAPOP_DEFAULTS } from './defaults'

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
        const searches = await this.db.collection('searches').find().toArray()
        for (const s of searches) {
            if (s.status == "inactive") {
                continue;
            }
            try {
                log.info({ searchId: s._id, query: s.query }, 'Fetching search')
                // Normalize and prefer `keywords` field but fall back to legacy `query`.
                const keywords = (s.query || '')
                if (!keywords || String(keywords).trim() === '') {
                    log.warn({ searchId: s._id }, 'Skipping search with no keywords')
                    continue
                }

                // Apply defaults when missing and persist them back to the `searches` document.
                const defaults = WALLAPOP_DEFAULTS

                const normalized: any = {
                    order_by: s.order_by || defaults.order_by,
                    language: s.language || defaults.language,
                    latitude: typeof s.latitude !== 'undefined' ? s.latitude : defaults.latitude,
                    longitude: typeof s.longitude !== 'undefined' ? s.longitude : defaults.longitude,
                    min_sale_price: typeof s.min_sale_price !== 'undefined' ? s.min_sale_price : undefined,
                    max_sale_price: typeof s.max_sale_price !== 'undefined' ? s.max_sale_price : undefined,
                    distance_in_km: typeof s.distance_in_km !== 'undefined' ? s.distance_in_km : defaults.distance_in_km,
                    time_filter: s.time_filter || undefined,
                    // Use existing maxResults or fall back to default page size
                    maxResults: typeof s.maxResults === 'number' && s.maxResults > 0 ? s.maxResults : WALLAPOP_DEFAULTS.pageSize,
                }

                // Persist defaults for any missing fields so future polls have the full config.
                // const updateFields: any = {}
                // if (!('order_by' in s) || s.order_by == null) updateFields.order_by = normalized.order_by
                // if (!('language' in s) || s.language == null) updateFields.language = normalized.language
                // if (!('latitude' in s) || s.latitude == null) updateFields.latitude = normalized.latitude
                // if (!('longitude' in s) || s.longitude == null) updateFields.longitude = normalized.longitude
                // if (!('distance_in_km' in s) || s.distance_in_km == null) updateFields.distance_in_km = normalized.distance_in_km

                // if (!('time_filter' in s) || s.time_filter == null) updateFields.time_filter = normalized.time_filter
                // if (!('maxResults' in s) || s.maxResults == null) updateFields.maxResults = normalized.maxResults
                // if (Object.keys(updateFields).length > 0) {
                //     await this.db.collection('searches').updateOne({ _id: s._id }, { $set: updateFields }).catch((err) => log.warn({ err, searchId: s._id }, 'Failed to persist search defaults'))
                // }

                const limit = typeof s.maxResults === 'number' && s.maxResults > 0 ? s.maxResults : WALLAPOP_DEFAULTS.pageSize
                const products = await this.client.fetchSearchResults(String(keywords), limit, normalized)
                await this.handleProductsForSearch(s, products)
            } catch (err) {
                log.error({ err, searchId: s._id }, 'Error polling search')
            }
        }
    }

    /** Convenience wrapper for one-shot runs. */
    async runOnce() {
        await this.pollOnce()
        await this.stop()
    }


    /**
     * Persist fetched products for a single search into a single `products`
     * collection. This implementation keeps a small history of prices inside
     * the `products.prices` array and stores a few extra fields fetched from
     * the Wallapop response (reserved flag, location, shipping, created_at).
     *
     * Behaviour:
     * - The app keeps a single `products` collection (no snapshots or change
     *   documents). Each product document contains a `prices` array of objects
     *   { timestamp, price, latest } where `price` is a string including
     *   currency (e.g. "314.99 EUR"). Only the newest price has `latest: true`.
     * - When a product is first discovered it is inserted into `products` with
     *   an initial `prices` entry. The field `WallapopTrackerId` references the
     *   originating tracked search.
     * - On subsequent polls the poller updates `title` and `description` when
     *   they change, and manages the `prices` array when the fetched price is
     *   different from the current latest one (previous latest entries are
     *   marked `latest: false`, and a new entry is appended with `latest: true`).
     * - `lastSeenAt` is updated to indicate when the product was last observed.
     *
     * Collections touched:
     * - `products` (insert or update)
     *
     * @param search The `searches` collection document that triggered this poll.
     * @param products Array of product objects returned by the Wallapop API
     */
    private async handleProductsForSearch(search: any, products: any[]) {
        const productsCol = this.db.collection('products')

        for (const p of products) {
            const existing = await productsCol.findOne({ wallapopId: p.id })
            const now = new Date()

            // Build a readable price string including currency when available
            let priceStr = ''
            if (p.raw && p.raw.price && typeof p.raw.price === 'object') {
                const amt = p.raw.price.amount
                const cur = p.raw.price.currency
                priceStr = `${amt} ${cur}`
            } else if (typeof p.price !== 'undefined') {
                priceStr = String(p.price)
            }

            if (!existing) {
                const newProduct: any = {
                    wallapopId: p.id,
                    WallapopTrackerId: search._id,
                    title: p.title,
                    description: p.description,
                    prices: [
                        { timestamp: now, price: priceStr, latest: true },
                    ],
                    images: p.images || [],
                    url: p.url,
                    lastSeenAt: now,
                    reserved: p.raw?.reserved?.flag ?? false,
                    location: p.raw?.location ?? null,
                    shipping: p.raw?.shipping ?? null,
                    created_at: p.raw?.created_at ? new Date(Number(p.raw.created_at)) : undefined,
                }

                await productsCol.insertOne(newProduct)
                log.info({ wallapopId: p.id }, 'Inserted new product')
            } else {
                const updates: any = {}
                let changed = false

                // Ensure we have the tracker id on older documents
                if (!existing.WallapopTrackerId) {
                    updates.WallapopTrackerId = existing.searchId || search._id
                    changed = true
                }

                // Title/description changes
                if (existing.title !== p.title) {
                    updates.title = p.title
                    changed = true
                }
                if (existing.description !== p.description) {
                    updates.description = p.description
                    changed = true
                }

                // Reserved/location/shipping sync
                const reservedFlag = p.raw?.reserved?.flag ?? (existing.reserved ?? false)
                if (existing.reserved !== reservedFlag) {
                    updates.reserved = reservedFlag
                    changed = true
                }

                const loc = p.raw?.location ?? existing.location ?? null
                if (JSON.stringify(existing.location) !== JSON.stringify(loc)) {
                    updates.location = loc
                    changed = true
                }

                const ship = p.raw?.shipping ?? existing.shipping ?? null
                if (JSON.stringify(existing.shipping) !== JSON.stringify(ship)) {
                    updates.shipping = ship
                    changed = true
                }

                // Preserve original created_at when present; set it if missing
                if (!existing.created_at && p.raw?.created_at) {
                    updates.created_at = new Date(Number(p.raw.created_at))
                    changed = true
                }

                // Price history management
                const currentPrices = Array.isArray(existing.prices) ? existing.prices : []
                const latest = currentPrices.find((pr: any) => pr.latest) || (currentPrices.length ? currentPrices[currentPrices.length - 1] : undefined)
                if (!latest || latest.price !== priceStr) {
                    const newPrices = currentPrices.map((pr: any) => ({ ...pr, latest: false }))
                    newPrices.push({ timestamp: now, price: priceStr, latest: true })
                    updates.prices = newPrices
                    changed = true
                }

                // Always update lastSeenAt to indicate we saw the product now
                updates.lastSeenAt = now

                if (changed) {
                    await productsCol.updateOne({ _id: existing._id }, { $set: updates })
                    log.info({ wallapopId: p.id }, 'Product updated')
                } else {
                    // No other changes, still update lastSeenAt
                    await productsCol.updateOne({ _id: existing._id }, { $set: { lastSeenAt: now } })
                }
            }
        }
    }
}
