'use client'

import { useState, type FormEvent } from 'react'
import { toastSuccess, toastError } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      toastError('Please fill in your name, email and message.')
      return
    }
    setSubmitting(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone: phone || undefined, subject: subject || undefined, message,
        }),
      })
      if (!res.ok) throw new Error('Failed to send message')

      toastSuccess('Message sent', "We'll get back to you shortly.")
      setName(''); setEmail(''); setPhone(''); setSubject(''); setMessage('')
    } catch (err) {
      console.error('[ContactForm] submit error', err)
      toastError('Something went wrong', 'Please try again or email support@tyrevault.com.au directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name <span className="text-red-500">*</span></Label>
          <Input id="contact-name" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email <span className="text-red-500">*</span></Label>
          <Input id="contact-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">Phone (optional)</Label>
          <Input id="contact-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-subject">Subject (optional)</Label>
          <Input id="contact-subject" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Message <span className="text-red-500">*</span></Label>
        <Textarea
          id="contact-message"
          rows={5}
          placeholder="How can we help you?"
          value={message}
          onChange={e => setMessage(e.target.value)}
          required
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-full bg-primary px-8 font-oswald text-lg font-bold italic text-zinc-950 hover:bg-[#c89907]"
      >
        {submitting ? 'Sending…' : 'Send Message'}
      </Button>
    </form>
  )
}
