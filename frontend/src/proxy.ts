
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ECOMMERCE_ENABLED, ECOMMERCE_ROUTES } from '@/lib/features'

/**
 * Proxy (Next.js 16 replacement for middleware).
 *
 * Responsibility: refresh the Supabase session cookie on every request.
 * Route protection is handled by layout.tsx files (Server Components),
 * not here — doing DB queries per-request in the proxy is too expensive.
 */
export async function proxy(request: NextRequest) {
  if (!ECOMMERCE_ENABLED) {
    const { pathname } = request.nextUrl
    const hit = ECOMMERCE_ROUTES.find(r => pathname === r || pathname.startsWith(`${r}/`))
    if (hit) {
      const target = hit.startsWith('/admin') ? '/admin/products' : '/book'
      return NextResponse.redirect(new URL(target, request.url))
    }
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Required: refreshes the session so Server Components get a valid user.
  // Do NOT use getSession() here — getUser() validates the JWT server-side.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
