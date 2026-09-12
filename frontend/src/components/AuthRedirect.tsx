'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Handles the case where an authenticated user lands on the root page
// (e.g. after OAuth, or navigating back after login)
export default function AuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()

      const role = (profile as { role?: string } | null)?.role
      if (role === 'super_admin') router.push('/admin/dashboard')
    })
  }, [router])

  return null
}

