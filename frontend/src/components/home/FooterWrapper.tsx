import { createClient } from '@/lib/supabase/server'
import FooterSection, { type FooterTopSection } from './FooterSection'
import { ECOMMERCE_ENABLED } from '@/lib/features'

export default async function FooterWrapper() {
  // Tyre brand / model / size link columns only make sense with the shop enabled.
  if (!ECOMMERCE_ENABLED) return <FooterSection topSections={[]} />

  const supabase = await createClient()

  const [brandsRes, patternsRes, sizesRes] = await Promise.all([
    supabase
      .from('brands')
      .select('brand_name, brand_slug')
      .eq('is_active', true)
      .eq('show_on_website', true)
      .order('brand_name')
      .limit(10),

    supabase
      .from('patterns')
      .select('pattern_name, pattern_slug, brands!inner(brand_name, brand_slug)')
      .eq('is_active', true)
      .eq('show_on_website', true)
      .limit(10),

    supabase
      .from('skus')
      .select('tyre_size_display, width, profile, rim_size')
      .eq('status', 'active')
      .not('tyre_size_display', 'is', null)
      .not('width', 'is', null)
      .order('width')
      .order('profile')
      .order('rim_size')
      .limit(100),
  ])

  // ── Brands ───────────────────────────────────────────────────────────────
  const brands: FooterTopSection = {
    title:     'Top Tyre Brands',
    moreLabel: '...more tyre brands',
    moreHref:  '/tyres',
    items: (brandsRes.data ?? []).map(b => ({
      label: b.brand_name as string,
      href:  `/tyres?brand=${encodeURIComponent((b.brand_slug ?? b.brand_name) as string)}`,
    })),
  }

  // ── Patterns ─────────────────────────────────────────────────────────────
  const patterns: FooterTopSection = {
    title:     'Top Tyre Models',
    moreLabel: '...more tyre models',
    moreHref:  '/tyres',
    items: (patternsRes.data ?? []).map(p => {
      const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands
      const brandSlug   = (brand as { brand_slug: string } | null)?.brand_slug ?? ''
      const patternSlug = p.pattern_slug ?? ''
      return {
        label: `${(brand as { brand_name: string } | null)?.brand_name ?? ''} ${p.pattern_name}`.trim(),
        href:  brandSlug && patternSlug ? `/tyres/${brandSlug}/${patternSlug}` : '/tyres',
      }
    }),
  }

  // ── Sizes — deduplicate by display string ─────────────────────────────
  const seenSizes = new Set<string>()
  const sizeItems = (sizesRes.data ?? [])
    .filter(s => {
      if (!s.tyre_size_display || seenSizes.has(s.tyre_size_display)) return false
      seenSizes.add(s.tyre_size_display)
      return true
    })
    .slice(0, 10)
    .map(s => ({
      label: s.tyre_size_display as string,
      href:  `/tyres?width=${s.width}&profile=${s.profile}&rim_size=${s.rim_size}`,
    }))

  const sizes: FooterTopSection = {
    title:     'Top Tyre Sizes',
    moreLabel: '...more tyre sizes',
    moreHref:  '/tyres',
    items: sizeItems,
  }

  return (
    <FooterSection
      topSections={[brands, patterns, sizes]}
    />
  )
}
