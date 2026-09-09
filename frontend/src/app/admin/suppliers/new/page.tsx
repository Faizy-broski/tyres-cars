'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SupplierFormClient from '@/components/admin/suppliers/SupplierFormClient'

export default function NewSupplierPage() {
  const [token, setToken]     = useState('')
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    document.title = 'Add Supplier | Tyres & Car Valeting'
    createClient().auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? '')
      setReady(true)
    })
  }, [])

  if (!ready) return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
      <div className="h-6 w-32 bg-zinc-100 rounded animate-pulse" />
      <div className="h-64 bg-zinc-100 rounded-2xl animate-pulse" />
    </div>
  )

  return <SupplierFormClient accessToken={token} />
}
