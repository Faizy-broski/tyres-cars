import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 600

interface Props {
  params: Promise<{ slug: string; patternSlug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug: brandSlug, patternSlug } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('patterns')
    .select('pattern_name, brands!inner(brand_name, brand_slug)')
    .eq('pattern_slug', patternSlug)
    .eq('brands.brand_slug', brandSlug)
    .limit(1)
    .single()

  if (!data) return { title: 'Tyre Model Not Found' }
  const brand = Array.isArray(data.brands) ? data.brands[0] : data.brands
  return {
    title: `${(brand as any)?.brand_name ?? ''} ${data.pattern_name} — All Sizes | Onyx Tyres`.trim(),
  }
}

export default async function PatternPage({ params }: Props) {
  const { slug: brandSlug, patternSlug } = await params
  await connection()

  const supabase = createAdminClient()

  const { data: patternRow } = await supabase
    .from('patterns')
    .select('pattern_id, pattern_name, pattern_short_description, is_active, show_on_website, brands!inner(brand_name, brand_slug, is_active, show_on_website)')
    .eq('pattern_slug', patternSlug)
    .eq('brands.brand_slug', brandSlug)
    .limit(1)
    .single()

  if (!patternRow) notFound()

  const brand = (Array.isArray(patternRow.brands) ? patternRow.brands[0] : patternRow.brands) as {
    brand_name: string; brand_slug: string; is_active: boolean; show_on_website: boolean
  } | null

  if (!patternRow.is_active || !patternRow.show_on_website) notFound()
  if (!brand?.is_active || !brand?.show_on_website) notFound()

  const { data: skusRaw } = await supabase
    .from('skus')
    .select('product_id, product_slug, tyre_size_display, width, profile, rim_size, runflat, xl_reinforced, total_available_stock, product_prices(price_type, price_inc_gst)')
    .eq('pattern_id', patternRow.pattern_id)
    .eq('status', 'active')
    .order('width')
    .order('profile')
    .order('rim_size')

  const skus = (skusRaw ?? []).map(s => {
    const retail = (s.product_prices as any[])?.find(
      (p: { price_type: string }) => p.price_type === 'retail'
    )?.price_inc_gst ?? null
    return { ...s, retail_price: retail as number | null }
  })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <nav className="text-xs text-zinc-400 mb-6 flex items-center gap-1.5">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <span>/</span>
        <Link href="/tyres" className="hover:text-primary transition-colors">Tyres</Link>
        <span>/</span>
        <span className="text-zinc-600">{brand?.brand_name}</span>
        <span>/</span>
        <span className="text-zinc-600">{patternRow.pattern_name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-zinc-900 mb-1">
        {brand?.brand_name} {patternRow.pattern_name}
      </h1>
      {patternRow.pattern_short_description && (
        <p className="text-sm text-zinc-500 mb-6">{patternRow.pattern_short_description}</p>
      )}

      {skus.length === 0 ? (
        <p className="text-zinc-400 text-sm mt-8">No sizes currently available for this model.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="pb-2 pr-4">Size</th>
                <th className="pb-2 pr-4">Features</th>
                <th className="pb-2 pr-4">Stock</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {skus.map(s => (
                <tr key={s.product_id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-zinc-800">{s.tyre_size_display ?? `${s.width}/${s.profile}R${s.rim_size}`}</td>
                  <td className="py-3 pr-4 text-zinc-500 text-xs space-x-1">
                    {s.runflat && <span className="bg-zinc-100 rounded px-1.5 py-0.5">Runflat</span>}
                    {s.xl_reinforced && <span className="bg-zinc-100 rounded px-1.5 py-0.5">XL</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {(s.total_available_stock ?? 0) > 0
                      ? <span className="text-emerald-600 font-medium text-xs">In Stock</span>
                      : <span className="text-zinc-400 text-xs">Out of Stock</span>}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-zinc-900">
                    {s.retail_price != null ? `PKR ${s.retail_price.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 text-right">
                    {s.product_slug ? (
                      <Link
                        href={`/tyres/${s.product_slug}`}
                        className="inline-block text-xs font-semibold text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary hover:text-white transition-colors"
                      >
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <Link href="/tyres" className="text-sm text-zinc-400 hover:text-primary transition-colors">← Back to all tyres</Link>
      </div>
    </main>
  )
}
