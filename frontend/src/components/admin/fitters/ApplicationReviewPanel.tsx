'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, X } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-900 font-medium">{String(value)}</p>
    </div>
  )
}

function YesNo({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0 text-xs">
      <span className="text-zinc-700">{label}</span>
      <span className={`font-semibold ${value ? 'text-green-600' : 'text-zinc-400'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

function ResendInviteButton({ appId, accessToken }: { appId: string; accessToken: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  async function resend() {
    setState('loading')
    try {
      const res = await fetch(`${API}/api/fitter/applications/${appId}/resend-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={state === 'loading' || state === 'sent'}
      className="mt-2 text-xs font-semibold text-green-700 underline underline-offset-2 hover:text-green-900 disabled:opacity-50"
    >
      {state === 'loading' ? 'Sending invite…' : state === 'sent' ? '✓ Invite sent' : state === 'error' ? '✕ Failed — try again' : 'Resend invite email'}
    </button>
  )
}

interface Props {
  applicationId?: string
  accessToken:    string
  onUpdated?:     () => void
  onClose?:       () => void
}

export function ApplicationReviewPanel({ applicationId, accessToken, onUpdated, onClose }: Props) {
  const [app, setApp]         = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(Boolean(applicationId))
  const [notes, setNotes]     = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    if (!applicationId) {
      setApp(null)
      setLoading(false)
      return
    }

    let active = true
    async function loadApp() {
      setLoading(true)
      try {
        const res = await fetch(`${API}/api/fitter/applications/${applicationId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok && active) {
          const data = await res.json()
          setApp(data)
          setNotes(String(data.admin_notes ?? ''))
        }
      } catch (err) {
        if (active) toastError(err instanceof Error ? err.message : 'Failed to load application')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadApp()
    return () => { active = false }
  }, [applicationId, accessToken])

  async function decide(action: 'approve' | 'reject') {
    if (!app) return
    setSubmitting(action)
    try {
      const res = await fetch(`${API}/api/fitter/applications/${app.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          adminNotes: notes,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toastSuccess(action === 'approve' ? 'Application approved' : 'Application rejected')
      setApp(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected', admin_notes: notes } : null)
      onUpdated?.()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(null)
    }
  }

  if (!applicationId) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
        <p className="text-sm font-medium">Select an application from the list</p>
        <p className="text-xs text-zinc-400 mt-1">Click any application row to review contact details, services, working hours, and approve or reject.</p>
      </div>
    )
  }

  const status = String(app?.status ?? 'pending')
  const isDone = status === 'approved' || status === 'rejected'
  const wh = Array.isArray(app?.working_hours) ? (app!.working_hours as Record<string, unknown>[]) : []

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-md overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 truncate">
              {String(app?.full_name ?? 'Application Review')}
            </h2>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-700'}`}>
              {status}
            </span>
          </div>
          {app?.email && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{String(app.email)}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/admin/fitters/applications/${applicationId}`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors shadow-sm"
            title="Open full page review"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Full Page
          </Link>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
        {loading || !app ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Contact Details */}
            <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/30">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Contact Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Field label="Contact Person"   value={app.contact_person} />
                <Field label="Contact Email"    value={app.contact_email} />
                <Field label="Mobile Number"    value={app.mobile_number} />
                <Field label="Business Number"  value={app.business_number} />
                <Field label="Address"          value={app.address} />
                <Field label="Submitted"        value={app.submitted_at ? new Date(String(app.submitted_at)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} />
              </div>
            </div>

            {/* Services Offered */}
            <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/30">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Services Offered</p>
              <YesNo label="Passenger / SUV Tyres"  value={app.fits_passenger_suv} />
              <YesNo label="Wheel Packages"         value={app.fits_wheel_packages} />
              <YesNo label="Commercial / Truck"     value={app.fits_truck} />
              <YesNo label="Wheel Alignment"        value={app.wheel_alignment_available} />
              {!!app.wheel_alignment_available && !!app.wheel_alignment_price && (
                <p className="text-xs text-zinc-500 py-1 pl-1 font-medium">Alignment Price: ${String(app.wheel_alignment_price)}</p>
              )}
              <YesNo label="Mobile Fitting"         value={app.mobile_fitting_available} />
            </div>

            {/* Working Hours */}
            {wh.length > 0 && (
              <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/30">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Working Hours</p>
                <div className="space-y-1 text-xs">
                  {wh.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-zinc-600 capitalize">{String(h.day ?? '').replace('_', ' – ')}</span>
                      {h.is_closed
                        ? <span className="text-zinc-400">Closed</span>
                        : <span className="font-medium text-zinc-900">{String(h.open_time)} – {String(h.close_time)}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision Section */}
            {!isDone ? (
              <div className="rounded-xl border border-zinc-200 p-4 bg-white space-y-3">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Review &amp; Decision</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Admin review notes (optional)..."
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => decide('approve')}
                    disabled={submitting !== null}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-700 text-white py-2 text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {submitting === 'approve' ? 'Approving…' : '✓ Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide('reject')}
                    disabled={submitting !== null}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white py-2 text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {submitting === 'reject' ? 'Rejecting…' : '✕ Reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`rounded-xl border p-4 ${status === 'approved' ? 'border-green-200 bg-green-50/70' : 'border-red-200 bg-red-50/70'}`}>
                <p className={`text-xs font-semibold capitalize ${status === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                  Application {status}
                </p>
                {notes && <p className="text-xs text-zinc-600 mt-1 font-normal">{notes}</p>}
                {status === 'approved' && (
                  <ResendInviteButton appId={String(app.id)} accessToken={accessToken} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
