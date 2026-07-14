import { WALLAPOP_DEFAULTS } from './defaults'

export type WallapopProduct = {
  id: string
  title: string
  description: string
  price: number
  images?: string[]
  url?: string
  raw?: any
}

export class WallapopClient {
  private baseUrl: string
  private apiKey?: string
  private headers: Record<string, string>

  constructor(baseUrl: string, apiKey?: string) {
    // default to the v3 API base
    this.baseUrl = baseUrl || 'http://api.wallapop.com/api/v3'
    this.apiKey = apiKey
    this.headers = {
      'User-Agent': process.env.WALLAPOP_USER_AGENT || 'USER_AGENT',
      'X-DeviceOS': '0',
      Accept: 'application/json',
    }
    if (apiKey) this.headers['Authorization'] = `Bearer ${apiKey}`
  }

  /**
   * Fetch search results from Wallapop, following pagination via `meta.next_page`
   * until `limit` items are collected or there are no more pages.
   *
   * - Required query params: source=search_box, keywords, language (defaults to es_ES)
   * - For subsequent pages include the `next_page` token returned in `meta.next_page`
   */
  async fetchSearchResults(
    keywords: string,
    limit = 50,
    opts?: {
      order_by?: string
      language?: string
      latitude?: number
      longitude?: number
      min_sale_price?: number
      max_sale_price?: number
      distance_in_km?: number
      time_filter?: 'today' | 'lastWeek' | 'lastMonth'
    }
  ): Promise<WallapopProduct[]> {
    if (!this.baseUrl) throw new Error('Wallapop API base URL not configured')

    const results: WallapopProduct[] = []
    let nextPageToken: string | undefined = undefined
    const language = opts?.language || WALLAPOP_DEFAULTS.language
    const order_by = opts?.order_by || WALLAPOP_DEFAULTS.order_by

    while (results.length < limit) {
      const remaining = limit - results.length
      const pageSize = Math.min(remaining, WALLAPOP_DEFAULTS.pageSize)

      const params: any = {
        source: 'search_box',
        keywords,
        language,
        order_by,
      }
      if (nextPageToken) params.next_page = nextPageToken

      // Optional filters — include only when not null or undefined
      if (opts) {
        if (opts.latitude != null) params.latitude = opts.latitude
        if (opts.longitude != null) params.longitude = opts.longitude
        if (opts.min_sale_price != null) params.min_sale_price = opts.min_sale_price
        if (opts.max_sale_price != null) params.max_sale_price = opts.max_sale_price
        if (opts.distance_in_km != null) params.distance_in_km = opts.distance_in_km
        if (opts.time_filter != null) params.time_filter = opts.time_filter
      }

      if (!keywords || String(keywords).trim() === '') {
        throw new Error('Wallapop fetch requires non-empty keywords')
      }

      const base = String(this.baseUrl).replace(/\/+$/, '')
      const urlStr = `${base}/search?${new URLSearchParams(params).toString()}`

      let res: any
      try {
        res = await (globalThis as any).fetch(urlStr, { method: 'GET', headers: this.headers })
      } catch (err: any) {
        throw new Error(`Wallapop fetch error: ${err?.message ?? String(err)}`)
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Wallapop fetch error: ${res.status} ${res.statusText} ${txt}`)
      }

      let data: any
      try {
        data = await res.json()
      } catch (err: any) {
        throw new Error(`Wallapop JSON parse error: ${err?.message ?? String(err)}`)
      }
      const items = (data.data && data.data.section && Array.isArray(data.data.section.payload.items)) ? data.data.section.payload.items : []

      for (const it of items) {
        const price = it.price && typeof it.price === 'object' ? Number(it.price.amount) : Number(it.price || 0)
        const images = Array.isArray(it.images) ? it.images.map((im: any) => (im.urls && (im.urls.big || im.urls.medium || im.urls.small)) || null).filter(Boolean) : []
        results.push({
          id: String(it.id),
          title: it.title,
          description: it.description,
          price,
          images,
          url: it.url || (it.web_slug ? `https://es.wallapop.com/item/${it.web_slug}` : undefined),
          raw: it,
        })
        if (results.length >= limit) break
      }

      // meta.next_page holds an encoded cursor/token for the next page
      nextPageToken = data.meta && data.meta.next_page ? data.meta.next_page : undefined
      if (!nextPageToken) break
    }

    return results
  }
}
