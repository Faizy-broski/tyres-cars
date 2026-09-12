'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BACKEND_API_URL, createBackendHeaders, readBackendError } from '@/lib/backend-api'
import { toastSuccess, toastError } from '@/lib/toast'

interface Props {
  accessToken: string
  onClose: () => void
}

export default function CreateCustomerModal({ accessToken, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/admin/customers`, {
        method: 'POST',
        headers: createBackendHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email:     fd.get('email'),
          firstName: fd.get('firstName') || null,
          lastName:  fd.get('lastName')  || null,
          phone:     fd.get('phone')     || null,
        }),
      })
      if (!res.ok) throw new Error(await readBackendError(res))
      toastSuccess('Customer created')
      startTransition(() => router.refresh())
      onClose()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to create customer')
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="p-0 gap-0 rounded-2xl shadow-xl ring-0 bg-white sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white z-10">
          <DialogTitle className="text-base font-semibold text-zinc-900">Create Customer</DialogTitle>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-zinc-700">
              <X className="w-4 h-4" />
            </Button>
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="block text-sm font-medium text-zinc-700 mb-1">First Name</Label>
                <Input id="firstName" name="firstName" type="text" placeholder="Jane" className="rounded-lg border-zinc-300 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <Label htmlFor="lastName" className="block text-sm font-medium text-zinc-700 mb-1">Last Name</Label>
                <Input id="lastName" name="lastName" type="text" placeholder="Smith" className="rounded-lg border-zinc-300 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input id="email" name="email" type="email" required placeholder="customer@example.com" className="rounded-lg border-zinc-300 focus:ring-primary/30 focus:border-primary" />
            </div>

            <div>
              <Label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">Phone</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+61 4XX XXX XXX" className="rounded-lg border-zinc-300 focus:ring-primary/30 focus:border-primary" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 sticky bottom-0 bg-white">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="px-4 py-2 text-sm text-zinc-600 border-zinc-300 rounded-lg hover:bg-zinc-50">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium text-zinc-900 bg-primary rounded-lg hover:bg-primary/90">
              {isPending ? 'Creating…' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
