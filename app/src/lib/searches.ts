import { desc, eq, sql } from 'drizzle-orm'
import { productPrices, products, searches } from '../../../api/src/db/schema'
import { db } from './db'

export type SearchSummary = {
  id: string
  query: string
  status: string
  products: number
  averagePrice: number
  minPrice: number
  maxPrice: number
  changePercent: number
  sparkline: number[]
}

const demo: SearchSummary[] = [
  { id: 'demo-1', query: 'Garmin Fenix 6', status: 'active', products: 34, averagePrice: 238, minPrice: 145, maxPrice: 390, changePercent: -6.8, sparkline: [272, 267, 259, 264, 252, 247, 238] },
  { id: 'demo-2', query: 'MacBook Air M2', status: 'active', products: 21, averagePrice: 794, minPrice: 650, maxPrice: 980, changePercent: -3.4, sparkline: [822, 817, 809, 812, 803, 798, 794] },
  { id: 'demo-3', query: 'Sony WH-1000XM5', status: 'paused', products: 13, averagePrice: 229, minPrice: 180, maxPrice: 290, changePercent: 2.1, sparkline: [221, 219, 224, 226, 225, 231, 229] },
]

export async function getSearchSummaries(): Promise<SearchSummary[]> {
  if (!db) return demo
  const rows = await db
    .select({
      id: searches.id,
      query: searches.query,
      status: searches.status,
      products: sql<number>`count(distinct ${products.id})`,
      averagePrice: sql<number>`coalesce(avg(case when ${productPrices.isLatest} then nullif(${productPrices.price}, '')::numeric end), 0)`,
      minPrice: sql<number>`coalesce(min(case when ${productPrices.isLatest} then nullif(${productPrices.price}, '')::numeric end), 0)`,
      maxPrice: sql<number>`coalesce(max(case when ${productPrices.isLatest} then nullif(${productPrices.price}, '')::numeric end), 0)`,
    })
    .from(searches)
    .leftJoin(products, eq(products.searchId, searches.id))
    .leftJoin(productPrices, eq(productPrices.productId, products.id))
    .groupBy(searches.id)
    .orderBy(desc(searches.createdAt))

  return rows.map((row) => ({
    ...row,
    status: row.status ?? 'active',
    products: Number(row.products),
    averagePrice: Math.round(Number(row.averagePrice)),
    minPrice: Number(row.minPrice),
    maxPrice: Number(row.maxPrice),
    changePercent: 0,
    sparkline: [Number(row.averagePrice)],
  }))
}
