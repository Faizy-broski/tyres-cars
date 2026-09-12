'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BACKEND_API_URL, createBackendHeaders, readBackendError } from '@/lib/backend-api'
import { toastSuccess, toastError } from '@/lib/toast'
import type { CustomerListItem } from '@/types/admin.types'

interface Props {
  open:        boolean
  onClose:     () => void
  onSaved:     () => void
  accessToken: string
  customer?:   CustomerListItem | null
}

export default function CustomerSheet({ open, onClose, onSaved, accessToken, customer }: Props) {
  const isEdit = !!customer
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSaving(true)
    try {
      const url    = isEdit ? `${BACKEND_API_URL}/api/admin/customers/${customer!.customer_id}` : `${BACKEND_API_URL}/api/admin/customers`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: createBackendHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email:     fd.get('email'),
          firstName: fd.get('firstName') || null,
          lastName:  fd.get('lastName')  || null,
          phone:     fd.get('phone')     || null,
        }),
      })
      if (!res.ok) throw new Error(await readBackendError(res))
      toastSuccess(isEdit ? 'Customer updated' : 'Customer created')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Customer' : 'Create Customer'}
      width="w-full max-w-lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cs-first" className="block text-sm font-medium text-zinc-700 mb-1">First Name</Label>
              <Input id="cs-first" name="firstName" type="text" placeholder="Jane" defaultValue={customer?.first_name ?? ''} autoFocus={!isEdit} />
            </div>
            <div>
              <Label htmlFor="cs-last" className="block text-sm font-medium text-zinc-700 mb-1">Last Name</Label>
              <Input id="cs-last" name="lastName" type="text" placeholder="Smith" defaultValue={customer?.last_name ?? ''} />
            </div>
          </div>

          <div>
            <Label htmlFor="cs-email" className="block text-sm font-medium text-zinc-700 mb-1">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input id="cs-email" name="email" type="email" required placeholder="customer@example.com" defaultValue={customer?.email ?? ''} />
          </div>

          <div>
            <Label htmlFor="cs-phone" className="block text-sm font-medium text-zinc-700 mb-1">Phone</Label>
            <Input id="cs-phone" name="phone" type="tel" placeholder="+61 4XX XXX XXX" defaultValue={customer?.phone ?? ''} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-zinc-100 mt-5">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
