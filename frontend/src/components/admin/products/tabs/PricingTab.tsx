'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import type { CreateProductFormValues } from '../schema'

function calcMargin(price: number, cost: number): string {
  if (!price || !cost) return '—'
  return ((1 - cost / price) * 100).toFixed(1) + '%'
}

export default function PricingTab() {
  const { register, control } = useFormContext<CreateProductFormValues>()

  const variants = useWatch({ control, name: 'variants' }) ?? []
  const pricing  = useWatch({ control, name: 'pricing'  }) ?? []

  if (variants.length === 0) {
    // VARIANTS DISABLED — pricing is per-variant; show neutral empty state
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-zinc-400">
          No variants to price. Pricing will be configured after variants are added.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Pricing &amp; Inventory</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Set prices and stock levels for each variant
          </p>
        </div>
      </div>

      <div className="border border-zinc-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              {[
                'Tire Size', 'SKU', 'Price ($)', 'Compare at ($)', 'Cost', 'Margin', 'Inventory', 'Low Stock Alert'
              ].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {variants.map((variant, index) => {
              const p           = pricing[index]
              const price       = p?.priceIncGst ?? 0
              const cost        = p?.costPrice ?? 0
              const margin      = calcMargin(price, cost)
              const marginValue = parseFloat(margin)
              const isGood      = margin !== '—' && marginValue > 0
              const isNegative  = margin !== '—' && marginValue < 0

              return (
                <tr key={index} className="odd:bg-white even:bg-zinc-50 hover:!bg-zinc-200 transition-colors">
                  {/* Tire Size */}
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {variant.tyreSizeDisplay
                      ? variant.tyreSizeDisplay
                      : <span className="text-xs text-zinc-300 italic">Set in Tyre Specs</span>}
                  </td>
                  {/* SKU */}
                  <td className="px-4 py-3 text-zinc-600 text-xs">
                    {variant.sku
                      ? variant.sku
                      : <span className="text-zinc-300 italic">—</span>}
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`pricing.${index}.priceIncGst`, { valueAsNumber: true })}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="0.00"
                      />
                    </div>
                  </td>

                  {/* Compare at */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`pricing.${index}.compareAtPrice`, { valueAsNumber: true })}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="0.00"
                      />
                    </div>
                  </td>

                  {/* Cost */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`pricing.${index}.costPrice`, { valueAsNumber: true })}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="0.00"
                      />
                    </div>
                  </td>

                  {/* Margin — calculated, read-only */}
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${
                      isGood     ? 'text-green-600' :
                      isNegative ? 'text-red-500'   : 'text-zinc-400'
                    }`}>
                      {margin}
                    </span>
                  </td>

                  {/* Inventory */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      {...register(`pricing.${index}.inventory`, { valueAsNumber: true })}
                      className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="0"
                    />
                  </td>

                  {/* Low Stock Alert */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      {...register(`pricing.${index}.lowStockAlert`, { valueAsNumber: true })}
                      className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="10"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

