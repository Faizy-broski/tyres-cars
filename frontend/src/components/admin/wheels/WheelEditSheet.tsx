'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import WheelForm from './WheelForm'
import type { AdminWheelDetail, WheelBrand } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  wheelId: string | null
  brands:  WheelBrand[]
  open:    boolean
  onClose: () => void
  onSaved: () => void
}

export function WheelEditSheet({ wheelId, brands, open, onClose, onSaved }: Props) {
  const [wheel,     setWheel]     = useState<AdminWheelDetail | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open || !wheelId) return
    async function load() {
      setLoading(true)
      setConfirmDel(false)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/admin/wheels/${wheelId}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!res.ok) throw new Error('Failed to load wheel')
        setWheel(await res.json())
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load wheel')
        onClose()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, wheelId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!wheel) return
    setDeleting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/wheels/${wheel.wheel_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      toastSuccess('Wheel deleted')
      onSaved()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete wheel')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={wheel ? `Edit Wheel — ${wheel.model_name}` : 'Edit Wheel'}
      width="w-full max-w-2xl"
    >
      {loading || !wheel ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-zinc-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          {!confirmDel ? (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Wheel
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-red-700">Delete <strong>{wheel.model_name}</strong>? This fails if variants exist.</p>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setConfirmDel(false)} disabled={deleting}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}

          <WheelForm wheel={wheel} brands={brands} onSuccess={onSaved} onCancel={onClose} />
        </>
      )}
    </Sheet>
  )
}
