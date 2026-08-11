'use client'

import { useEffect, useState } from 'react'
import { toastError } from '@/lib/toast'

interface Props {
  value:        boolean
  onChange:     (next: boolean) => Promise<void>
  trueLabel?:   string
  falseLabel?:  string
  /** Set true when `value === true` is the "bad"/muted state (e.g. hidden_from_website). */
  invert?:      boolean
}

/**
 * Inline status/visibility dropdown for admin list tables — a colored badge that's
 * also a native <select>, so status can be flipped directly from the row with no
 * separate edit step. Stops click propagation so it doesn't also trigger the row's
 * "load into edit panel" behavior.
 */
export function StatusSelect({ value, onChange, trueLabel = 'ACTIVE', falseLabel = 'INACTIVE', invert = false }: Props) {
  const [current, setCurrent] = useState(value)
  const [busy, setBusy]       = useState(false)

  useEffect(() => { setCurrent(value) }, [value])

  const positive = invert ? !current : current

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value === 'true'
    if (next === current || busy) return
    const prev = current
    setCurrent(next)
    setBusy(true)
    try {
      await onChange(next)
    } catch {
      setCurrent(prev)
      toastError('Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <select
      value={String(current)}
      onChange={handleChange}
      disabled={busy}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      className={`appearance-none rounded-full border-0 pl-2.5 pr-6 py-1 text-xs font-bold cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 bg-no-repeat ${
        positive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
      } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23666'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.4rem center',
        backgroundSize: '0.75rem',
      }}
    >
      <option value="true">{trueLabel}</option>
      <option value="false">{falseLabel}</option>
    </select>
  )
}
