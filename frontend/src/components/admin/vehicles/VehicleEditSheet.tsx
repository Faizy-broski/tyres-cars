'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import VehicleForm from './VehicleForm'
import type { AdminVehicleDetail } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  vehicleId: string | null
  open:      boolean
  onClose:   () => void
  onSaved:   () => void
}

export function VehicleEditSheet({ vehicleId, open, onClose, onSaved }: Props) {
  const [vehicle,    setVehicle]    = useState<AdminVehicleDetail | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open || !vehicleId) return
    async function load() {
      setLoading(true)
      setConfirmDel(false)
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/admin/vehicles/${vehicleId}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!res.ok) throw new Error('Failed to load vehicle')
        setVehicle(await res.json())
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load vehicle')
        onClose()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, vehicleId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!vehicle) return
    setDeleting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/vehicles/${vehicle.vehicle_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
      toastSuccess('Vehicle deleted')
      onSaved()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete vehicle')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={vehicle ? `Edit Vehicle — ${vehicle.make} ${vehicle.model}` : 'Edit Vehicle'}
      width="w-full max-w-2xl"
    >
      {loading || !vehicle ? (
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
                <Trash2 className="h-3.5 w-3.5" /> Delete Vehicle
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-red-700">Delete <strong>{vehicle.make} {vehicle.model}</strong>? All fitments will also be deleted.</p>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setConfirmDel(false)} disabled={deleting}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}

          <VehicleForm vehicle={vehicle} onSuccess={onSaved} onCancel={onClose} />
        </>
      )}
    </Sheet>
  )
}
