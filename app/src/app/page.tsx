import { Sparkline } from '@/components/sparkline'
import { getSearchSummaries } from '@/lib/searches'

export const dynamic = 'force-dynamic'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export default async function SearchesPage() {
  const items = await getSearchSummaries()
  const totalProducts = items.reduce((sum, item) => sum + item.products, 0)
  const active = items.filter((item) => item.status === 'active').length
  const falling = items.filter((item) => item.changePercent < 0).length

  return <main>
    <header className="topbar"><a className="brand" href="/"><span>W</span> walla tracker</a><div className="avatar">CS</div></header>
    <section className="hero">
      <div><p className="eyebrow">PANEL DE CONTROL</p><h1>Tus búsquedas</h1><p className="lede">Sigue el mercado y detecta el mejor momento para comprar.</p></div>
      <button className="primary">+ Nueva búsqueda</button>
    </section>
    <section className="metrics" aria-label="Resumen">
      <article><span>Búsquedas activas</span><strong>{active}</strong><small>de {items.length} configuradas</small></article>
      <article><span>Anuncios seguidos</span><strong>{totalProducts}</strong><small>actualizados hoy</small></article>
      <article><span>Precios a la baja</span><strong>{falling}</strong><small>búsquedas esta semana</small></article>
    </section>
    <section className="section-heading"><div><h2>Evolución de precios</h2><p>Precio medio y rango actual por búsqueda</p></div><button className="filter">Últimos 7 días ▾</button></section>
    <section className="search-list">
      {items.map((item) => <article className="search-card" key={item.id}>
        <div className="search-copy"><div className="status-row"><span className={`dot ${item.status}`} /><span>{item.status === 'active' ? 'Activa' : 'Pausada'}</span></div><h3>{item.query}</h3><p>{item.products} anuncios</p></div>
        <div className="price"><span>Precio medio</span><strong>{euro.format(item.averagePrice)}</strong><em className={item.changePercent <= 0 ? 'down' : 'up'}>{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</em></div>
        <div className="range"><span>Rango actual</span><strong>{euro.format(item.minPrice)} - {euro.format(item.maxPrice)}</strong></div>
        <Sparkline values={item.sparkline} />
        <button className="more" aria-label={`Opciones de ${item.query}`}>•••</button>
      </article>)}
    </section>
  </main>
}
