'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import type { AdminVehicleDetail } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Row types ─────────────────────────────────────────────────────────────────

type TyreRow = {
  _key:         number
  fitment_id?:  string
  front_size:   string
  rear_size:    string
  is_staggered: boolean
  notes:        string
}

type WheelRow = {
  _key:           number
  fitment_id?:    string
  pcd:            string
  diameter_range: string
  width_range:    string
  offset_min:     string
  offset_max:     string
  centre_bore:    string
  notes:          string
}

let _tyreKey  = 1
let _wheelKey = 1

function newTyreRow(): TyreRow {
  return { _key: _tyreKey++, front_size: '', rear_size: '', is_staggered: false, notes: '' }
}
function newWheelRow(): WheelRow {
  return { _key: _wheelKey++, pcd: '', diameter_range: '', width_range: '', offset_min: '', offset_max: '', centre_bore: '', notes: '' }
}

interface Props {
  vehicle?:  AdminVehicleDetail | null   // omit/null = create mode
  onSuccess: () => void
  onCancel:  () => void
}

export default function VehicleForm({ vehicle, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(vehicle)

  const [saving, setSaving] = useState(false)

  // Vehicle fields
  const [make,     setMake]     = useState(vehicle?.make ?? '')
  const [model,    setModel]    = useState(vehicle?.model ?? '')
  const [yearFrom, setYearFrom] = useState(vehicle ? String(vehicle.year_from) : '')
  const [yearTo,   setYearTo]   = useState(vehicle?.year_to != null ? String(vehicle.year_to) : '')
  const [series,   setSeries]   = useState(vehicle?.series ?? '')
  const [variant,  setVariant]  = useState(vehicle?.variant ?? '')
  const [bodyType, setBodyType] = useState(vehicle?.body_type ?? '')

  // Fitment rows
  const [tyreRows, setTyreRows] = useState<TyreRow[]>(
    () => (vehicle?.vehicle_tyre_fitments ?? []).map(f => ({
      _key: _tyreKey++, fitment_id: f.fitment_id,
      front_size: f.front_size, rear_size: f.rear_size ?? '',
      is_staggered: f.is_staggered, notes: f.notes ?? '',
    }))
  )
  const [wheelRows, setWheelRows] = useState<WheelRow[]>(
    () => (vehicle?.vehicle_wheel_fitments ?? []).map(f => ({
      _key: _wheelKey++, fitment_id: f.fitment_id,
      pcd: f.pcd, diameter_range: f.diameter_range ?? '', width_range: f.width_range ?? '',
      offset_min: f.offset_min != null ? String(f.offset_min) : '',
      offset_max: f.offset_max != null ? String(f.offset_max) : '',
      centre_bore: f.centre_bore != null ? String(f.centre_bore) : '',
      notes: f.notes ?? '',
    }))
  )
  const [removedTyreIds,  setRemovedTyreIds]  = useState<string[]>([])
  const [removedWheelIds, setRemovedWheelIds] = useState<string[]>([])

  function updateTyre(key: number, field: keyof Omit<TyreRow, '_key' | 'fitment_id'>, val: string | boolean) {
    setTyreRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r))
  }
  function removeTyre(key: number) {
    const row = tyreRows.find(r => r._key === key)
    if (row?.fitment_id) setRemovedTyreIds(prev => [...prev, row.fitment_id!])
    setTyreRows(prev => prev.filter(r => r._key !== key))
  }

  function updateWheel(key: number, field: keyof Omit<WheelRow, '_key' | 'fitment_id'>, val: string) {
    setWheelRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r))
  }
  function removeWheel(key: number) {
    const row = wheelRows.find(r => r._key === key)
    if (row?.fitment_id) setRemovedWheelIds(prev => [...prev, row.fitment_id!])
    setWheelRows(prev => prev.filter(r => r._key !== key))
  }

  async function handleSubmit() {
    if (!make.trim())  { toastError('Make is required'); return }
    if (!model.trim()) { toastError('Model is required'); return }
    if (!yearFrom)      { toastError('Year From is required'); return }

    const filledTyres  = tyreRows.filter(r => r.front_size.trim())
    for (const r of filledTyres) {
      if (!r.front_size.trim()) { toastError('Tyre fitment: Front size is required'); return }
    }
    const filledWheels = wheelRows.filter(r => r.pcd.trim())
    for (const r of filledWheels) {
      if (!r.pcd.trim()) { toastError('Wheel fitment: PCD is required'); return }
    }

    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token ?? ''

      const vehicleBody = {
        make:      make.trim(),
        model:     model.trim(),
        year_from: Number(yearFrom),
        year_to:   yearTo ? Number(yearTo) : null,
        series:    series.trim()   || null,
        variant:   variant.trim()  || null,
        body_type: bodyType.trim() || null,
      }

      let vehicleId: string
      if (isEdit) {
        const res = await fetch(`${API}/api/admin/vehicles/${vehicle!.vehicle_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(vehicleBody),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
        vehicleId = vehicle!.vehicle_id
      } else {
        const res = await fetch(`${API}/api/admin/vehicles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(vehicleBody),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
        vehicleId = (await res.json()).vehicle_id
      }

      // Deletions
      for (const fid of removedTyreIds) {
        const res = await fetch(`${API}/api/admin/vehicles/${vehicleId}/tyre-fitments/${fid}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Deleting tyre fitment: ${b.error ?? `HTTP ${res.status}`}`) }
      }
      for (const fid of removedWheelIds) {
        const res = await fetch(`${API}/api/admin/vehicles/${vehicleId}/wheel-fitments/${fid}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Deleting wheel fitment: ${b.error ?? `HTTP ${res.status}`}`) }
      }

      // Tyre creates / updates
      for (const r of filledTyres) {
        const body = {
          front_size:   r.front_size.trim(),
          rear_size:    r.rear_size.trim() || null,
          is_staggered: r.is_staggered,
          notes:        r.notes.trim()     || null,
        }
        const url    = r.fitment_id
          ? `${API}/api/admin/vehicles/${vehicleId}/tyre-fitments/${r.fitment_id}`
          : `${API}/api/admin/vehicles/${vehicleId}/tyre-fitments`
        const res = await fetch(url, {
          method: r.fitment_id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Tyre fitment "${r.front_size}": ${b.error ?? `HTTP ${res.status}`}`) }
      }

      // Wheel creates / updates
      for (const r of filledWheels) {
        const body = {
          pcd:            r.pcd.trim(),
          diameter_range: r.diameter_range.trim() || null,
          width_range:    r.width_range.trim()    || null,
          offset_min:     r.offset_min  ? Number(r.offset_min)  : null,
          offset_max:     r.offset_max  ? Number(r.offset_max)  : null,
          centre_bore:    r.centre_bore ? Number(r.centre_bore) : null,
          notes:          r.notes.trim()          || null,
        }
        const url    = r.fitment_id
          ? `${API}/api/admin/vehicles/${vehicleId}/wheel-fitments/${r.fitment_id}`
          : `${API}/api/admin/vehicles/${vehicleId}/wheel-fitments`
        const res = await fetch(url, {
          method: r.fitment_id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Wheel fitment "${r.pcd}": ${b.error ?? `HTTP ${res.status}`}`) }
      }

      toastSuccess(isEdit ? 'Vehicle updated' : 'Vehicle created')
      onSuccess()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save vehicle')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Vehicle Details ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-800 mb-4">Vehicle Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Make <span className="text-red-500">*</span></label>
            <Input className="mt-1" value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Toyota" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Model <span className="text-red-500">*</span></label>
            <Input className="mt-1" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Hilux" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Year From <span className="text-red-500">*</span></label>
            <Input type="number" className="mt-1" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="e.g. 2015" min={1900} max={2100} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Year To</label>
            <Input type="number" className="mt-1" value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="e.g. 2024 (blank = current)" min={1900} max={2100} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Series</label>
            <Input className="mt-1" value={series} onChange={e => setSeries(e.target.value)} placeholder="e.g. SR5" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Variant / Trim</label>
            <Input className="mt-1" value={variant} onChange={e => setVariant(e.target.value)} placeholder="e.g. 4x4 Dual Cab" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Body Type</label>
            <Input className="mt-1" value={bodyType} onChange={e => setBodyType(e.target.value)} placeholder="e.g. Ute, Sedan, SUV, Wagon" />
          </div>
        </div>
      </div>

      {/* ── Tyre Fitments ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Tyre Fitments</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Compatible tyre sizes for this vehicle. Optional.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setTyreRows(prev => [...prev, newTyreRow()])}>
            <Plus className="h-4 w-4" /> Add Row
          </Button>
        </div>

        {tyreRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">
            No tyre fitments added.{' '}
            <button type="button" className="text-zinc-600 underline hover:text-zinc-900" onClick={() => setTyreRows([newTyreRow()])}>
              Add one
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tyreRows.map((r, idx) => (
              <div key={r._key} className="rounded-lg border border-zinc-200 p-4 bg-zinc-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Fitment {idx + 1}</span>
                  <button type="button" onClick={() => removeTyre(r._key)} className="text-zinc-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Front Size <span className="text-red-500">*</span></label>
                    <Input className="mt-1 h-8 text-sm" value={r.front_size} onChange={e => updateTyre(r._key, 'front_size', e.target.value)} placeholder="e.g. 265/65R17" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Rear Size</label>
                    <Input className="mt-1 h-8 text-sm" value={r.rear_size} onChange={e => updateTyre(r._key, 'rear_size', e.target.value)} placeholder="if staggered" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer">
                      <input type="checkbox" checked={r.is_staggered} onChange={e => updateTyre(r._key, 'is_staggered', e.target.checked)} className="rounded" />
                      Staggered
                    </label>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Notes</label>
                    <Input className="mt-1 h-8 text-sm" value={r.notes} onChange={e => updateTyre(r._key, 'notes', e.target.value)} placeholder="Optional notes" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tyreRows.length > 0 && (
          <Button size="sm" variant="outline" className="mt-3 gap-2 w-full border-dashed" onClick={() => setTyreRows(prev => [...prev, newTyreRow()])}>
            <Plus className="h-4 w-4" /> Add Another Tyre Fitment
          </Button>
        )}
      </div>

      {/* ── Wheel Fitments ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Wheel Fitments</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Compatible wheel specs for this vehicle. Optional.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setWheelRows(prev => [...prev, newWheelRow()])}>
            <Plus className="h-4 w-4" /> Add Row
          </Button>
        </div>

        {wheelRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">
            No wheel fitments added.{' '}
            <button type="button" className="text-zinc-600 underline hover:text-zinc-900" onClick={() => setWheelRows([newWheelRow()])}>
              Add one
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {wheelRows.map((r, idx) => (
              <div key={r._key} className="rounded-lg border border-zinc-200 p-4 bg-zinc-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Fitment {idx + 1}</span>
                  <button type="button" onClick={() => removeWheel(r._key)} className="text-zinc-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600">PCD <span className="text-red-500">*</span></label>
                    <Input className="mt-1 h-8 text-sm" value={r.pcd} onChange={e => updateWheel(r._key, 'pcd', e.target.value)} placeholder="e.g. 5x114.3" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Diameter Range</label>
                    <Input className="mt-1 h-8 text-sm" value={r.diameter_range} onChange={e => updateWheel(r._key, 'diameter_range', e.target.value)} placeholder="e.g. 17-20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Width Range</label>
                    <Input className="mt-1 h-8 text-sm" value={r.width_range} onChange={e => updateWheel(r._key, 'width_range', e.target.value)} placeholder="e.g. 8-9.5" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Offset Min</label>
                    <Input type="number" className="mt-1 h-8 text-sm" value={r.offset_min} onChange={e => updateWheel(r._key, 'offset_min', e.target.value)} placeholder="e.g. 20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Offset Max</label>
                    <Input type="number" className="mt-1 h-8 text-sm" value={r.offset_max} onChange={e => updateWheel(r._key, 'offset_max', e.target.value)} placeholder="e.g. 45" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Centre Bore (mm)</label>
                    <Input type="number" step="0.1" className="mt-1 h-8 text-sm" value={r.centre_bore} onChange={e => updateWheel(r._key, 'centre_bore', e.target.value)} placeholder="e.g. 60.1" />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-xs font-medium text-zinc-600">Notes</label>
                    <Input className="mt-1 h-8 text-sm" value={r.notes} onChange={e => updateWheel(r._key, 'notes', e.target.value)} placeholder="Optional notes" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {wheelRows.length > 0 && (
          <Button size="sm" variant="outline" className="mt-3 gap-2 w-full border-dashed" onClick={() => setWheelRows(prev => [...prev, newWheelRow()])}>
            <Plus className="h-4 w-4" /> Add Another Wheel Fitment
          </Button>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="min-w-32">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Vehicle'}
        </Button>
      </div>
    </div>
  )
}
