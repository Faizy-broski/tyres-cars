'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ApplicationReviewClient from './ApplicationReviewClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [application, setApplication] = useState<Record<string, unknown> | null>(null)
  const [token, setToken]             = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const name = application?.full_name as string | undefined
    document.title = name ? `${name} — Application | Tyres & Car Valeting` : 'Application | Tyres & Car Valeting'
  }, [application])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const res = await fetch(`${API}/api/fitter/applications/${id}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `API returned ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) setApplication(data)
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load application')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Fitment Centre', href: '/admin/fitters' },
          { label: 'Applications', href: '/admin/fitters/applications' },
          { label: 'Application' },
        ]} />
        <p className="mt-6 text-sm text-zinc-500">Application not found.</p>
      </div>
    )
  }

  const appName = (application.full_name as string | undefined) ?? `Application ${id}`

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Fitment Centre', href: '/admin/fitters' },
          { label: 'Applications', href: '/admin/fitters/applications' },
          { label: appName },
        ]} />
      </div>
      <ApplicationReviewClient application={application} accessToken={token} />
    </div>
  )
}
