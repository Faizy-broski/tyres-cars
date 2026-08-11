'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Textarea } from '@/components/ui/textarea'
import { toastSuccess, toastError } from '@/lib/toast'
import { uploadProductImage } from '@/lib/upload-image'
import { Trash2, X } from 'lucide-react'
import type { WheelBrand } from '@/types/admin.types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type WheelBrandFormState = {
  brand_name:  string
  logo:        string
  description: string
  is_active:   boolean
}

export const EMPTY_WHEEL_BRAND_FORM: WheelBrandFormState = {
  brand_name:  '',
  logo:        '',
  description: '',
  is_active:   true,
}

export function brandToForm(b: WheelBrand): WheelBrandFormState {
  return {
    brand_name:  b.brand_name ?? '',
    logo:        b.logo ?? '',
    description: b.description ?? '',
    is_active:   b.is_active ?? true,
  }
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ''
}

interface Props {
  mode:             'create' | 'edit'
  wheelBrandId?:    string
  initial:          WheelBrandFormState
  onSaved:          (brand: WheelBrand) => void
  onRequestDelete?: () => void
  onClose?:         () => void
}

export function WheelBrandFormPanel({
  mode,
  wheelBrandId,
  initial,
  onSaved,
  onRequestDelete,
  onClose,
}: Props) {
  const isEdit = mode === 'edit'
  const [form, setForm]           = useState<WheelBrandFormState>(initial)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(initial)
  }, [initial])

  function set<K extends keyof WheelBrandFormState>(key: K, val: WheelBrandFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    try {
      const url = await uploadProductImage(file, 'wheels/brands')
      set('logo', url)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand_name.trim()) {
      toastError('Brand name is required')
      return
    }

    setSaving(true)
    try {
      const token = await getToken()
      const url = isEdit
        ? `${API}/api/admin/wheels/brands/${wheelBrandId}`
        : `${API}/api/admin/wheels/brands`

      const body = {
        brand_name:  form.brand_name.trim(),
        logo:        form.logo.trim() || null,
        description: form.description.trim() || null,
        is_active:   form.is_active,
      }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      toastSuccess(isEdit ? 'Brand updated' : 'Brand created')
      onSaved(isEdit ? ({ ...initial, ...form, wheel_brand_id: wheelBrandId!, created_at: '' } as WheelBrand) : data)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save brand')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors'
  const lbl = 'block text-xs font-semibold text-zinc-600 mb-1.5'

  return (
    <div className="rounded-2xl border-2 border-primary/60 bg-white shadow-md overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900">
            {isEdit ? 'Edit Wheel Brand' : 'Create Wheel Brand'}
          </h2>
          {isEdit && form.brand_name && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{form.brand_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEdit && onRequestDelete && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              title="Delete brand"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-5 py-5 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
          <div>
            <label className={lbl}>Brand Name <Req /></label>
            <input
              type="text"
              required
              value={form.brand_name}
              onChange={e => set('brand_name', e.target.value)}
              placeholder="e.g. Enkei, BBS, Rays"
              className={inp}
            />
          </div>

          <div>
            <label className={lbl}>Logo URL</label>
            <div className="flex items-center gap-2">
              {form.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo}
                  alt=""
                  className="h-9 w-9 object-contain rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shrink-0"
                />
              )}
              <input
                type="url"
                value={form.logo}
                onChange={e => set('logo', e.target.value)}
                placeholder="https://…"
                className={inp}
              />
              <button
                type="button"
                onClick={() => imgRef.current?.click()}
                disabled={uploading}
                className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                {uploading ? '…' : 'Upload'}
              </button>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) await uploadLogo(f)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Description</label>
            <Textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Brand story, manufacturing details, warranty information…"
              className="resize-none text-xs rounded-xl"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <label htmlFor="is_active_brand" className="flex items-center gap-2.5 text-sm text-zinc-700 cursor-pointer select-none">
              <input
                id="is_active_brand"
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30 focus:ring-2"
              />
              Active (visible and assignable to wheels)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-200 bg-white shrink-0">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                {isEdit ? 'Saving Changes…' : 'Creating Brand…'}
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Brand'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function Req() {
  return <span className="text-red-500 ml-0.5">*</span>
}
