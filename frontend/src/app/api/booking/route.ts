import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { BOOKING_SERVICES, type BookingRequest } from '@/lib/booking'

/**
 * Booking form submission → email to the business.
 *
 * Env (server-only):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  — any SMTP provider (Gmail app password, Outlook, Zoho…)
 *   BOOKING_TO_EMAIL                            — inbox that receives bookings (comma-separate for several)
 *   BOOKING_FROM_EMAIL (optional)               — sender address; defaults to SMTP_USER
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function POST(request: NextRequest) {
  let raw: Partial<BookingRequest>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Bots fill every field — pretend success so they don't retry.
  if (clean(raw.website)) return NextResponse.json({ ok: true })

  const booking = {
    name:     clean(raw.name, 120),
    email:    clean(raw.email, 200),
    phone:    clean(raw.phone, 40),
    service:  clean(raw.service, 60),
    vehicle:  clean(raw.vehicle, 120),
    tyreSize: clean(raw.tyreSize, 40),
    date:     clean(raw.date, 20),
    time:     clean(raw.time, 40),
    message:  clean(raw.message, 2000),
  }

  if (!booking.name || !booking.phone || !booking.date || !EMAIL_RE.test(booking.email)) {
    return NextResponse.json({ error: 'Please fill in your name, a valid email, phone and preferred date.' }, { status: 400 })
  }
  if (!(BOOKING_SERVICES as readonly string[]).includes(booking.service)) {
    return NextResponse.json({ error: 'Please choose a service.' }, { status: 400 })
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, BOOKING_TO_EMAIL, BOOKING_FROM_EMAIL } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !BOOKING_TO_EMAIL) {
    console.error('[booking] SMTP_HOST / SMTP_USER / SMTP_PASS / BOOKING_TO_EMAIL not configured')
    return NextResponse.json({ error: 'Online booking is temporarily unavailable. Please call us instead.' }, { status: 503 })
  }

  const port = Number(SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port,
    secure: port === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  })

  const rows: [string, string][] = [
    ['Name',           booking.name],
    ['Email',          booking.email],
    ['Phone',          booking.phone],
    ['Service',        booking.service],
    ['Vehicle',        booking.vehicle],
    ['Tyre size',      booking.tyreSize],
    ['Preferred date', booking.date],
    ['Preferred time', booking.time],
    ['Message',        booking.message],
  ]
  const filled = rows.filter(([, v]) => v)

  const text = filled.map(([k, v]) => `${k}: ${v}`).join('\n')
  const html = `
    <h2 style="font-family:sans-serif">New booking request</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
      ${filled.map(([k, v]) => `
        <tr>
          <td style="padding:6px 16px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td>
          <td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td>
        </tr>`).join('')}
    </table>`

  try {
    await transporter.sendMail({
      from:    BOOKING_FROM_EMAIL || SMTP_USER,
      to:      BOOKING_TO_EMAIL,
      replyTo: booking.email,
      subject: `New booking: ${booking.service} — ${booking.name} (${booking.date})`,
      text,
      html,
    })
  } catch (err) {
    console.error('[booking] send failed', err)
    return NextResponse.json({ error: "We couldn't send your booking. Please try again or call us." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
