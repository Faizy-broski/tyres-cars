'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { uploadProductImage, deleteProductImage } from '@/lib/upload-image'
import type { AdminWheelDetail, WheelBrand, WheelStyleCategory } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STYLE_CATEGORY_OPTIONS: { value: WheelStyleCategory; label: string }[] = [
  { value: '4x4',        label: '4x4 / Off-Road' },
  { value: 'street',     label: 'Street'          },
  { value: 'luxury',     label: 'Luxury'          },
  { value: 'commercial', label: 'Commercial'      },
]

type VariantRow = {
  _key:              number
  wheel_variant_id?: string
  sku:               string
  diameter:          string
  width:             string
  pcd:               string
  offset:            string
  centre_bore:       string
  load_rating:       string
  price:             string
  is_active:         boolean
}

let _variantKey = 1
function newVariantRow(): VariantRow {
  return {
    _key:        _variantKey++,
    sku:         '',
    diameter:    '',
    width:       '',
    pcd:         '',
    offset:      '',
    centre_bore: '',
    load_rating: '',
    price:       '',
    is_active:   true,
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

interface Props {
  wheel?:    AdminWheelDetail | null   // omit/null = create mode
  brands:    WheelBrand[]
  onSuccess: () => void
  onCancel:  () => void
}

export default function WheelForm({ wheel, brands, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(wheel)

  const [saving, setSaving] = useState(false)

  // Model fields
  const [wheelBrandId,  setWheelBrandId]  = useState(wheel?.wheel_brand_id ?? '')
  const [modelName,     setModelName]     = useState(wheel?.model_name ?? '')
  const [modelSlug,     setModelSlug]     = useState(wheel?.model_slug ?? '')
  const [styleCategory, setStyleCategory] = useState(wheel?.style_category ?? '')
  const [finish,        setFinish]        = useState(wheel?.finish ?? '')
  const [colour,        setColour]        = useState(wheel?.colour ?? '')
  const [description,   setDescription]   = useState(wheel?.description ?? '')
  const [isActive,      setIsActive]      = useState(wheel?.is_active ?? true)

  // Images
  const [mainImage,     setMainImage]     = useState<string>(wheel?.main_image ?? '')
  const [galleryImages, setGalleryImages] = useState<string[]>(wheel?.gallery_images ?? [])
  const [uploadingMain, setUploadingMain] = useState(false)
  const [uploadingGal,  setUploadingGal]  = useState(false)
  const [dragIdx,       setDragIdx]       = useState<number | null>(null)
  const [dragOverIdx,   setDragOverIdx]   = useState<number | null>(null)
  const mainInputRef    = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>(() => {
    if (wheel?.wheel_variants?.length) {
      return wheel.wheel_variants.map(v => ({
        _key:              _variantKey++,
        wheel_variant_id:  v.wheel_variant_id,
        sku:               v.sku,
        diameter:          String(v.diameter),
        width:             String(v.width),
        pcd:               v.pcd,
        offset:            String(v.offset),
        centre_bore:       v.centre_bore != null ? String(v.centre_bore) : '',
        load_rating:       v.load_rating != null ? String(v.load_rating) : '',
        price:             v.price       != null ? String(v.price)       : '',
        is_active:         v.is_active,
      }))
    }
    return [newVariantRow()]
  })
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])

  function handleNameChange(val: string) {
    setModelName(val)
    if (!isEdit) setModelSlug(slugify(val))
  }

  async function handleMainUpload(files: FileList | null) {
    if (!files?.length) return
    setUploadingMain(true)
    try {
      const url = await uploadProductImage(files[0], 'wheels/main')
      if (mainImage) await deleteProductImage(mainImage).catch(() => {})
      setMainImage(url)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingMain(false)
      if (mainInputRef.current) mainInputRef.current.value = ''
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files?.length) return
    setUploadingGal(true)
    try {
      const urls = await Promise.all(Array.from(files).map(f => uploadProductImage(f, 'wheels/gallery')))
      setGalleryImages(prev => [...prev, ...urls])
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingGal(false)
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  function reorderGallery(from: number, to: number) {
    if (from === to) return
    const next = [...galleryImages]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setGalleryImages(next)
  }

  async function removeGalleryImage(i: number) {
    const url = galleryImages[i]
    setGalleryImages(prev => prev.filter((_, j) => j !== i))
    await deleteProductImage(url).catch(() => {})
  }

  function updateVariant(key: number, field: keyof Omit<VariantRow, '_key' | 'wheel_variant_id'>, val: string | boolean) {
    setVariants(prev => prev.map(v => v._key === key ? { ...v, [field]: val } : v))
  }

  function addVariant() {
    setVariants(prev => [...prev, newVariantRow()])
  }

  function removeVariant(key: number) {
    const row = variants.find(v => v._key === key)
    if (row?.wheel_variant_id) setRemovedVariantIds(prev => [...prev, row.wheel_variant_id!])
    setVariants(prev => prev.filter(v => v._key !== key))
  }

  async function handleSubmit() {
    if (!wheelBrandId)     { toastError('Brand is required'); return }
    if (!modelName.trim()) { toastError('Model name is required'); return }
    if (!modelSlug.trim()) { toastError('Model slug is required'); return }

    const filledVariants = variants.filter(v => v.sku.trim() || v.diameter || v.width || v.pcd.trim())
    for (const v of filledVariants) {
      if (!v.sku.trim())   { toastError('Variant row: SKU is required'); return }
      if (!v.diameter)     { toastError(`Variant "${v.sku}": Diameter is required`); return }
      if (!v.width)        { toastError(`Variant "${v.sku}": Width is required`); return }
      if (!v.pcd.trim())   { toastError(`Variant "${v.sku}": PCD is required`); return }
      if (v.offset === '') { toastError(`Variant "${v.sku}": Offset (ET) is required`); return }
    }

    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token ?? ''

      const modelBody = {
        wheel_brand_id: wheelBrandId,
        model_name:     modelName.trim(),
        model_slug:     modelSlug.trim(),
        description:    description.trim() || null,
        main_image:     mainImage          || null,
        gallery_images: galleryImages.length ? galleryImages : null,
        style_category: styleCategory       || null,
        finish:         finish.trim()       || null,
        colour:         colour.trim()       || null,
        is_active:      isActive,
      }

      let wheelId: string
      if (isEdit) {
        const res = await fetch(`${API}/api/admin/wheels/${wheel!.wheel_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(modelBody),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
        wheelId = wheel!.wheel_id
      } else {
        const res = await fetch(`${API}/api/admin/wheels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(modelBody),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`) }
        wheelId = (await res.json()).wheel_id
      }

      // Deletions
      for (const vid of removedVariantIds) {
        const res = await fetch(`${API}/api/admin/wheels/${wheelId}/variants/${vid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Deleting variant: ${b.error ?? `HTTP ${res.status}`}`) }
      }

      // Creates / updates
      for (const v of filledVariants) {
        const variantBody = {
          sku:         v.sku.trim(),
          diameter:    Number(v.diameter),
          width:       Number(v.width),
          pcd:         v.pcd.trim(),
          offset:      Number(v.offset),
          centre_bore: v.centre_bore ? Number(v.centre_bore) : null,
          load_rating: v.load_rating ? Number(v.load_rating) : null,
          price:       v.price       ? Number(v.price)       : null,
          is_active:   v.is_active,
        }
        const url    = v.wheel_variant_id
          ? `${API}/api/admin/wheels/${wheelId}/variants/${v.wheel_variant_id}`
          : `${API}/api/admin/wheels/${wheelId}/variants`
        const method = v.wheel_variant_id ? 'PATCH' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(variantBody),
        })
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`Variant "${v.sku}": ${b.error ?? `HTTP ${res.status}`}`) }
      }

      toastSuccess(isEdit ? 'Wheel updated' : 'Wheel created')
      onSuccess()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save wheel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Model Details ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-800 mb-4">Model Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <label className="text-sm font-medium text-zinc-700">Brand <span className="text-red-500">*</span></label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              value={wheelBrandId}
              onChange={e => setWheelBrandId(e.target.value)}
            >
              <option value="">— Select brand —</option>
              {brands.filter(b => b.is_active || b.wheel_brand_id === wheelBrandId).map(b => (
                <option key={b.wheel_brand_id} value={b.wheel_brand_id}>{b.brand_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Style Category</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              value={styleCategory}
              onChange={e => setStyleCategory(e.target.value)}
            >
              <option value="">— None —</option>
              {STYLE_CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Model Name <span className="text-red-500">*</span></label>
            <Input
              className="mt-1"
              value={modelName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. RPF1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Model Slug <span className="text-red-500">*</span></label>
            <Input
              className="mt-1"
              value={modelSlug}
              onChange={e => setModelSlug(e.target.value)}
              placeholder="e.g. rpf1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Finish</label>
            <Input className="mt-1" value={finish} onChange={e => setFinish(e.target.value)} placeholder="e.g. Matte Black" />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Colour</label>
            <Input className="mt-1" value={colour} onChange={e => setColour(e.target.value)} placeholder="e.g. Gunmetal" />
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Description</label>
            <Textarea
              className="mt-1"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </div>
        </div>
      </div>

      {/* ── Images ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-800 mb-4">Images</h2>

        {/* Main Image */}
        <div>
          <label className="text-sm font-medium text-zinc-700">Main Image</label>
          <input
            ref={mainInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={e => handleMainUpload(e.target.files)}
          />
          {mainImage ? (
            <div className="mt-2 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt="Main" className="h-24 w-24 object-contain rounded-xl border border-zinc-200" />
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => mainInputRef.current?.click()} disabled={uploadingMain}>
                  {uploadingMain ? 'Uploading…' : 'Replace'}
                </Button>
                <Button
                  type="button" size="sm" variant="ghost"
                  className="text-red-500 hover:text-red-600"
                  onClick={async () => { await deleteProductImage(mainImage).catch(() => {}); setMainImage('') }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button" tabIndex={0}
              onClick={() => !uploadingMain && mainInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && !uploadingMain && mainInputRef.current?.click()}
              className={`mt-2 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-colors ${uploadingMain ? 'border-zinc-200 bg-zinc-50 cursor-wait' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 cursor-pointer'}`}
            >
              {uploadingMain ? (
                <p className="text-sm text-zinc-500">Uploading…</p>
              ) : (
                <>
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-zinc-500"><span className="font-medium text-zinc-700">Upload Main Image</span></p>
                  <p className="text-xs text-zinc-400">JPEG, PNG, WebP, GIF or AVIF</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Gallery Images */}
        <div className="mt-6">
          <label className="text-sm font-medium text-zinc-700">Gallery Images</label>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={e => handleGalleryUpload(e.target.files)}
          />
          <div
            role="button" tabIndex={0}
            onClick={() => !uploadingGal && galleryInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && !uploadingGal && galleryInputRef.current?.click()}
            className={`mt-2 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-colors ${uploadingGal ? 'border-zinc-200 bg-zinc-50 cursor-wait' : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 cursor-pointer'}`}
          >
            {uploadingGal ? (
              <p className="text-sm text-zinc-500">Uploading…</p>
            ) : (
              <>
                <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-zinc-500"><span className="font-medium text-zinc-700">Upload Gallery Images</span></p>
                <p className="text-xs text-zinc-400">Select multiple · JPEG, PNG, WebP, GIF or AVIF</p>
              </>
            )}
          </div>

          {galleryImages.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-zinc-400 mb-2">
                Drag to reorder · First image is the <span className="font-semibold text-zinc-600">cover</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {galleryImages.map((src, i) => {
                  const isCover   = i === 0
                  const isDragged = dragIdx === i
                  const isOver    = dragOverIdx === i
                  return (
                    <div
                      key={src}
                      draggable
                      onDragStart={() => { setDragIdx(i); setDragOverIdx(null) }}
                      onDragEnter={() => setDragOverIdx(i)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { if (dragIdx !== null) reorderGallery(dragIdx, i); setDragIdx(null); setDragOverIdx(null) }}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                      className={`relative w-20 h-20 rounded-xl border-2 overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-150 ${
                        isDragged ? 'opacity-40 scale-95' : isOver ? 'border-primary scale-105 shadow-lg' : isCover ? 'border-primary' : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {isCover && (
                        <span className="absolute top-1 left-1 bg-primary text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none select-none">Cover</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
                        {!isCover && (
                          <Button type="button" size="sm" onClick={() => reorderGallery(i, 0)} className="bg-white/90 hover:bg-white text-zinc-800 h-6 text-[11px] px-2">
                            Cover
                          </Button>
                        )}
                        <Button type="button" size="sm" onClick={() => removeGalleryImage(i)} className="bg-red-500 hover:bg-red-600 text-white h-6 text-[11px] px-2">
                          Remove
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Variants ── */}
      <div className="rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Variants</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Each row is a size / PCD combination.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={addVariant}>
            <Plus className="h-4 w-4" /> Add Row
          </Button>
        </div>

        <div className="space-y-3">
          {variants.map((v, idx) => (
            <div key={v._key} className="rounded-lg border border-zinc-200 p-4 bg-zinc-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Variant {idx + 1}</span>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(v._key)}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs font-medium text-zinc-600">SKU <span className="text-red-500">*</span></label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={v.sku}
                    onChange={e => updateVariant(v._key, 'sku', e.target.value)}
                    placeholder="e.g. ENK-RPF1-17x8.5-5114"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Diameter (in) <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    step="0.5"
                    className="mt-1 h-8 text-sm"
                    value={v.diameter}
                    onChange={e => updateVariant(v._key, 'diameter', e.target.value)}
                    placeholder="17"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Width (in) <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    step="0.5"
                    className="mt-1 h-8 text-sm"
                    value={v.width}
                    onChange={e => updateVariant(v._key, 'width', e.target.value)}
                    placeholder="8.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">PCD <span className="text-red-500">*</span></label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={v.pcd}
                    onChange={e => updateVariant(v._key, 'pcd', e.target.value)}
                    placeholder="5x114.3"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Offset / ET <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={v.offset}
                    onChange={e => updateVariant(v._key, 'offset', e.target.value)}
                    placeholder="35"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Centre Bore (mm)</label>
                  <Input
                    type="number"
                    step="0.1"
                    className="mt-1 h-8 text-sm"
                    value={v.centre_bore}
                    onChange={e => updateVariant(v._key, 'centre_bore', e.target.value)}
                    placeholder="67.1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Load Rating (kg)</label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={v.load_rating}
                    onChange={e => updateVariant(v._key, 'load_rating', e.target.value)}
                    placeholder="750"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600">Price ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1 h-8 text-sm"
                    value={v.price}
                    onChange={e => updateVariant(v._key, 'price', e.target.value)}
                    placeholder="349.00"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.is_active}
                      onChange={e => updateVariant(v._key, 'is_active', e.target.checked)}
                      className="rounded"
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button size="sm" variant="outline" className="mt-3 gap-2 w-full border-dashed" onClick={addVariant}>
          <Plus className="h-4 w-4" /> Add Another Variant
        </Button>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="min-w-32">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Wheel'}
        </Button>
      </div>
    </div>
  )
}
