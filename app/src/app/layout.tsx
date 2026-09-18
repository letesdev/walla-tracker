import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Walla Tracker',
  description: 'Tus búsquedas de Wallapop y su evolución de precios',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}
