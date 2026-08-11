import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FitterApplicationsClient, type FitterApplicationItem } from '@/components/admin/fitters/FitterApplicationsClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Fitter Applications — Admin' }

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default async function FitterApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { page: pageStr = '1', status = '' } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const token = session.access_token

  const headers = { Authorization: `Bearer ${token}` }
  const qs = new URLSearchParams({ page: String(page) })
  if (status) qs.set('status', status)

  let applications: FitterApplicationItem[] = []
  let total = 0
  try {
    const res = await fetch(`${API}/api/fitter/applications?${qs}`, { headers, cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      applications = json.data ?? []
      total        = json.total ?? 0
    }
  } catch { /* backend not reachable in dev */ }

  return (
    <FitterApplicationsClient
      applications={applications}
      total={total}
      page={page}
      status={status}
      accessToken={token}
    />
  )
}
