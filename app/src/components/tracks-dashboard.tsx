import { Sparkline } from '@/components/sparkline'
import type { SearchSummary } from '@/lib/searches'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

type TracksDashboardProps = {
  items: SearchSummary[]
  terminology: 'searches' | 'tracks'
}

export function TracksDashboard({ items, terminology }: TracksDashboardProps) {
  const isTracks = terminology === 'tracks'
  const totalProducts = items.reduce((sum, item) => sum + item.products, 0)
  const active = items.filter((item) => item.status === 'active').length
  const falling = items.filter((item) => item.changePercent < 0).length
  const singular = isTracks ? 'track' : 'búsqueda'
  const plural = isTracks ? 'tracks' : 'búsquedas'

  return <>
    <section className="hero">
      <div><p className="eyebrow">PANEL DE CONTROL</p><h1>Tus {plural}</h1><p className="lede">Sigue el mercado y detecta el mejor momento para comprar.</p></div>
      <button className="primary">+ Nuevo {singular}</button>
    </section>
    <section className="metrics" aria-label="Resumen">
      <article><span>{isTracks ? 'Tracks activos' : 'Búsquedas activas'}</span><strong>{active}</strong><small>de {items.length} configurados</small></article>
      <article><span>Anuncios seguidos</span><strong>{totalProducts}</strong><small>actualizados hoy</small></article>
      <article><span>Precios a la baja</span><strong>{falling}</strong><small>{plural} esta semana</small></article>
    </section>
    <section className="section-heading"><div><h2>Evolución de precios</h2><p>Precio medio y rango actual por {singular}</p></div><button className="filter">Últimos 7 días ▾</button></section>
    <section className="search-list">
      {items.map((item) => <article className="search-card" key={item.id}>
        <div className="search-copy"><div className="status-row"><span className={`dot ${item.status}`} /><span>{item.status === 'active' ? 'Activo' : 'Pausado'}</span></div><h3>{item.query}</h3><p>{item.products} anuncios</p></div>
        <div className="price"><span>Precio medio</span><strong>{euro.format(item.averagePrice)}</strong><em className={item.changePercent <= 0 ? 'down' : 'up'}>{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</em></div>
        <div className="range"><span>Rango actual</span><strong>{euro.format(item.minPrice)} - {euro.format(item.maxPrice)}</strong></div>
        <Sparkline values={item.sparkline} />
        <button className="more" aria-label={`Opciones de ${item.query}`}>•••</button>
      </article>)}
    </section>
  </>
}
