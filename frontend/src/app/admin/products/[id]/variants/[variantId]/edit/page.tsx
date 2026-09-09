'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminToken } from '@/lib/admin-token'
import { toastError, toastSuccess } from '@/lib/toast'
import StockTab from '@/components/admin/products/StockTab'
import InternalStockSection from '@/components/admin/products/InternalStockSection'
import SupplierMappingSection from '@/components/admin/products/SupplierMappingSection'
import type { Sku, ProductPrice } from '@/types/admin.types'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function Field({
  label, name, required, type = 'text', placeholder, step, defaultValue,
}: {
  label: string; name: string; required?: boolean
  type?: string; placeholder?: string; step?: string; defaultValue?: string | number | null
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-zinc-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
      />
    </div>
  )
}

function SelectField({
  label, name, options, defaultValue,
}: {
  label: string; name: string
  options: { value: string; label: string }[]
  defaultValue?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-zinc-600 mb-1">{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function EditVariantPage() {
  const { id, variantId } = useParams<{ id: string; variantId: string }>()
  const router = useRouter()

  const [sku, setSku]         = useState<Sku | null>(null)
  const [prices, setPrices]   = useState<ProductPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    document.title = 'Edit Variant | Tyres & Car Valeting'
  }, [])

  useEffect(() => {
    if (!id || !variantId) return
    let cancelled = false
    async function load() {
      try {
        const token = await getAdminToken()
        const res = await fetch(`${API}/api/admin/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const json = await res.json()
        const found = (json.skus ?? []).find((s: { product_id: string }) => s.product_id === variantId)
        if (!found) throw new Error('Variant not found')
        if (!cancelled) {
          setSku(found)
          setPrices(Array.isArray(found.product_prices) ? found.product_prices : [])
        }
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to load variant')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, variantId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)

    const payload = {
      sku:              String(fd.get('sku') ?? '').trim(),
      barcodeEan:       String(fd.get('barcodeEan') ?? '').trim() || undefined,
      tyreSizeDisplay:  String(fd.get('tyreSizeDisplay') ?? '').trim(),
      width:            fd.get('width')   ? Number(fd.get('width'))   : undefined,
      profile:          fd.get('profile') ? Number(fd.get('profile')) : undefined,
      rimSize:          Number(fd.get('rimSize') ?? 0),
      specialSize:      String(fd.get('specialSize') ?? '').trim() || undefined,
      constructionType: String(fd.get('constructionType') ?? '').trim() || undefined,
      loadIndex:        String(fd.get('loadIndex')        ?? '').trim() || undefined,
      speedRating:      String(fd.get('speedRating')      ?? '').trim() || undefined,
      loadSpeedRating:  String(fd.get('loadSpeedRating')  ?? '').trim() || undefined,
      fuelRating:       String(fd.get('fuelRating')       ?? '').trim() || undefined,
      wetGrip:          String(fd.get('wetGrip')          ?? '').trim() || undefined,
      noiseDb:          String(fd.get('noiseDb')          ?? '').trim() || undefined,
      noiseClass:       String(fd.get('noiseClass')       ?? '').trim() || undefined,
      plyRating:        String(fd.get('plyRating')        ?? '').trim() || undefined,
      loadRange:        String(fd.get('loadRange')        ?? '').trim() || undefined,
      sidewall:         String(fd.get('sidewall')         ?? '').trim() || undefined,
      tubeType:         String(fd.get('tubeType')         ?? '').trim() || undefined,
      countryOfOrigin:  String(fd.get('countryOfOrigin')  ?? '').trim() || undefined,
      manufacturerName: String(fd.get('manufacturerName') ?? '').trim() || undefined,
      factoryName:      String(fd.get('factoryName')      ?? '').trim() || undefined,
      factoryCountry:   String(fd.get('factoryCountry')   ?? '').trim() || undefined,
      sectionWidth:     fd.get('sectionWidth')     ? Number(fd.get('sectionWidth'))     : undefined,
      treadDepth:       fd.get('treadDepth')       ? Number(fd.get('treadDepth'))       : undefined,
      tyreWeight:       fd.get('tyreWeight')       ? Number(fd.get('tyreWeight'))       : undefined,
      overallDiameter:  fd.get('overallDiameter')  ? Number(fd.get('overallDiameter'))  : undefined,
      maxLoad:          String(fd.get('maxLoad')    ?? '').trim() || undefined,
      maxPressure:      String(fd.get('maxPressure') ?? '').trim() || undefined,
      eMark:            String(fd.get('eMark')      ?? '').trim() || undefined,
      dotCode:          String(fd.get('dotCode')    ?? '').trim() || undefined,
      utqg:             String(fd.get('utqg')       ?? '').trim() || undefined,
      runflat:              fd.get('runflat')      === 'on',
      xlReinforced:         fd.get('xlReinforced') === 'on',
      ltSizing:             fd.get('ltSizing')     === 'on',
      status:               String(fd.get('status') ?? 'active') as 'active' | 'inactive' | 'discontinued',
      compareAtPrice:       fd.get('compareAtPrice')       ? Number(fd.get('compareAtPrice'))       : null,
      costPrice:            fd.get('costPrice')            ? Number(fd.get('costPrice'))            : null,
      lowStockAlert:        fd.get('lowStockAlert')        ? Number(fd.get('lowStockAlert'))        : null,
      replacementProductId: String(fd.get('replacementProductId') ?? '').trim() || null,
    }

    try {
      const token = await getAdminToken()
      const res = await fetch(`${API}/api/admin/products/${id}/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      toastSuccess('Variant updated')
      router.push(`/admin/products/${id}/variants/${variantId}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse mb-6" />
        <div className="h-96 bg-zinc-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!sku) {
    return (
      <div className="p-4 sm:p-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: 'Product',  href: `/admin/products/${id}` },
          { label: 'Edit Variant' },
        ]} />
        <p className="mt-6 text-sm text-zinc-500">Variant not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products',  href: '/admin/products' },
          { label: 'Product',   href: `/admin/products/${id}` },
          { label: sku.tyre_size_display || sku.sku, href: `/admin/products/${id}/variants/${variantId}` },
          { label: 'Edit' },
        ]} />
      </div>

      <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-zinc-900 mb-6">
          Edit Variant — {sku.tyre_size_display || sku.sku}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Product Identity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SKU" name="sku" required defaultValue={sku.sku} />
              <Field label="Barcode (EAN)" name="barcodeEan" placeholder="e.g. 1234567890123" defaultValue={sku.barcode_ean} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Sizing & Dimensions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Width (mm)"    name="width"           type="number" placeholder="205"           defaultValue={sku.width} />
              <Field label="Profile (%)"   name="profile"         type="number" placeholder="55"            defaultValue={sku.profile} />
              <Field label="Rim Size (in)" name="rimSize"         type="number" required placeholder="16"   defaultValue={sku.rim_size} />
              <Field label="Special Size"  name="specialSize"     placeholder="e.g. 33X12.50R17"            defaultValue={sku.special_size} />
              <Field label="Size Display"  name="tyreSizeDisplay" placeholder="e.g. 205/55R16" required     defaultValue={sku.tyre_size_display} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Technical Specifications</h2>
            {/* Row 1: Load Index | Speed Rating | Load/Speed | Construction */}
            <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
              <Field label="Load Index"        name="loadIndex"       placeholder="91"  defaultValue={sku.load_index} />
              <Field label="Speed Rating"      name="speedRating"     placeholder="V"   defaultValue={sku.speed_rating} />
              <Field label="Load/Speed"        name="loadSpeedRating" placeholder="91V" defaultValue={sku.load_speed_rating} />
              <SelectField label="Construction" name="constructionType" defaultValue={sku.construction_type ?? 'R'} options={[
                { value: 'R', label: 'R (Radial)' },
                { value: 'D', label: 'D (Diagonal)' },
                { value: 'B', label: 'B (Belted)' },
              ]} />
            </div>
            {/* Row 2: Ply Rating | Load Range | Sidewall */}
            <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3">
              <Field label="Ply Rating" name="plyRating" placeholder="e.g. 10PR" defaultValue={sku.ply_rating} />
              <SelectField label="Load Range" name="loadRange" defaultValue={sku.load_range ?? ''} options={[
                { value: '', label: 'N/A' },
                { value: 'B', label: 'B' },
                { value: 'C', label: 'C' },
                { value: 'D', label: 'D' },
                { value: 'E', label: 'E' },
                { value: 'F', label: 'F' },
                { value: 'G', label: 'G' },
              ]} />
              <SelectField label="Sidewall" name="sidewall" defaultValue={sku.sidewall ?? ''} options={[
                { value: '',    label: '—' },
                { value: 'BSW', label: 'BSW (Black)' },
                { value: 'OWL', label: 'OWL (Outlined White Letters)' },
                { value: 'RWL', label: 'RWL (Raised White Letters)' },
                { value: 'WSW', label: 'WSW (White Sidewall)' },
              ]} />
            </div>
            {/* Row 3: checkboxes */}
            <div className="flex flex-wrap items-center gap-8 border-t border-zinc-100 pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 select-none">
                <input type="checkbox" name="xlReinforced" defaultChecked={sku.xl_reinforced ?? false} className="h-4 w-4 rounded border-zinc-300 accent-primary" />
                XL / Reinforced
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 select-none">
                <input type="checkbox" name="runflat" defaultChecked={sku.runflat ?? false} className="h-4 w-4 rounded border-zinc-300 accent-primary" />
                Runflat
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 select-none">
                <input type="checkbox" name="ltSizing" defaultChecked={sku.lt_sizing ?? false} className="h-4 w-4 rounded border-zinc-300 accent-primary" />
                LT (Light Truck)
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Extended Specifications</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fuel Rating"        name="fuelRating"      placeholder="C"  defaultValue={sku.fuel_rating} />
              <Field label="Wet Grip"           name="wetGrip"         placeholder="A"  defaultValue={sku.wet_grip} />
              <Field label="Noise (dB)"         name="noiseDb"         placeholder="68" defaultValue={sku.noise_db} />
              <Field label="Noise Class"        name="noiseClass"      placeholder="1"  defaultValue={sku.noise_class} />
              <Field label="Section Width"      name="sectionWidth"    type="number" step="0.1" defaultValue={sku.section_width} />
              <Field label="Tread Depth (mm)"   name="treadDepth"      type="number" step="0.1" defaultValue={sku.tread_depth} />
              <Field label="Tyre Weight (kg)"   name="tyreWeight"      type="number" step="0.1" defaultValue={sku.tyre_weight} />
              <Field label="Overall Dia (mm)"   name="overallDiameter" type="number" step="0.1" defaultValue={sku.overall_diameter} />
              <Field label="Max Load"           name="maxLoad"         defaultValue={sku.max_load} />
              <Field label="Max Pressure"       name="maxPressure"     defaultValue={sku.max_pressure} />
              <Field label="E-Mark"             name="eMark"           defaultValue={sku.e_mark} />
              <Field label="DOT Code"           name="dotCode"         defaultValue={sku.dot_code} />
              <Field label="UTQG"               name="utqg"            defaultValue={sku.utqg} />
              <Field label="Country of Origin"  name="countryOfOrigin" placeholder="China" defaultValue={sku.country_of_origin} />
              <Field label="Manufacturer"       name="manufacturerName" defaultValue={sku.manufacturer_name} />
              <Field label="Factory Name"       name="factoryName"     defaultValue={sku.factory_name} />
              <Field label="Factory Country"    name="factoryCountry"  defaultValue={sku.factory_country} />
              <SelectField label="Tube Type" name="tubeType" defaultValue={sku.tube_type ?? ''} options={[
                { value: '',          label: '—' },
                { value: 'tubeless',  label: 'Tubeless' },
                { value: 'tube_type', label: 'Tube Type' },
              ]} />
              <SelectField label="Status" name="status" defaultValue={sku.status ?? 'active'} options={[
                { value: 'active',       label: 'Active' },
                { value: 'inactive',     label: 'Inactive' },
                { value: 'discontinued', label: 'Discontinued' },
              ]} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Pricing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Compare at Price (A$)" name="compareAtPrice" type="number" step="0.01" placeholder="0.00" defaultValue={sku.compare_at_price} />
              <Field label="Cost Price (A$)"        name="costPrice"      type="number" step="0.01" placeholder="0.00" defaultValue={sku.cost_price} />
              <Field label="Low Stock Alert"        name="lowStockAlert"  type="number" placeholder="10"              defaultValue={sku.low_stock_alert} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Replacement</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Replacement Product ID" name="replacementProductId" placeholder="UUID of replacement SKU" defaultValue={sku.replacement_product_id} />
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Stock</h2>
        <StockTab productId={variantId} patternId={id} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-4">
          4. Internal Owned Stock (Auto-Synced)
        </h2>
        <InternalStockSection
          variantId={variantId}
          patternId={id}
          retailPrice={prices.find(p => p.price_type === 'retail')?.price_inc_gst ?? null}
          priceId={prices.find(p => p.price_type === 'retail')?.price_id ?? null}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-4">
          5. Supplier API / EDI Mapping (External Stock)
        </h2>
        <SupplierMappingSection
          variantId={variantId}
          patternId={id}
          ourSkuMatch={sku.tyre_size_display || sku.sku}
        />
      </div>
      </div>
    </div>
  )
}
