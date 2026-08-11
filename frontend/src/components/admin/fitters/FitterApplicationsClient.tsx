'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { ApplicationReviewPanel } from './ApplicationReviewPanel'
import { Plus } from 'lucide-react'

export interface FitterApplicationItem {
  id:           string
  full_name:    string
  email:        string
  status:       'pending' | 'approved' | 'rejected'
  submitted_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

interface Props {
  applications: FitterApplicationItem[]
  total:        number
  page:         number
  status:       string
  accessToken:  string
}

export function FitterApplicationsClient({
  applications,
  total,
  page,
  status,
  accessToken,
}: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(applications[0]?.id ?? null)

  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function buildHref(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    p.set('page', String(page))
    Object.entries(overrides).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    return `/admin/fitters/applications?${p}`
  }

  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const a of applications) if (a.status in counts) counts[a.status]++

  function refresh() {
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[
        { label: 'Fitment Centre', href: '/admin/fitters' },
        { label: 'Applications' },
      ]} />

      <SplitView
        title="Fitter Applications"
        description="Review and approve fitment centre onboarding requests"
        panelWidthClassName="w-full lg:w-[460px] xl:w-[500px]"
        headerAction={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/fitters/create"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Centre
            </Link>
          </div>
        }
        list={
          <div className="space-y-4">
            {/* Filter tabs and counts */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s || 'all'}
                    type="button"
                    onClick={() => router.push(buildHref({ status: s, page: '1' }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                      status === s
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {s || 'All'} ({s ? (counts[s] ?? 0) : total})
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Applicant Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-sm text-zinc-400">
                          No applications found.
                        </td>
                      </tr>
                    ) : (
                      applications.map(app => {
                        const isSelected = selectedId === app.id
                        return (
                          <tr
                            key={app.id}
                            className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${
                              isSelected ? '!bg-primary/10' : ''
                            }`}
                            onClick={() => setSelectedId(app.id)}
                          >
                            <td className="px-4 py-3 font-semibold text-zinc-900 whitespace-nowrap">{app.full_name}</td>
                            <td className="px-4 py-3 text-zinc-600 text-xs font-medium whitespace-nowrap">{app.email}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[app.status] ?? 'bg-zinc-100 text-zinc-700'}`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                              {new Date(app.submitted_at).toLocaleDateString('en-AU', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 text-xs text-zinc-500 bg-white">
                  <span>{total} total applications</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => router.push(buildHref({ page: String(page - 1) }))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 py-1 font-medium text-zinc-700">{page} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => router.push(buildHref({ page: String(page + 1) }))}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        panel={
          <ApplicationReviewPanel
            key={selectedId ?? 'none'}
            applicationId={selectedId ?? undefined}
            accessToken={accessToken}
            onUpdated={refresh}
          />
        }
      />
    </div>
  )
}
