'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, X } from 'lucide-react'
import { toastError } from '@/lib/toast'
import WheelForm from './WheelForm'
import type { AdminWheelDetail, WheelBrand } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  mode:             'create' | 'edit'
  wheelId?:         string
  brands:           WheelBrand[]
  onSaved:          () => void
  onRequestDelete?: (wheel: AdminWheelDetail) => void
  onClose?:         () => void
}

export function WheelFormPanel({
  mode,
  wheelId,
  brands,
  onSaved,
  onRequestDelete,
  onClose,
}: Props) {
  const isEdit = mode === 'edit'
  const [wheel, setWheel]     = useState<AdminWheelDetail | null>(null)
  const [loading, setLoading] = useState(isEdit && Boolean(wheelId))

  useEffect(() => {
    if (!isEdit || !wheelId) {
      setWheel(null)
      setLoading(false)
      return
    }

    let active = true
    async function loadWheel() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/admin/wheels/${wheelId}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (res.ok && active) {
          const data: AdminWheelDetail = await res.json()
          setWheel(data)
        }
      } catch (err) {
        if (active) toastError(err instanceof Error ? err.message : 'Failed to load wheel')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadWheel()
    return () => { active = false }
  }, [isEdit, wheelId])

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-md overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900">
              {isEdit ? 'Edit Wheel' : 'New Wheel'}
            </h2>
            {isEdit && wheel?.is_active !== undefined && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${wheel.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                {wheel.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
          {isEdit && wheel && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {wheel.wheel_brands?.brand_name ? `${wheel.wheel_brands.brand_name} · ` : ''}{wheel.model_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEdit && onRequestDelete && wheel && (
            <button
              type="button"
              onClick={() => onRequestDelete(wheel)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              title="Delete wheel"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {loading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <WheelForm
            key={wheelId ?? 'new'}
            wheel={isEdit ? wheel : null}
            brands={brands}
            onSuccess={onSaved}
            onCancel={onClose ?? (() => {})}
          />
        )}
      </div>
    </div>
  )
}
