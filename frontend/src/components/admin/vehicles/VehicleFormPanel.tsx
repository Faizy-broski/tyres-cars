'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, X } from 'lucide-react'
import { toastError } from '@/lib/toast'
import VehicleForm from './VehicleForm'
import type { AdminVehicleDetail } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  mode:             'create' | 'edit'
  vehicleId?:       string
  onSaved:          () => void
  onRequestDelete?: (vehicle: AdminVehicleDetail) => void
  onClose?:         () => void
}

export function VehicleFormPanel({
  mode,
  vehicleId,
  onSaved,
  onRequestDelete,
  onClose,
}: Props) {
  const isEdit = mode === 'edit'
  const [vehicle, setVehicle] = useState<AdminVehicleDetail | null>(null)
  const [loading, setLoading] = useState(isEdit && Boolean(vehicleId))

  useEffect(() => {
    if (!isEdit || !vehicleId) {
      setVehicle(null)
      setLoading(false)
      return
    }

    let active = true
    async function loadVehicle() {
      setLoading(true)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/admin/vehicles/${vehicleId}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (res.ok && active) {
          const data: AdminVehicleDetail = await res.json()
          setVehicle(data)
        }
      } catch (err) {
        if (active) toastError(err instanceof Error ? err.message : 'Failed to load vehicle')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadVehicle()
    return () => { active = false }
  }, [isEdit, vehicleId])

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-md overflow-hidden flex flex-col">
      {/* Panel Top Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900">
              {isEdit ? 'Edit Vehicle' : 'New Vehicle'}
            </h2>
            {isEdit && vehicle && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-700">
                {vehicle.year_from}{vehicle.year_to ? `–${vehicle.year_to}` : '+'}
              </span>
            )}
          </div>
          {isEdit && vehicle && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate font-medium">
              {vehicle.make} {vehicle.model}{vehicle.variant ? ` · ${vehicle.variant}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEdit && onRequestDelete && vehicle && (
            <button
              type="button"
              onClick={() => onRequestDelete(vehicle)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              title="Delete vehicle"
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
          <VehicleForm
            key={vehicleId ?? 'new'}
            vehicle={isEdit ? vehicle : null}
            onSuccess={onSaved}
            onCancel={onClose ?? (() => {})}
          />
        )}
      </div>
    </div>
  )
}
