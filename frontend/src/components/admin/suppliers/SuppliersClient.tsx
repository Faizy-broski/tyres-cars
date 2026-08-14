'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Upload, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Supplier } from '@/types/admin.types'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { SplitView } from '@/components/admin/SplitView'
import { TableBodySpinner } from '@/components/ui/table-loader'
import { toastError, toastSuccess } from '@/lib/toast'
import Papa from 'papaparse'
import ColumnMapModal from './ColumnMapModal'
import { SupplierFormPanel, EMPTY_SUPPLIER_FORM, supplierToForm, formToSupplierPatch, type SupplierFormState } from './SupplierFormPanel'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const TYPE_BADGE: Record<string, string> = {
  wholesaler:          'bg-blue-50 text-blue-700',
  factory:             'bg-purple-50 text-purple-700',
  marketplace_partner: 'bg-amber-50 text-amber-700',
  '3pl':               'bg-teal-50 text-teal-700',
}

const ACCESS_BADGE: Record<string, string> = {
  owned_after_purchase: 'bg-blue-50 text-blue-700',
  consignment:          'bg-amber-50 text-amber-700',
  live_supplier_stock:  'bg-green-50 text-green-700',
}

const ACCESS_LABEL: Record<string, string> = {
  owned_after_purchase: 'After Purchase',
  consignment:          'Consignment',
  live_supplier_stock:  'Live Stock',
}

interface Props {
  initialSuppliers?: Supplier[]
  accessToken?:      string
}

