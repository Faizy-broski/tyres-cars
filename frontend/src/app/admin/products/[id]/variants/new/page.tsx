'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminToken } from '@/lib/admin-token'
import { toastError } from '@/lib/toast'

const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function Field({ label, name, required, type = 'text', placeholder, step }: {
  label: string; name: string; required?: boolean
  type?: string; placeholder?: string; step?: string
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
      />
    </div>
  )
}

function SelectField({ label, name, options }: {
  label: string; name: string
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-zinc-600 mb-1">{label}</label>
      <select
        id={name}
        name={name}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function NewVariantPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [saving, setSaving] = useState(false)

  useEffect(() => { document.title = 'New Variant | Tyres & Car Valeting' }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)

    const variant = {
      sku:              String(fd.get('sku') ?? '').trim(),
      barcodeEan:       String(fd.get('barcodeEan') ?? '').trim() || undefined,
      tyreSizeDisplay:  String(fd.get('tyreSizeDisplay') ?? '').trim(),
      width:            fd.get('width')     ? Number(fd.get('width'))     : undefined,
      profile:          fd.get('profile')   ? Number(fd.get('profile'))   : undefined,
      rimSize:          Number(fd.get('rimSize') ?? 0),
      specialSize:      String(fd.get('specialSize') ?? '').trim() || undefined,
      loadIndex:        String(fd.get('loadIndex')   ?? '').trim() || undefined,
      speedRating:      String(fd.get('speedRating') ?? '').trim() || undefined,
      fuelRating:       String(fd.get('fuelRating')  ?? '').trim() || undefined,
      wetGrip:          String(fd.get('wetGrip')     ?? '').trim() || undefined,
      noiseDb:          String(fd.get('noiseDb')     ?? '').trim() || undefined,
      runflat:          fd.get('runflat') === 'true',
      xlReinforced:     fd.get('xlReinforced') === 'true',
      ltSizing:         fd.get('ltSizing') === 'on',
      countryOfOrigin:  String(fd.get('countryOfOrigin') ?? '').trim() || undefined,
    }

    const pricing = {
      priceIncGst:    Number(fd.get('priceIncGst')   ?? 0),
      compareAtPrice: fd.get('compareAtPrice') ? Number(fd.get('compareAtPrice')) : undefined,
      costPrice:      fd.get('costPrice')      ? Number(fd.get('costPrice'))      : undefined,
      lowStockAlert:  fd.get('lowStockAlert')  ? Number(fd.get('lowStockAlert'))  : undefined,
    }

    try {
      const token = await getAdminToken()
      const res = await fetch(`${API}/api/admin/products/${id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variant, pricing }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const { product_id } = await res.json()
      router.push(`/admin/products/${id}/variants/${product_id}`)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to create variant')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <AdminBreadcrumb crumbs={[
          { label: 'Products', href: '/admin/products' },
          { label: 'Product',  href: `/admin/products/${id}` },
          { label: 'Add Variant' },
        ]} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-zinc-900 mb-6">Add Variant</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Product Identity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SKU" name="sku" required />
              <Field label="Barcode (EAN)" name="barcodeEan" placeholder="e.g. 1234567890123" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Sizing & Dimensions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Width (mm)" name="width" type="number" placeholder="205" />
              <Field label="Profile (%)" name="profile" type="number" placeholder="55" />
              <Field label="Rim Size (in)" name="rimSize" type="number" required placeholder="16" />
              <Field label="Special Size" name="specialSize" placeholder="e.g. 33X12.50R17" />
              <Field label="Size Display" name="tyreSizeDisplay" placeholder="e.g. 205/55R16" required />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Technical Specifications</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Load Index" name="loadIndex" placeholder="91" />
              <Field label="Speed Rating" name="speedRating" placeholder="V" />
              <Field label="Fuel Rating" name="fuelRating" placeholder="C" />
              <Field label="Wet Grip" name="wetGrip" placeholder="A" />
              <Field label="Noise (dB)" name="noiseDb" placeholder="68" />
              <Field label="Country of Origin" name="countryOfOrigin" placeholder="China" />
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
              <SelectField label="Runflat" name="runflat" options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]} />
              <SelectField label="XL Reinforced" name="xlReinforced" options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]} />
            </div>
            <div className="flex flex-wrap gap-6 mt-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 select-none">
                <input type="checkbox" name="ltSizing" className="h-4 w-4 rounded border-zinc-300 accent-primary" />
                LT (Light Truck)
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Pricing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Retail Price (inc. GST)" name="priceIncGst" type="number" step="0.01" placeholder="0.00" required />
              <Field label="Compare at Price" name="compareAtPrice" type="number" step="0.01" placeholder="0.00" />
              <Field label="Cost Price" name="costPrice" type="number" step="0.01" placeholder="0.00" />
              <Field label="Low Stock Alert" name="lowStockAlert" type="number" placeholder="10" />
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Variant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
