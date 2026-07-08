'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Supplier } from '@/types/admin.types'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { TableBodySpinner } from '@/components/ui/table-loader'
import { toastError, toastSuccess } from '@/lib/toast'
import Papa from 'papaparse'
import ColumnMapModal from './ColumnMapModal'

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

function SupplierRowActions({
  supplier,
  onDelete,
  onUploadCsv,
}: {
  supplier:    Supplier
  onDelete:    () => void
  onUploadCsv: () => void
}) {
  const router                = useRouter()
  const [open, setOpen]       = useState(false)
  const [coords, setCoords]   = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const btnRef                = useRef<HTMLButtonElement>(null)
  const menuRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
      >
        Actions
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 9999 }}
          className="w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => { setOpen(false); router.push(`/admin/suppliers/${supplier.supplier_id}`) }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Manage
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onUploadCsv() }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            Upload CSV
          </button>
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); router.push(`/admin/suppliers/${supplier.supplier_id}/edit`) }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-zinc-400" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete() }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function SuppliersClient({ initialSuppliers = [], accessToken: initialToken }: Props) {
  const router = useRouter()

  const [suppliers, setSuppliers]       = useState<Supplier[]>(initialSuppliers)
  const [token, setToken]               = useState(initialToken ?? '')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(!initialToken)
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
    <div className="p-4 sm:p-6 space-y-5">
      <AdminBreadcrumb crumbs={[{ label: 'Suppliers' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Suppliers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage stock suppliers and CSV imports</p>
        </div>
        <Button type="button" onClick={() => router.push('/admin/suppliers/new')}>
          <Plus className="w-4 h-4" />
          Add Supplier
        </Button>
      </div>

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
                <th className="px-5 py-3 text-left text-xs font-bold text-primary uppercase tracking-wide">Added</th>
                <th className="px-5 py-3 w-28" scope="col"><span className="sr-only">Actions</span></th>
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
                filtered.map(s => (
                  <tr key={s.supplier_id} className="odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors">
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
                    <td className="px-5 py-3 text-xs text-zinc-500">{fmtDate(s.created_at)}</td>
                    <td className="px-5 py-3">
                      <SupplierRowActions
                        supplier={s}
                        onDelete={() => setDeleteTarget(s)}
                        onUploadCsv={() => { setCsvTarget(s); setCsvFile(null); setCsvHeaders([]) }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Supplier?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            <strong>{deleteTarget?.supplier_name}</strong> will be permanently removed along with all product mappings.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
