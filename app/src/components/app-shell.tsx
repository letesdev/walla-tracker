import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return <main>
    <header className="topbar">
      <a className="brand" href="/"><span>W</span> walla tracker</a>
      <nav className="nav" aria-label="Navegación principal">
        <a href="/">Dashboard</a>
        <a href="/tracks">Tracks</a>
      </nav>
      <div className="avatar">CS</div>
    </header>
    {children}
  </main>
}
