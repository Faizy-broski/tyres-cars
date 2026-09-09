'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FitmentCentreDetailClient from '@/components/admin/fitment-centres/FitmentCentreDetailClient'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import type {
  AdminCentreJob,
  AdminCentreKPIs,
  AdminCentreStats,
  AdminFitmentCentreDetail,
  BankDetails,
  ComplianceDoc,
  PaymentHistoryRow,
  PaymentSummary,
} from '@/types/admin.types'
import type { FitterPricingRow } from '@/types/fitter.types'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API returned ${res.status}`)
  }
  return res.json()
}

export default function FitmentCentreDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [centre, setCentre]                         = useState<AdminFitmentCentreDetail | null>(null)
  const [kpis, setKpis]                             = useState<AdminCentreKPIs | null>(null)
  const [jobs, setJobs]                             = useState<AdminCentreJob[]>([])
  const [jobsTotal, setJobsTotal]                   = useState(0)
  const [pricing, setPricing]                       = useState<FitterPricingRow[]>([])
  const [stats, setStats]                           = useState<AdminCentreStats>({ purchase12Months: [], loginHistory: [] })
  const [paymentSummary, setPaymentSummary]         = useState<PaymentSummary | null>(null)
  const [initialPayments, setInitialPayments]       = useState<PaymentHistoryRow[]>([])
  const [initialPaymentTotal, setInitialPaymentTotal] = useState(0)
  const [bankDetails, setBankDetails]               = useState<BankDetails | null>(null)
  const [complianceDocs, setComplianceDocs]         = useState<ComplianceDoc[]>([])
  const [token, setToken]                           = useState('')
  const [loading, setLoading]                       = useState(true)

  useEffect(() => {
    document.title = centre ? `${centre.business_name} | Tyres & Car Valeting` : 'Fitment Centre | Tyres & Car Valeting'
  }, [centre])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const tok = session?.access_token ?? ''
        if (!cancelled) setToken(tok)

        const [
          centreJson,
          kpisJson,
          jobsJson,
          pricingJson,
          statsJson,
          paymentSummaryJson,
          paymentsJson,
          bankJson,
          complianceJson,
        ] = await Promise.all([
          apiFetch<AdminFitmentCentreDetail>(`/api/admin/fitment-centres/${id}`, tok),
          apiFetch<AdminCentreKPIs>(`/api/admin/fitment-centres/${id}/kpis`, tok),
          apiFetch<{ data: AdminCentreJob[]; total: number }>(`/api/admin/fitment-centres/${id}/jobs?page=1`, tok),
          apiFetch<FitterPricingRow[]>(`/api/admin/fitment-centres/${id}/pricing`, tok),
          apiFetch<AdminCentreStats>(`/api/admin/fitment-centres/${id}/stats`, tok),
          apiFetch<PaymentSummary>(`/api/admin/fitment-centres/${id}/payments/summary`, tok),
          apiFetch<{ data: PaymentHistoryRow[]; total: number }>(`/api/admin/fitment-centres/${id}/payments?page=1`, tok),
          apiFetch<BankDetails | null>(`/api/admin/fitment-centres/${id}/bank-details`, tok),
          apiFetch<ComplianceDoc[]>(`/api/admin/fitment-centres/${id}/compliance`, tok),
        ])

        if (!cancelled) {
          setCentre(centreJson)
          setKpis(kpisJson)
          setJobs(jobsJson.data ?? [])
          setJobsTotal(jobsJson.total ?? 0)
          setPricing(pricingJson ?? [])
          setStats(statsJson)
          setPaymentSummary(paymentSummaryJson)
          setInitialPayments(paymentsJson.data ?? [])
          setInitialPaymentTotal(paymentsJson.total ?? 0)
          setBankDetails(bankJson)
          setComplianceDocs(complianceJson ?? [])
        }
      } catch (err) {
        if (!cancelled) toastError(err instanceof Error ? err.message : 'Failed to load fitment centre')
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
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!centre) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[{ label: 'Fitment Centre', href: '/admin/fitters' }, { label: 'Centre' }]} />
        <p className="mt-6 text-sm text-zinc-500">Fitment centre not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Fitment Centre', href: '/admin/fitters' },
          { label: centre.business_name },
        ]} />
      </div>
      <FitmentCentreDetailClient
        centre={centre}
        kpis={kpis}
        initialJobs={jobs}
        initialJobsTotal={jobsTotal}
        initialPricing={pricing}
        stats={stats}
        paymentSummary={paymentSummary}
        initialPayments={initialPayments}
        initialPaymentTotal={initialPaymentTotal}
        bankDetails={bankDetails}
        complianceDocs={complianceDocs}
        accessToken={token}
      />
    </div>
  )
}
