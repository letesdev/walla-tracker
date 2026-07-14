import dotenv from 'dotenv'
dotenv.config()

import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { searches } from '../db/schema'

type TimeFilter = 'today' | 'lastWeek' | 'lastMonth'

function parseArgs(): Record<string, string> {
    const args = process.argv.slice(2)
    const out: Record<string, string> = {}
    for (const a of args) {
        if (a.startsWith('--')) {
            const kv = a.slice(2).split('=')
            out[kv[0]] = kv[1] ?? ''
        } else if (a.includes('=')) {
            const kv = a.split('=')
            out[kv[0]] = kv[1]
        } else if (!out.keywords) {
            out.keywords = a
        }
    }
    return out
}

async function main() {
    const argv = parseArgs()
    const query = argv.keywords || process.env.SEED_KEYWORDS || 'Garmin Fenix'
    const orderBy = (argv.order_by || process.env.SEED_ORDER_BY || 'most_relevance') as 'newest' | 'most_relevance' | 'closest'
    const language = argv.language || process.env.SEED_LANGUAGE || 'es_ES'
    const latitude = Number(argv.latitude ?? process.env.SEED_LATITUDE ?? '41.6213378')
    const longitude = Number(argv.longitude ?? process.env.SEED_LONGITUDE ?? '-4.7423786')
    const distanceInKm = Number(argv.distance_in_km ?? process.env.SEED_DISTANCE_IN_KM ?? '100')
    const minSalePrice = argv.min_sale_price ? Number(argv.min_sale_price) : undefined
    const maxSalePrice = argv.max_sale_price ? Number(argv.max_sale_price) : undefined
    const tf = argv.time_filter || process.env.SEED_TIME_FILTER
    const timeFilter = (tf === 'today' || tf === 'lastWeek' || tf === 'lastMonth') ? (tf as TimeFilter) : undefined
    const maxResults = Number(argv.maxResults ?? process.env.SEED_MAX_RESULTS ?? '50')

    const allowedOrder = ['newest', 'most_relevance', 'closest']
    if (!allowedOrder.includes(orderBy)) {
        throw new Error(`Invalid order_by: ${orderBy}. Allowed: ${allowedOrder.join(',')}`)
    }

    // Check for existing similar search (match on query + order_by)
    const [existing] = await db
        .select()
        .from(searches)
        .where(and(eq(searches.query, query), eq(searches.orderBy, orderBy)))
        .limit(1)

    if (existing) {
        console.log('A matching search already exists:', existing)
        process.exit(0)
    }

    const [inserted] = await db
        .insert(searches)
        .values({ query, orderBy, language, latitude, longitude, distanceInKm, minSalePrice, maxSalePrice, timeFilter, maxResults })
        .returning()

    console.log('Inserted search with id', inserted.id)
    process.exit(0)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
