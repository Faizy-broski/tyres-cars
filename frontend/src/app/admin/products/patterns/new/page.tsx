'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PatternForm, { EMPTY_PATTERN_FORM } from '@/components/admin/brands/PatternForm'
import { toastError } from '@/lib/toast'
import type { Brand } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function NewPatternPage() {
  const [brands, setBrands]   = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/admin/products/brands/all`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!res.ok) throw new Error('Failed to load brands')
        setBrands(await res.json())
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load brands')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />)}
      </div>
    )
  }

  return (
    <PatternForm
      brandId=""
      brands={brands}
      initial={EMPTY_PATTERN_FORM}
    />
  )
}

