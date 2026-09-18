export function Sparkline({ values }: { values: number[] }) {
  const width = 150
  const height = 48
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución del precio medio"><polyline points={points} /></svg>
}
