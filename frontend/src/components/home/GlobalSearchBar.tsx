'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TyreSku } from '@/lib/supabase/search.types'

interface Props {
  fullWidth?: boolean
  autoFocus?: boolean
}

export default function GlobalSearchBar({ fullWidth, autoFocus }: Props = {}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TyreSku[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('search_tyres', {
        p_q: q,
        p_page: 1,
        p_limit: 6,
      })
      if (error) throw error
      setResults((data ?? []) as TyreSku[])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => search(val.trim()), 300)
  }

  const navigate = (item: TyreSku) => {
    const dest = item.product_slug ? `/tyres/${item.product_slug}` : `/tyres?q=${encodeURIComponent(item.sku)}`
    setOpen(false)
    setQuery('')
    router.push(dest)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) {
        navigate(results[activeIndex])
      } else if (query.trim()) {
        setOpen(false)
        setQuery('')
        router.push(`/tyres?q=${encodeURIComponent(query.trim())}`)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  // Outside click closes dropdown
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const displayPrice = (item: TyreSku) => {
    const price = item.promo_price ?? item.price_inc_gst
    if (price == null) return null
    return `$${price.toFixed(2)}`
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none z-10" />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 animate-spin pointer-events-none z-10" />
      )}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="Search tyres, brand or SKU..."
        autoComplete="off"
        autoFocus={autoFocus}
        className={`h-10 rounded-full border border-white/15 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-primary transition-all ${fullWidth ? 'w-full' : 'w-64'}`}
      />

      {open && (results.length > 0 || loading) && (
        <div className={`absolute top-full mt-2 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl z-50 overflow-hidden ${fullWidth ? 'left-0 right-0' : 'right-0 w-80'}`}>
          {results.length === 0 && loading ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">Searching…</div>
          ) : (
            <>
              <ul>
                {results.map((item, i) => (
                  <li key={item.product_id}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); navigate(item) }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        i === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-md bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {item.main_image ? (
                          <Image
                            src={item.main_image}
                            alt={item.pattern_name}
                            width={40}
                            height={40}
                            className="object-contain w-full h-full"
                          />
                        ) : (
                          <Search className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.brand_name} {item.pattern_name}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{item.tyre_size_display}</p>
                      </div>
                      {displayPrice(item) && (
                        <span className={`text-sm font-semibold flex-shrink-0 ${item.promo_price ? 'text-primary' : 'text-white'}`}>
                          {displayPrice(item)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/10 px-4 py-2.5">
                <Link
                  href={`/tyres?q=${encodeURIComponent(query.trim())}`}
                  onMouseDown={() => setOpen(false)}
                  className="text-xs text-primary hover:underline"
                >
                  See all results for &quot;{query}&quot;
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {open && results.length === 0 && !loading && query.trim().length >= 2 && (
        <div className={`absolute top-full mt-2 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl z-50 px-4 py-6 text-center text-sm text-zinc-500 ${fullWidth ? 'left-0 right-0' : 'right-0 w-80'}`}>
          No results for &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
