'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Search, SlidersHorizontal, X, ChevronDown, Ruler, Tag, RotateCcw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useCartStore } from '@/stores/cart.store'
import type { TyreSku, TyreFacets, TyreSearchFilters } from '@/lib/supabase/search.types'
import { PAGE_SIZE } from '@/lib/supabase/search.types'
import TyreCard from './TyreCard'
import MatchedSizeBar from './MatchedSizeBar'
import TyreCarousel from './TyreCarousel'

const SPEED_RATINGS = ['H', 'V', 'W', 'Y', 'ZR']

type SortOption = 'price_asc' | 'price_desc' | 'stock_desc' | 'updated_at_desc'

interface InitialParams extends TyreSearchFilters {
  q:    string
  page: number
  sort: SortOption
}

interface Props {
  initialResult: { data: TyreSku[]; total: number } | null
  initialFacets: TyreFacets | null
  initialError:  string | null
  initialParams: InitialParams
}

function buildQuery(filters: InitialParams): string {
  const p = new URLSearchParams()
  if (filters.q)        p.set('q',        filters.q)
  if (filters.width)    p.set('width',    String(filters.width))
  if (filters.profile)  p.set('profile',  String(filters.profile))
  if (filters.rim_size) p.set('rim_size', String(filters.rim_size))
  if (filters.brand_id) p.set('brand_id', filters.brand_id)
  if (filters.runflat != null) p.set('runflat', String(filters.runflat))
  if (filters.xl != null)      p.set('xl',      String(filters.xl))
  if (filters.speed)    p.set('speed',    filters.speed)
  if (filters.app_type) p.set('app_type', filters.app_type)
  if (filters.price_min != null) p.set('price_min', String(filters.price_min))
  if (filters.price_max != null) p.set('price_max', String(filters.price_max))
  if (filters.sort !== 'updated_at_desc') p.set('sort', filters.sort)
  if (filters.page > 1) p.set('page',    String(filters.page))
  return p.toString()
}

function FilterSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 text-primary shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em]">{title}</p>
      </div>
      {children}
    </div>
  )
}

