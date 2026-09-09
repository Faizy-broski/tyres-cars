import { Worker, type Job } from 'bullmq'
import nodemailer from 'nodemailer'

const connection = {
  url: process.env.UPSTASH_REDIS_URL!,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
}

// Lazily create transporter — only when SMTP env vars are present
let _transporter: nodemailer.Transporter | null = null
function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter
  const host = process.env.SMTP_HOST
  if (!host) return null
  _transporter = nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return _transporter
}

export type NotificationJobData =
  | { type: 'order_confirmed';       customer_email: string; order_number: string; total_amount: number; items?: Array<{ name: string; qty: number; price: number }>; fitment_centre?: string; scheduled_date?: string }
  | { type: 'shipment_tracking';     customer_email: string; order_number: string; tracking_number: string; tracking_url: string; carrier: string }
  | { type: 'delivery_confirmation'; customer_email: string; order_number: string; delivered_at: string }
  | { type: 'fitment_job_assigned';  fitter_email: string;   job_id: string; job_number?: string; customer_name?: string; customer_contact?: string; scheduled_date: string; scheduled_time?: string }
  | { type: 'fitment_job_completed'; customer_email: string; order_number: string }
  | { type: 'stock_low_alert';       admin_email: string; product_id: string; sku: string; stock: number }
  | { type: 'supplier_import_done';  admin_email: string; supplier_id: string; results: Record<string, number> }
  | { type: 'price_match_request';   customer_name: string; customer_email: string; customer_phone?: string; message: string; product_id: string; sku: string; product_name?: string; tyre_size_display?: string; price?: number; product_url?: string }
  | { type: 'product_inquiry_request'; customer_name: string; customer_email: string; customer_phone?: string; message?: string; product_id: string; sku: string; product_name?: string; tyre_size_display?: string; product_url?: string }
  | { type: 'contact_request';        customer_name: string; customer_email: string; customer_phone?: string; subject?: string; message: string }

// ── Nodemailer email sender ────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log(`[Notification] (no SMTP config) Would send "${subject}" → ${to}`)
    return
  }
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM ?? '"Tyres & Car Valeting" <noreply@tyrevault.com.au>',
    to,
    subject,
    html,
  })
}

// ── Email templates ────────────────────────────────────────────
function tplOrderConfirmed(d: Extract<NotificationJobData, { type: 'order_confirmed' }>): string {
  const rows = (d.items ?? []).map(i =>
    `<tr><td style="padding:6px 8px">${i.name}</td><td style="padding:6px 8px;text-align:center">${i.qty}</td><td style="padding:6px 8px;text-align:right">$${(i.price * i.qty).toFixed(2)}</td></tr>`
  ).join('')
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>Order Confirmed</h2>
    <p>Your reference: <strong>${d.order_number}</strong></p>
    ${rows ? `<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f4f4f5"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2" style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-weight:bold;text-align:right">$${d.total_amount.toFixed(2)}</td></tr></tfoot></table>` : ''}
    ${d.fitment_centre ? `<p>Fitment booked at <strong>${d.fitment_centre}</strong>${d.scheduled_date ? ` on ${d.scheduled_date}` : ''}.</p>` : ''}
    <p style="color:#71717a;font-size:12px">Prices include GST. Questions? Email support@tyrevault.com.au</p>
  </div>`
}

function tplShipmentTracking(d: Extract<NotificationJobData, { type: 'shipment_tracking' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>Your order is on its way!</h2>
    <p>Order <strong>${d.order_number}</strong> shipped via ${d.carrier}.</p>
    <p>Tracking: <strong>${d.tracking_number}</strong></p>
    <p><a href="${d.tracking_url}" style="color:#2563eb">Track your parcel →</a></p>
  </div>`
}

