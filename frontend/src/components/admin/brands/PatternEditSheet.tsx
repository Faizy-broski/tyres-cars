'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet } from '@/components/ui/sheet'
import { BoolToggle } from '@/components/admin/BoolToggle'
import { uploadProductImage } from '@/lib/upload-image'
import { toastSuccess, toastError } from '@/lib/toast'
import { useAdminBrandsAll, type AdminPattern } from '@/lib/query/hooks'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TERRAIN_OPTIONS = ['AT', 'MT', 'HT']

type PatternWithBrand = AdminPattern & { brand_name: string }

interface Props {
  pattern:  PatternWithBrand | null
  open:     boolean
  onClose:  () => void
  onSaved:  () => void
}

export function PatternEditSheet({ pattern, open, onClose, onSaved }: Props) {
  const [name,      setName]      = useState('')
  const [brandId,   setBrandId]   = useState('')
  const [image,     setImage]     = useState('')
  const [terrain,   setTerrain]   = useState('')
  const [isActive,  setIsActive]  = useState(true)
  const [showOnWeb, setShowOnWeb] = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: brandsData } = useAdminBrandsAll()

  useEffect(() => {
    if (pattern) {
      setName(pattern.pattern_name)
      setBrandId(pattern.brand_id)
      setImage(pattern.main_image ?? '')
      setTerrain(pattern.terrain_type ?? '')
      setIsActive(pattern.is_active)
      setShowOnWeb(pattern.show_on_website)
    }
  }, [pattern])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const url = await uploadProductImage(file, 'patterns')
      setImage(url)
    } catch {
      toastError('Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!pattern || !name.trim()) return toastError('Pattern name is required')
    setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API}/api/admin/products/brands/${pattern.brand_id}/patterns/${pattern.pattern_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          patternName:   name.trim(),
          brandId:       brandId || pattern.brand_id,
          mainImage:     image || null,
          terrainType:   terrain || null,
          isActive:      isActive,
          showOnWebsite: showOnWeb,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toastSuccess('Pattern updated')
      onSaved()
    } catch {
      toastError('Failed to save pattern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pattern ? `Edit Pattern — ${pattern.pattern_name}` : 'Edit Pattern'}
      footer={
        <>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {/* Brand */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Brand <span className="text-red-500">*</span></label>
        <select
          value={brandId}
          onChange={e => setBrandId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          {brandsData?.map(b => (
            <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
          ))}
        </select>
      </div>

      {/* Pattern Name */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Pattern Name <span className="text-red-500">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        />
      </div>

      {/* Main Image */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-2">Pattern Image</label>
        <div className="flex items-start gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-16 h-16 rounded-lg object-contain border border-zinc-200 bg-zinc-50 p-1 shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 text-xs shrink-0 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}>
              <span className="text-lg leading-none">+</span>
              <span className="mt-0.5">Upload</span>
            </div>
          )}
          <div className="space-y-1.5 flex-1">
            <input
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-xs text-primary underline hover:no-underline disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {image && (
              <button type="button" onClick={() => setImage('')} className="ml-3 text-xs text-red-500 underline hover:no-underline">
                Remove
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      </div>

      {/* Terrain */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Terrain</label>
        <select
          value={terrain}
          onChange={e => setTerrain(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          <option value="">— None —</option>
          {TERRAIN_OPTIONS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Booleans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">Is Active</span>
          <BoolToggle initial={isActive} onToggle={async next => { setIsActive(next) }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">Show on Website</span>
          <BoolToggle initial={showOnWeb} onToggle={async next => { setShowOnWeb(next) }} />
        </div>
      </div>
    </Sheet>
  )
}
