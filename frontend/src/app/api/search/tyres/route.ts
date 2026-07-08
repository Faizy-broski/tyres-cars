import { NextRequest, NextResponse } from 'next/server'
import { searchTyres } from '@/lib/supabase/search'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '6', 10), 10)

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const { data } = await searchTyres({ q, page: 1 })
    return NextResponse.json({ results: data.slice(0, limit) })
  } catch (err) {
    console.error('[api/search/tyres] search_tyres RPC failed:', err)
    return NextResponse.json({ results: [] })
  }
}