export default function SuppliersClient({ initialSuppliers = [], accessToken: initialToken }: Props) {
  const [suppliers, setSuppliers]       = useState<Supplier[]>(initialSuppliers)
  const [token, setToken]               = useState(initialToken ?? '')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(!initialToken)

  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<SupplierFormState | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [csvTarget, setCsvTarget]       = useState<Supplier | null>(null)
  const [csvFile, setCsvFile]           = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders]     = useState<string[]>([])
  const [isDragOver, setIsDragOver]     = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // When rendered as a pure client component (no server props), load token + suppliers ourselves
  useEffect(() => {
    if (initialToken) return
    createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setToken(session.access_token)
      try {
        const res = await fetch(`${API}/api/admin/suppliers`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setSuppliers(Array.isArray(data) ? data : (data.data ?? []))
        }
      } finally {
        setLoading(false)
      }
    })
  }, [initialToken])

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const refetchSuppliers = useCallback(async () => {
    const res = await fetch(`${API}/api/admin/suppliers`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return undefined
    const data = await res.json()
    const list: Supplier[] = Array.isArray(data) ? data : (data.data ?? [])
    setSuppliers(list)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const processCsvFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toastError('Please upload a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = evt => {
      const text   = evt.target?.result as string
      const result = Papa.parse<Record<string, string>>(text, { header: true, preview: 1, skipEmptyLines: true })
      setCsvHeaders(result.meta.fields ?? [])
      setCsvFile(file)
    }
    reader.readAsText(file)
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/suppliers`, { headers })
      if (res.ok) {
        const data: Supplier[] = await res.json()
        const q = search.toLowerCase()
        setSuppliers(q ? data.filter(s => s.supplier_name.toLowerCase().includes(q)) : data)
      }
    } finally { setLoading(false) }
  }

  function selectSupplier(s: Supplier) {
    setSelectedId(s.supplier_id)
    setSelectedForm(supplierToForm(s))
  }

  function handleNewSupplier() {
    setSelectedId(null)
    setSelectedForm(null)
  }

  async function handleSaved(saved: { supplierId: string; form: SupplierFormState }) {
    const existing = suppliers.find(s => s.supplier_id === saved.supplierId)

    if (existing) {
      // Edit of an already-visible row: we already know exactly what changed — splice it into the
      // local list immediately instead of waiting on a second round-trip (GET) just to re-learn it.
      const merged: Supplier = { ...existing, ...formToSupplierPatch(saved.form) }
      setSuppliers(prev => prev.map(s => s.supplier_id === saved.supplierId ? merged : s))
      selectSupplier(merged)
      // Reconcile with server truth in the background — deliberately delayed, not fired immediately.
      // An immediate refetch can win the race against the write it's meant to confirm and land a
      // moment later with pre-save data, silently stomping the correct value we just painted.
      setTimeout(() => refetchSuppliers(), 1500)
    } else {
      // Newly created record — no existing row to splice into, so a real refetch is unavoidable.
      const fresh = await refetchSuppliers()
      const found = fresh?.find(s => s.supplier_id === saved.supplierId)
      if (found) selectSupplier(found)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/admin/suppliers/${deleteTarget.supplier_id}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Delete failed')
      setSuppliers(prev => prev.filter(s => s.supplier_id !== deleteTarget.supplier_id))
      toastSuccess('Supplier deleted')
      setDeleteTarget(null)
      if (selectedId === deleteTarget.supplier_id) { setSelectedId(null); setSelectedForm(null) }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = search
    ? suppliers.filter(s => s.supplier_name.toLowerCase().includes(search.toLowerCase()))
    : suppliers

  return (
    <>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminBreadcrumb crumbs={[{ label: 'Suppliers' }]} />
      </div>

      <SplitView
        title="Suppliers"
        description="Manage stock suppliers and CSV imports"
        headerAction={
          <button
            type="button"
            onClick={handleNewSupplier}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Add Supplier
          </button>
        }
        list={
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100">
              <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search suppliers..."
                  className="pl-8 text-xs"
                />
              </form>
              <span className="ml-auto text-xs text-zinc-400">{filtered.length} suppliers</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-primary/10">
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Supplier</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Stock Access</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">API</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <TableBodySpinner />
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground text-sm">No suppliers found</td>
                    </tr>
                  ) : (
                    filtered.map(s => {
                      const isSelected = selectedId === s.supplier_id
                      return (
                        <tr key={s.supplier_id}
                          className={`odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors cursor-pointer ${isSelected ? '!bg-primary/10' : ''}`}
                          onClick={() => selectSupplier(s)}
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-900">{s.supplier_name}</p>
                            <p className="text-xs text-zinc-400">{s.contact_email ?? '—'}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[s.supplier_type ?? ''] ?? 'bg-zinc-100 text-zinc-600'}`}>
                              {s.supplier_type ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACCESS_BADGE[s.stock_access_type ?? ''] ?? 'bg-zinc-100 text-zinc-600'}`}>
                              {s.stock_access_type ? (ACCESS_LABEL[s.stock_access_type] ?? s.stock_access_type) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.api_connected ? 'text-green-700' : 'text-zinc-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.api_connected ? 'bg-green-500' : 'bg-zinc-300'}`} />
                              {s.api_connected ? 'Connected' : 'Not connected'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                              {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-zinc-500">{fmtDate(s.created_at)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        }
        panel={
          <SupplierFormPanel
            key={selectedId ?? 'new'}
            mode={selectedId ? 'edit' : 'create'}
            supplierId={selectedId ?? undefined}
            initial={selectedForm ?? EMPTY_SUPPLIER_FORM}
            onSaved={handleSaved}
            onRequestDelete={() => {
              const s = suppliers.find(x => x.supplier_id === selectedId)
              if (s) setDeleteTarget(s)
            }}
            onUploadCsv={selectedId ? () => {
              const s = suppliers.find(x => x.supplier_id === selectedId)
              if (s) { setCsvTarget(s); setCsvFile(null); setCsvHeaders([]) }
            } : undefined}
          />
        }
      />

      {/* CSV upload dialog */}
      <Dialog open={!!csvTarget && !csvFile} onOpenChange={open => { if (!open) setCsvTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload CSV — {csvTarget?.supplier_name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-500 -mt-1">Upload a CSV exported from your supplier. You&apos;ll map the columns before the import runs.</p>
          <div
            className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors ${isDragOver ? 'border-primary bg-primary/5' : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) processCsvFile(f) }}
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-600">Drop CSV file here</p>
            <p className="text-xs text-zinc-400">or click to browse · max 10MB</p>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processCsvFile(f); e.target.value = '' }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Column mapping modal */}
      {csvTarget && csvFile && csvHeaders.length > 0 && (
        <ColumnMapModal
          supplierId={csvTarget.supplier_id}
          file={csvFile}
          csvHeaders={csvHeaders}
          accessToken={token}
          onClose={() => { setCsvTarget(null); setCsvFile(null); setCsvHeaders([]) }}
          onImported={refetchSuppliers}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 text-center">Delete Supplier?</h2>
            <p className="text-sm text-zinc-500 text-center mt-1 mb-5">
              <strong>{deleteTarget.supplier_name}</strong> will be permanently removed along with all product mappings.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
