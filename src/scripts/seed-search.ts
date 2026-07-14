import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'

dotenv.config()

type TimeFilter = 'today' | 'lastWeek' | 'lastMonth'

function parseArgs(): Record<string, string> {
    const args = process.argv.slice(2)
    const out: Record<string, string> = {}
    for (const a of args) {
        // support --key=value or key=value or just a value (treated as keywords)
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
    const keywords = argv.keywords || process.env.SEED_KEYWORDS || 'Garmin Fenix'

    const order_by = (argv.order_by || process.env.SEED_ORDER_BY || 'most_relevance') as 'newest' | 'most_relevance' | 'closest'
    const language = argv.language || process.env.SEED_LANGUAGE || 'es_ES'

    const latitude = Number(argv.latitude ?? process.env.SEED_LATITUDE ?? '41.6213378')
    const longitude = Number(argv.longitude ?? process.env.SEED_LONGITUDE ?? '-4.7423786')
    const distance_in_km = Number(argv.distance_in_km ?? process.env.SEED_DISTANCE_IN_KM ?? '100')

    const min_sale_price = argv.min_sale_price ? Number(argv.min_sale_price) : undefined
    const max_sale_price = argv.max_sale_price ? Number(argv.max_sale_price) : undefined

    const tf = argv.time_filter || process.env.SEED_TIME_FILTER
    const time_filter = (tf === 'today' || tf === 'lastWeek' || tf === 'lastMonth') ? (tf as TimeFilter) : undefined

    // validation
    const allowedOrder = ['newest', 'most_relevance', 'closest']
    if (!allowedOrder.includes(order_by)) {
        throw new Error(`Invalid order_by: ${order_by}. Allowed: ${allowedOrder.join(',')}`)
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27000/wallapop_tracker'
    const client = new MongoClient(mongoUri)
    await client.connect()
    const db = client.db()
    const searches = db.collection('searches')

    // Check for existing similar search (match on keywords + location + order_by)
    const existing = await searches.findOne({ keywords, order_by, latitude, longitude })
    if (existing) {
        console.log('A matching search already exists:', existing)
        await client.close()
        return
    }

    const doc: any = {
        keywords,
        // legacy compatibility
        query: keywords,
        order_by,
        language,
        latitude,
        longitude,
        distance_in_km,
        min_sale_price,
        max_sale_price,
        time_filter,
        maxResults: Number(argv.maxResults ?? process.env.SEED_MAX_RESULTS ?? '50'),
        createdAt: new Date(),
    }

    const { insertedId } = await searches.insertOne(doc)
    console.log('Inserted search with id', insertedId)
    await client.close()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
