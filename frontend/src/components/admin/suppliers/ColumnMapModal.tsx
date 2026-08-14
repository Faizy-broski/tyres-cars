'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ImportJobStatus } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const REQUIRED_FIELDS = [
  { key: 'size_raw',        label: 'Size (raw)',      required: true  },
  { key: 'brand_name',      label: 'Brand',           required: true  },
  { key: 'pattern_name',    label: 'Pattern',         required: true  },
  { key: 'supplier_sku',    label: 'Supplier SKU',    required: true  },
  { key: 'supplier_price',  label: 'Price',           required: true  },
  { key: 'supplier_stock',  label: 'Stock qty',       required: true  },
  { key: 'load_index',      label: 'Load Index',      required: false },
  { key: 'speed_rating',    label: 'Speed Rating',    required: false },
  { key: 'lead_time_days',  label: 'Lead Time (days)',required: false },
  { key: 'product_name',    label: 'Product Name',    required: false },
]

interface Props {
  supplierId:  string
  file:        File
  csvHeaders:  string[]
  accessToken: string
  onClose:     () => void
  /** Called once the import job actually finishes (state === 'completed'), so the caller can refresh its list. */
  onImported?: () => void
}

type Phase = 'map' | 'uploading' | 'polling' | 'done' | 'error'

export default function ColumnMapModal({ supplierId, file, csvHeaders, accessToken, onClose, onImported }: Props) {
  const [columnMap, setColumnMap] = useState<Record<string, string>>(() => {
    const autoMap: Record<string, string> = {}
    for (const field of REQUIRED_FIELDS) {
      const match = csvHeaders.find(h => h.toLowerCase().replace(/\s+/g, '_') === field.key)
      if (match) autoMap[field.key] = match
    }
    return autoMap
  })

  const [phase, setPhase]       = useState<Phase>('map')
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportJobStatus['result']>(null)
  const [error, setError]       = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  function validToSubmit() {
    return REQUIRED_FIELDS.filter(f => f.required).every(f => !!columnMap[f.key])
  }

  async function handleSubmit() {
    setPhase('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('column_map', JSON.stringify(columnMap))

      const res = await fetch(`${API}/api/admin/suppliers/${supplierId}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }

      const { jobId: jid } = await res.json()
      setPhase('polling')
      startPolling(jid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPhase('error')
    }
  }

  function startPolling(jid: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/admin/suppliers/jobs/${jid}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) return
        const status: ImportJobStatus = await res.json()
        setProgress(status.progress ?? 0)

        if (status.state === 'completed') {
          clearInterval(pollRef.current!)
          setResult(status.result ?? null)
          setPhase('done')
          onImported?.()
        } else if (status.state === 'failed') {
          clearInterval(pollRef.current!)
          setError(status.failReason ?? 'Import job failed')
          setPhase('error')
        }
      } catch { /* network hiccup, continue polling */ }
    }, 2000)
  }

  const canClose = phase === 'map' || phase === 'done' || phase === 'error'

  return (
    <Dialog open onOpenChange={o => { if (!o && canClose) onClose() }}>
      <DialogContent className="p-0 gap-0 rounded-2xl shadow-xl ring-0 bg-white sm:max-w-lg" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <DialogTitle className="text-base font-semibold text-zinc-900">Map CSV Columns</DialogTitle>
          {canClose && (
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </DialogClose>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ---- Mapping phase ---- */}
          {phase === 'map' && (
            <>
              <p className="text-xs text-zinc-500">
                Match each field to the corresponding column header in your CSV file.
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {REQUIRED_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label htmlFor={`col-${field.key}`} className="w-36 text-xs font-medium text-zinc-700 shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <select
                      id={`col-${field.key}`}
                      value={columnMap[field.key] ?? ''}
                      onChange={e => setColumnMap(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="">— select column —</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={handleSubmit} disabled={!validToSubmit()}>
                  Start Import
                </Button>
              </div>
            </>
          )}

          {/* ---- Uploading phase ---- */}
          {phase === 'uploading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              <p className="text-sm text-zinc-600">Uploading CSV…</p>
            </div>
          )}

          {/* ---- Polling phase ---- */}
          {phase === 'polling' && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-zinc-600 text-center">Processing import job…</p>
              <div className="h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400 text-center">{progress}% complete</p>
            </div>
          )}

          {/* ---- Done phase ---- */}
          {phase === 'done' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">Import complete</p>
              </div>
              {result && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-green-700">{result.auto_mapped}</p>
                    <p className="text-xs text-green-600">Auto-mapped</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-amber-700">{result.review_queue}</p>
                    <p className="text-xs text-amber-600">Needs review</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-zinc-600">{result.rejected}</p>
                    <p className="text-xs text-zinc-500">Rejected</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
                {(result?.review_queue ?? 0) > 0 && (
                  <Button asChild className="bg-amber-400 text-white hover:bg-amber-500">
                    <a href={`/admin/suppliers/${supplierId}/review`}>Review mappings →</a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ---- Error phase ---- */}
          {phase === 'error' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm font-medium">Import failed</p>
              </div>
              <p className="text-xs text-zinc-500">{error}</p>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
                <Button type="button" onClick={() => setPhase('map')}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

