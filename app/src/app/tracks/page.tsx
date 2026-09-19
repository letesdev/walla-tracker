import { AppShell } from '@/components/app-shell'
import { TracksDashboard } from '@/components/tracks-dashboard'
import { getSearchSummaries } from '@/lib/searches'

export const dynamic = 'force-dynamic'

export default async function TracksPage() {
  const items = await getSearchSummaries()
  return <AppShell><TracksDashboard items={items} terminology="tracks" /></AppShell>
}
