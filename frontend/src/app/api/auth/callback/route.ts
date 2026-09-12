import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // PKCE flow — code from OAuth or magic link
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)
    return NextResponse.redirect(`${siteUrl}${next}`)
  }

  // Email OTP flow — token_hash from invite / recovery emails
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'recovery' | 'invite' | 'email' })
    if (error) return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)

    // Recovery emails → password update page
    if (type === 'recovery') return NextResponse.redirect(`${siteUrl}/update-password`)

    // Invite emails → role-based redirect (server-side)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role?: string } | null)?.role
      if (role === 'super_admin') return NextResponse.redirect(`${siteUrl}/admin/dashboard`)
    }
    return NextResponse.redirect(`${siteUrl}${next}`)
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)
}