function DimensionSelect({ label, short, value, options, onChange }: {
  label:    string
  short:    string
  value:    number | undefined
  options:  number[]
  onChange: (v: number | undefined) => void
}) {
  const active = value != null
  return (
    <div className="flex-1 min-w-0">
      <div className={`relative rounded-xl border transition-colors ${active ? 'border-primary bg-primary/10' : 'border-zinc-200 bg-zinc-50'}`}>
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
          aria-label={label}
          className={`w-full appearance-none bg-transparent px-2.5 pt-4 pb-1.5 text-sm font-bold focus:outline-none cursor-pointer transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}
        >
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute left-2.5 top-1 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">{short}</span>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
      </div>
    </div>
  )
}

function FeatureToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5 group/toggle">
      <span className="text-sm font-medium text-zinc-600 group-hover/toggle:text-zinc-900 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-zinc-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-2 py-1 text-xs font-bold text-zinc-800 hover:bg-primary/20 transition-colors whitespace-nowrap"
    >
      {label}
      <X className="w-3 h-3 text-zinc-500" />
    </button>
  )
}

export default function TyresListingClient({ initialResult, initialFacets, initialError, initialParams }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const [filters, setFilters] = useState<InitialParams>(initialParams)
  const [searchInput, setSearchInput] = useState(initialParams.q)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [priceMinInput, setPriceMinInput] = useState(initialParams.price_min?.toString() ?? '')
  const [priceMaxInput, setPriceMaxInput] = useState(initialParams.price_max?.toString() ?? '')
  const searchRef  = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const { addItem } = useCartStore()

  const result = initialResult
  const facets = initialFacets

  const brandSuggestions = searchInput.trim().length >= 2
    ? (facets?.brands ?? []).filter(b =>
        b.brand_name.toLowerCase().includes(searchInput.toLowerCase())
      ).slice(0, 6)
    : []

  function navigate(next: InitialParams) {
    const qs = buildQuery(next)
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  function updateFilter<K extends keyof InitialParams>(key: K, value: InitialParams[K]) {
    const next = { ...filters, [key]: value, ...(key !== 'page' && { page: 1 }) } as InitialParams
    setFilters(next)
    navigate(next)
  }

  function clearAll() {
    const clean: InitialParams = { q: '', page: 1, sort: 'updated_at_desc' }
    setFilters(clean)
    setSearchInput('')
    setPriceMinInput('')
    setPriceMaxInput('')
    startTransition(() => { router.push(pathname) })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateFilter('q', searchInput)
  }

  function handleNotYourSize() {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
    if (!isDesktop) {
      setShowMobileFilters(true)
      return
    }
    const el = document.getElementById('tyre-size-filter')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('ring-2', 'ring-primary', 'rounded-xl')
    setTimeout(() => el?.classList.remove('ring-2', 'ring-primary', 'rounded-xl'), 1200)
  }

  // Debounce price-range inputs so we don't fire a search on every keystroke
  useEffect(() => {
    const min = priceMinInput ? Number(priceMinInput) : undefined
    const max = priceMaxInput ? Number(priceMaxInput) : undefined
    if (min === filters.price_min && max === filters.price_max) return
    const t = setTimeout(() => {
      const next = { ...filters, price_min: min, price_max: max, page: 1 } as InitialParams
      setFilters(next)
      navigate(next)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMinInput, priceMaxInput])

  async function handleAddToCart(hit: TyreSku) {
    const res = await addItem({
      id:    hit.product_id,
      sku:   hit.sku,
      name:  `${hit.brand_name} ${hit.pattern_name}`,
      size:  hit.tyre_size_display,
      price: hit.price_inc_gst ?? 0,
      image: hit.main_image?.startsWith('http') ? hit.main_image : null,
      stock: hit.total_stock,
    }, 1)
    if (res.error === 'out_of_stock') {
      alert('Sorry, this item is out of stock.')
    } else if (res.error === 'insufficient_stock') {
      alert(`Only ${res.available} unit(s) available. Cart updated to maximum.`)
    }
  }

  const hasPriceRange = filters.price_min != null || filters.price_max != null

  const hasActiveFilters = !!(
    filters.width || filters.profile || filters.rim_size ||
    filters.brand_id || filters.runflat != null || filters.xl != null ||
    filters.speed || filters.q || hasPriceRange
  )

  const totalPages  = result ? Math.ceil(result.total / PAGE_SIZE) : 1
  const currentPage = filters.page

  const detailsCount    = [filters.width, filters.profile, filters.rim_size, filters.speed, filters.runflat, filters.xl].filter(v => v != null).length
  const additionalCount = (filters.brand_id ? 1 : 0) + (hasPriceRange ? 1 : 0)

  function clearPriceRange() {
    setPriceMinInput('')
    setPriceMaxInput('')
    const next = { ...filters, price_min: undefined, price_max: undefined, page: 1 } as InitialParams
    setFilters(next)
    navigate(next)
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.q)        activeChips.push({ key: 'q',        label: `"${filters.q}"`,                              onRemove: () => { setSearchInput(''); updateFilter('q', '') } })
  if (filters.width)    activeChips.push({ key: 'width',    label: `Width ${filters.width}`,                       onRemove: () => updateFilter('width',    undefined) })
  if (filters.profile)  activeChips.push({ key: 'profile',  label: `Profile ${filters.profile}`,                   onRemove: () => updateFilter('profile',  undefined) })
  if (filters.rim_size) activeChips.push({ key: 'rim_size', label: `Rim ${filters.rim_size}"`,                     onRemove: () => updateFilter('rim_size', undefined) })
  if (filters.brand_id) activeChips.push({ key: 'brand_id', label: facets?.brands.find(b => b.brand_id === filters.brand_id)?.brand_name ?? 'Brand', onRemove: () => updateFilter('brand_id', undefined) })
  if (filters.runflat)  activeChips.push({ key: 'runflat',  label: 'Runflat',                                      onRemove: () => updateFilter('runflat', undefined) })
  if (filters.xl)       activeChips.push({ key: 'xl',       label: 'XL reinforced',                                onRemove: () => updateFilter('xl', undefined) })
  if (filters.speed)    activeChips.push({ key: 'speed',    label: `Speed ${filters.speed}`,                       onRemove: () => updateFilter('speed', undefined) })
  if (hasPriceRange)    activeChips.push({ key: 'price',    label: `$${filters.price_min ?? facets?.price_range.min ?? 0}–$${filters.price_max ?? facets?.price_range.max ?? ''}`, onRemove: clearPriceRange })

  const filterPanel = (
    <div className="space-y-5">
      <FilterSection title="Search" icon={Search}>
        <form onSubmit={handleSearch}>
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Brand, size, pattern..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-colors"
            />
            {showSuggestions && brandSuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                {brandSuggestions.map(b => (
                  <li key={b.brand_id}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        updateFilter('brand_id', b.brand_id)
                        setSearchInput('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-zinc-700 hover:bg-primary/10 flex items-center gap-2 transition-colors"
                    >
                      <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Brand</span>
                      {b.brand_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </FilterSection>

      <Accordion type="multiple" defaultValue={['details', 'additional']} className="space-y-1">
        <AccordionItem value="details" className="border-b-0">
          <AccordionTrigger className="py-3 hover:no-underline [&>svg]:hidden">
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 text-primary shrink-0">
                <Ruler className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Tyre Details</span>
              {detailsCount > 0 && (
                <span className="flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary text-[9px] font-black text-zinc-900 px-1">{detailsCount}</span>
              )}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform group-aria-expanded/accordion-trigger:rotate-180" />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-0" id="tyre-size-filter">
            <div className="flex items-stretch gap-1.5">
              <DimensionSelect label="Width"   short="W" value={filters.width}    options={facets?.widths    ?? []} onChange={v => updateFilter('width',    v)} />
              <span className="self-center text-zinc-300 font-bold pt-2">/</span>
              <DimensionSelect label="Profile" short="P" value={filters.profile}  options={facets?.profiles  ?? []} onChange={v => updateFilter('profile',  v)} />
              <span className="self-center text-zinc-300 font-bold pt-2">R</span>
              <DimensionSelect label="Rim"     short="R" value={filters.rim_size} options={facets?.rim_sizes ?? []} onChange={v => updateFilter('rim_size', v)} />
            </div>

            <div className="relative">
              <select
                value={filters.speed ?? ''}
                onChange={e => updateFilter('speed', e.target.value || undefined)}
                className="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white pr-8 cursor-pointer transition-colors"
              >
                <option value="">Any Speed Rating</option>
                {SPEED_RATINGS.map(sr => <option key={sr} value={sr}>{sr}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            <div className="divide-y divide-zinc-100">
              <FeatureToggle label="Runflat only"  checked={!!filters.runflat} onChange={v => updateFilter('runflat', v ? true : undefined)} />
              <FeatureToggle label="XL reinforced" checked={!!filters.xl}      onChange={v => updateFilter('xl',      v ? true : undefined)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additional" className="border-b-0">
          <AccordionTrigger className="py-3 hover:no-underline [&>svg]:hidden">
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 text-primary shrink-0">
                <Tag className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Additional Filters</span>
              {additionalCount > 0 && (
                <span className="flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary text-[9px] font-black text-zinc-900 px-1">{additionalCount}</span>
              )}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform group-aria-expanded/accordion-trigger:rotate-180" />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-0">
            {(facets?.brands?.length ?? 0) > 0 && (
              <div className="relative">
                <select
                  value={filters.brand_id ?? ''}
                  onChange={e => updateFilter('brand_id', e.target.value || undefined)}
                  className="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white pr-8 cursor-pointer transition-colors"
                >
                  <option value="">Any Brand</option>
                  {facets!.brands.map(b => (
                    <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Price Range</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={priceMinInput}
                  onChange={e => setPriceMinInput(e.target.value)}
                  placeholder={facets?.price_range.min != null ? `$${facets.price_range.min}` : 'Min'}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-colors"
                />
                <span className="text-zinc-300 font-bold">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={priceMaxInput}
                  onChange={e => setPriceMaxInput(e.target.value)}
                  placeholder={facets?.price_range.max != null ? `$${facets.price_range.max}` : 'Max'}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-colors"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-red-500 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* ── Hero banner (the Navbar floats over this) ── */}
      <section className="relative bg-zinc-900 overflow-hidden -mt-[104px]">
        {/* Subtle tyre watermark */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[400px] opacity-[0.04]">
          <Image src="/tyre.svg" alt="" fill className="object-contain object-right" />
        </div>
        {/* Left vector accent */}
        <div className="pointer-events-none absolute inset-0 bg-[url('/leftvector.svg')] bg-[position:left_center] bg-no-repeat opacity-10" />

        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 pt-32 pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2">Tyre Vault</p>
              <h1 className="font-oswald text-4xl sm:text-5xl font-bold text-white uppercase tracking-wide leading-none">
                Shop Tyres
              </h1>
              {result && (
                <p className="mt-2 text-sm text-zinc-400 font-medium">
                  {result.total.toLocaleString()} tyre{result.total !== 1 ? 's' : ''} found
                </p>
              )}
            </div>

            {/* Sort — desktop */}
            <div className="hidden sm:flex items-center gap-2 pb-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Sort by</span>
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={e => updateFilter('sort', e.target.value as SortOption)}
                  className="appearance-none rounded-full border border-white/15 bg-white/10 backdrop-blur-sm text-zinc-100 font-medium px-4 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 hover:bg-white/15 cursor-pointer transition-colors"
                >
                  <option value="updated_at_desc">Newest</option>
                  <option value="stock_desc">In stock first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom edge fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-zinc-50" />
      </section>

      {/* ── Main listing layout ── */}
      <div className="mx-auto max-w-[1400px] px-4 pb-6 sm:px-6 lg:px-10">

        {/* Matched-size summary + "popular in your size" carousel */}
        {filters.width != null && filters.profile != null && filters.rim_size != null && (
          <div className="mb-6">
            <MatchedSizeBar
              width={filters.width}
              profile={filters.profile}
              rimSize={filters.rim_size}
              onNotYourSize={handleNotYourSize}
            />
            <div className="mt-4">
              <TyreCarousel
                width={filters.width}
                profile={filters.profile}
                rimSize={filters.rim_size}
                onAddToCart={handleAddToCart}
              />
            </div>
          </div>
        )}

        <h2 className="font-oswald text-lg font-bold text-zinc-900 uppercase tracking-wide mb-3">Browse our full range</h2>

        {/* Mobile top bar */}
        <div className="flex items-center justify-between gap-3 mb-3 sm:hidden">
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="relative flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-black text-zinc-900 px-1">
                {activeChips.length}
              </span>
            )}
          </button>
          <div className="relative">
            <select
              value={filters.sort}
              onChange={e => updateFilter('sort', e.target.value as SortOption)}
              className="appearance-none rounded-full border border-zinc-200 bg-white text-zinc-700 font-semibold px-4 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm"
            >
              <option value="updated_at_desc">Newest</option>
              <option value="stock_desc">In stock first</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
            {activeChips.map(chip => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors whitespace-nowrap px-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Mobile full-screen filter modal */}
        {showMobileFilters && (
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100 shrink-0">
              <div className="w-9" />
              <h2 className="font-oswald text-lg font-bold text-zinc-900 uppercase tracking-wide">Filters</h2>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filterPanel}
            </div>
            <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-zinc-100 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-black text-zinc-900 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Show {result ? result.total.toLocaleString() : ''} tyres
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop filter sidebar */}
          <aside className="hidden sm:block w-56 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-oswald text-base font-bold text-zinc-900 uppercase tracking-wide">Filters</h2>
              </div>
              {filterPanel}
            </div>
          </aside>

          {/* Results area */}
          <div ref={resultsRef} className="flex-1 min-w-0">
            {initialError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-700 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                Search unavailable: {initialError}
              </div>
            )}

            {/* Empty state */}
            {!pending && result && result.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-5">
                  <Search className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="font-oswald text-xl font-bold text-zinc-700 uppercase tracking-wide">No tyres found</p>
                <p className="text-sm text-zinc-400 mt-2">Try adjusting your size or removing some filters</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-zinc-900 hover:brightness-110 active:scale-95 transition-all"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Results grid */}
            {result && result.data.length > 0 && (
              <div className="relative">
                {/* Spinner overlay while transitioning */}
                {pending && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-50/70 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-4 border-zinc-200" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading</span>
                    </div>
                  </div>
                )}

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity duration-200 ${pending ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  {result.data.map(hit => (
                    <TyreCard key={hit.product_id} hit={hit} onAddToCart={handleAddToCart} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-10">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || pending}
                      onClick={() => {
                        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        updateFilter('page', currentPage - 1)
                      }}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm font-medium text-zinc-500 min-w-[80px] text-center">
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || pending}
                      onClick={() => {
                        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        updateFilter('page', currentPage + 1)
                      }}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

