'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastSuccess, toastError } from '@/lib/toast'

type Props = {
  productId: string
  patternId: string
  initialAvailableStock?: number | null
  initialLowStockAlert?: number | null
  onSaved?: (values: { availableStock: number; lowStockAlert: number }) => void
}

export default function StockTab({
  productId,
  patternId,
  initialAvailableStock,
  initialLowStockAlert,
  onSaved,
}: Props) {
  const [availableStock, setAvailableStock] = useState(initialAvailableStock ?? 0)
  const [lowStockAlert, setLowStockAlert]   = useState(initialLowStockAlert ?? 10)
  const [saving, setSaving]                 = useState(false)
  const [dirty, setDirty]                   = useState(false)

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  useEffect(() => {
    setAvailableStock(initialAvailableStock ?? 0)
    setLowStockAlert(initialLowStockAlert ?? 10)
    setDirty(false)
  }, [initialAvailableStock, initialLowStockAlert])

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const tok = session?.access_token ?? ''
      const res = await fetch(`${apiBase}/api/admin/products/${patternId}/variants/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ availableStock, lowStockAlert }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDirty(false)
      toastSuccess('Stock updated successfully')
      onSaved?.({ availableStock, lowStockAlert })
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to save stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
      <div>
        <label htmlFor="availableStock" className="block text-sm text-zinc-600 mb-1">
          Available Stock
        </label>
        <Input
          id="availableStock"
          type="number"
          min={0}
          value={availableStock}
          onChange={e => {
            setAvailableStock(Math.max(0, Number(e.target.value)))
            setDirty(true)
          }}
        />
      </div>

      <div>
        <label htmlFor="lowStockAlert" className="block text-sm text-zinc-600 mb-1">
          Low Stock Alert
        </label>
        <Input
          id="lowStockAlert"
          type="number"
          min={0}
          value={lowStockAlert}
          onChange={e => {
            setLowStockAlert(Math.max(0, Number(e.target.value)))
            setDirty(true)
          }}
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={handleSave}>
          {saving && (
            <svg className="w-3.5 h-3.5 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          Save Stock
        </Button>
      </div>
    </div>
  )
}
