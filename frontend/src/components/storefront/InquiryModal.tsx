'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { toastSuccess, toastError } from '@/lib/toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function InquiryModal({
  productId, sku, productName, tyreSizeDisplay, productUrl, trigger, variant = 'inquiry', quantity,
}: {
  productId: string
  sku: string
  productName?: string
  tyreSizeDisplay?: string
  productUrl?: string
  trigger: ReactNode
  /** 'booking' asks for a preferred fitting date and frames the request as a booking. */
  variant?: 'booking' | 'inquiry'
  quantity?: number
}) {
  const isBooking = variant === 'booking'
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [date, setDate] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toastError('Please fill in your name and email.')
      return
    }
    setSubmitting(true)
    try {
      const lines = [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        `Product: ${productName || sku} (SKU ${sku})`,
        tyreSizeDisplay ? `Size: ${tyreSizeDisplay}` : null,
        quantity ? `Quantity: ${quantity}` : null,
        date ? `Preferred date: ${date}` : null,
        productUrl ? `Link: ${productUrl}` : null,
        message ? `\n${message}` : null,
      ].filter(Boolean).join('\n')

      const subject = encodeURIComponent(`${isBooking ? 'Booking request' : 'Product inquiry'}: ${productName || sku}`)
      const body    = encodeURIComponent(lines)
      window.location.href = `mailto:support@tyrevault.com.au?subject=${subject}&body=${body}`

      toastSuccess('Opening your email app', "Send the message and we'll get back to you shortly.")
      setName(''); setEmail(''); setPhone(''); setMessage(''); setDate('')
      setOpen(false)
    } catch (err) {
      console.error('[InquiryModal] submit error', err)
      toastError('Something went wrong', 'Please email support@tyrevault.com.au directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBooking ? 'Book a Fitting' : 'Send an Inquiry'}</DialogTitle>
          <DialogDescription>
            {isBooking
              ? <>Leave your details and a preferred date &mdash; we&apos;ll confirm your booking shortly.</>
              : <>Leave your details and we&apos;ll get back to you about this product shortly.</>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
            <p className="font-semibold text-zinc-800">{productName || sku}</p>
            {tyreSizeDisplay && <p>{tyreSizeDisplay} &middot; SKU {sku}{quantity ? <> &middot; Qty {quantity}</> : null}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inq-name">Name <span className="text-red-500">*</span></Label>
              <Input id="inq-name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inq-email">Email <span className="text-red-500">*</span></Label>
              <Input id="inq-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className={isBooking ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : undefined}>
            <div className="space-y-1">
              <Label htmlFor="inq-phone">Phone (optional)</Label>
              <Input id="inq-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            {isBooking && (
              <div className="space-y-1">
                <Label htmlFor="inq-date">Preferred date</Label>
                <Input
                  id="inq-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="inq-message">Message (optional)</Label>
            <Textarea
              id="inq-message"
              rows={3}
              placeholder="Any questions or details you'd like to share."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending…' : isBooking ? 'Request Booking' : 'Send Inquiry'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
