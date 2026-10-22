'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toastError } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BOOKING_SERVICES, BOOKING_TIMES, type BookingRequest } from '@/lib/booking'

const EMPTY: BookingRequest = {
  name: '', email: '', phone: '', service: '', vehicle: '', tyreSize: '', date: '', time: '', message: '', website: '',
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm'

export default function BookingForm() {
  const [form, setForm] = useState<BookingRequest>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (key: keyof BookingRequest) =>
    (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/booking', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        toastError('Booking not sent', body.error ?? 'Please try again.')
        return
      }
      setForm(EMPTY)
      setSent(true)
    } catch {
      toastError('Booking not sent', 'Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <h3 className="mt-4 font-oswald text-2xl font-black uppercase tracking-tight text-zinc-950">
          Booking Request Sent
        </h3>
        <p className="mt-2 max-w-sm text-sm text-zinc-500 sm:text-base">
          Thanks! We&apos;ve received your request and will contact you shortly to confirm your booking.
        </p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => setSent(false)}>
          Make another booking
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — hidden from people, filled by bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={form.website}
        onChange={set('website')}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-name">Full name <span className="text-red-500">*</span></Label>
          <Input id="bk-name" value={form.name} onChange={set('name')} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-phone">Phone <span className="text-red-500">*</span></Label>
          <Input id="bk-phone" type="tel" value={form.phone} onChange={set('phone')} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-email">Email <span className="text-red-500">*</span></Label>
          <Input id="bk-email" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-service">Service <span className="text-red-500">*</span></Label>
          <select id="bk-service" className={selectClass} value={form.service} onChange={set('service')} required>
            <option value="" disabled>Select a service</option>
            {BOOKING_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-vehicle">Vehicle (make, model or reg)</Label>
          <Input id="bk-vehicle" placeholder="e.g. Toyota Corolla 2019" value={form.vehicle} onChange={set('vehicle')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-size">Tyre size (if known)</Label>
          <Input id="bk-size" placeholder="e.g. 205/55 R16" value={form.tyreSize} onChange={set('tyreSize')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-date">Preferred date <span className="text-red-500">*</span></Label>
          <Input
            id="bk-date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={form.date}
            onChange={set('date')}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-time">Preferred time</Label>
          <select id="bk-time" className={selectClass} value={form.time} onChange={set('time')}>
            <option value="">Any time</option>
            {BOOKING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bk-message">Anything else?</Label>
        <Textarea
          id="bk-message"
          rows={4}
          placeholder="Tell us more about what you need."
          value={form.message}
          onChange={set('message')}
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-full bg-primary px-8 font-oswald text-lg font-bold italic text-zinc-950 hover:bg-[#c89907]"
      >
        {submitting ? 'Sending…' : 'Request Booking'}
      </Button>
      <p className="text-center text-xs text-zinc-400">
        We&apos;ll call or email you to confirm your booking time.
      </p>
    </form>
  )
}