function tplDeliveryConfirmation(d: Extract<NotificationJobData, { type: 'delivery_confirmation' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>Order delivered!</h2>
    <p>Order <strong>${d.order_number}</strong> was delivered on ${new Date(d.delivered_at).toLocaleDateString('en-AU')}.</p>
    <p>We hope you love your new tyres. Please consider leaving us a review!</p>
  </div>`
}

function tplFitterAssignment(d: Extract<NotificationJobData, { type: 'fitment_job_assigned' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>New Fitment Job Assigned</h2>
    <p>Job: <strong>${d.job_number ?? d.job_id}</strong></p>
    ${d.customer_name ? `<p>Customer: ${d.customer_name}${d.customer_contact ? ` — ${d.customer_contact}` : ''}</p>` : ''}
    <p>Scheduled: ${d.scheduled_date}${d.scheduled_time ? ` at ${d.scheduled_time}` : ''}</p>
  </div>`
}

function tplPriceMatchRequest(d: Extract<NotificationJobData, { type: 'price_match_request' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>Price Match Request</h2>
    <p><strong>${d.product_name ?? d.sku}</strong>${d.tyre_size_display ? ` — ${d.tyre_size_display}` : ''}</p>
    <p>SKU: ${d.sku} &nbsp;|&nbsp; Product ID: ${d.product_id}${d.price != null ? ` &nbsp;|&nbsp; Our price: $${d.price.toFixed(2)}` : ''}</p>
    ${d.product_url ? `<p><a href="${d.product_url}" style="color:#2563eb">View product →</a></p>` : ''}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0" />
    <p>Customer: <strong>${d.customer_name}</strong> — ${d.customer_email}${d.customer_phone ? ` — ${d.customer_phone}` : ''}</p>
    <p style="white-space:pre-wrap">${d.message}</p>
  </div>`
}

function tplProductInquiryRequest(d: Extract<NotificationJobData, { type: 'product_inquiry_request' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>Product Inquiry</h2>
    <p><strong>${d.product_name ?? d.sku}</strong>${d.tyre_size_display ? ` — ${d.tyre_size_display}` : ''}</p>
    <p>SKU: ${d.sku} &nbsp;|&nbsp; Product ID: ${d.product_id}</p>
    ${d.product_url ? `<p><a href="${d.product_url}" style="color:#2563eb">View product →</a></p>` : ''}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0" />
    <p>Customer: <strong>${d.customer_name}</strong> — ${d.customer_email}${d.customer_phone ? ` — ${d.customer_phone}` : ''}</p>
    ${d.message ? `<p style="white-space:pre-wrap">${d.message}</p>` : ''}
  </div>`
}

function tplContactRequest(d: Extract<NotificationJobData, { type: 'contact_request' }>): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
    <h2>New Contact Message${d.subject ? `: ${d.subject}` : ''}</h2>
    <p>From: <strong>${d.customer_name}</strong> — ${d.customer_email}${d.customer_phone ? ` — ${d.customer_phone}` : ''}</p>
    <p style="white-space:pre-wrap">${d.message}</p>
  </div>`
}

// ── Worker ─────────────────────────────────────────────────────
export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job: Job<NotificationJobData>) => {
    const { data } = job

    switch (data.type) {
      case 'order_confirmed':
        await sendEmail(data.customer_email, `Order Confirmed — ${data.order_number}`, tplOrderConfirmed(data))
        break
      case 'shipment_tracking':
        await sendEmail(data.customer_email, `Your order ${data.order_number} has shipped`, tplShipmentTracking(data))
        break
      case 'delivery_confirmation':
        await sendEmail(data.customer_email, `Order ${data.order_number} delivered`, tplDeliveryConfirmation(data))
        break
      case 'fitment_job_assigned':
        await sendEmail(data.fitter_email, `New fitment job ${data.job_number ?? data.job_id}`, tplFitterAssignment(data))
        break
      case 'fitment_job_completed':
        console.log(`[Notification] Fitment completed → ${data.customer_email} | #${data.order_number}`)
        break
      case 'stock_low_alert':
        console.log(`[Notification] Low stock: SKU ${data.sku} = ${data.stock} units`)
        break
      case 'supplier_import_done':
        console.log(`[Notification] Import done for ${data.supplier_id}:`, data.results)
        break
      case 'price_match_request':
        await sendEmail(
          process.env.SUPPORT_EMAIL ?? 'support@tyrevault.com.au',
          `Price Match Request — ${data.sku}`,
          tplPriceMatchRequest(data)
        )
        break
      case 'product_inquiry_request':
        await sendEmail(
          process.env.SUPPORT_EMAIL ?? 'support@tyrevault.com.au',
          `Product Inquiry — ${data.sku}`,
          tplProductInquiryRequest(data)
        )
        break
      case 'contact_request':
        await sendEmail(
          process.env.SUPPORT_EMAIL ?? 'support@tyrevault.com.au',
          data.subject ? `Contact Form: ${data.subject}` : 'New Contact Form Message',
          tplContactRequest(data)
        )
        break
    }
  },
  { connection, concurrency: 20 }
)

notificationWorker.on('failed', (job, err) => {
  console.error(`[Notification] Job ${job?.id} failed:`, err.message)
})
