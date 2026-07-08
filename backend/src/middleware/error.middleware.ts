import { Request, Response, NextFunction } from 'express'

// Postgres error codes we can surface safely as 400 / 409 responses.
// See https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_CONSTRAINT_CODES: Record<string, (err: PgError) => string> = {
  // Not-null violation  →  "Country of origin is required."
  '23502': (e) => {
    const col = e.column ?? extractQuoted(e.message, 1)
    return col ? `${humanise(col)} is required.` : 'A required field is missing.'
  },
  // Unique violation    →  "A record with this SKU already exists."
  '23505': (e) => {
    const constraint = e.constraint ?? ''
    const col = e.column ?? extractQuoted(e.message, 1)
    if (constraint.includes('sku'))    return 'A product with this SKU already exists.'
    if (constraint.includes('slug'))   return 'A record with this slug already exists.'
    if (constraint.includes('email'))  return 'This email address is already in use.'
    if (constraint.includes('phone'))  return 'This phone number is already in use.'
    return col ? `A record with this ${humanise(col)} already exists.` : 'A duplicate record already exists.'
  },
  // Foreign-key violation  →  "The selected Brand does not exist."
  '23503': (e) => {
    const col = e.column ?? extractQuoted(e.message, 1)
    return col ? `The selected ${humanise(col)} does not exist or has been deleted.` : 'A referenced record does not exist.'
  },
  // Check constraint  →  "Value for status is invalid."
  '23514': (e) => {
    const col = e.column ?? extractQuoted(e.constraint ?? '', 0)
    return col ? `Value for ${humanise(col)} is invalid.` : 'A field value failed a validation check.'
  },
  // String too long
  '22001': (e) => {
    const col = e.column ?? extractQuoted(e.message, 1)
    return col ? `${humanise(col)} exceeds the maximum allowed length.` : 'A value exceeds the maximum allowed length.'
  },
  // Invalid text representation (e.g. bad UUID / enum value)
  '22P02': (_e) => 'One or more fields contain an invalid value format.',
  // Restrict / cascade violation (e.g. delete blocked by related rows)
  '23001': (_e) => 'This record cannot be deleted because it is referenced by other records.',
}

interface PgError extends Error {
  code?:       string
  column?:     string
  constraint?: string
  detail?:     string
  hint?:       string
}

function extractQuoted(str: string, index: number): string | undefined {
  const matches = str.match(/"([^"]+)"/g)
  if (!matches) return undefined
  const raw = matches[index]
  return raw ? raw.replace(/"/g, '') : undefined
}

function humanise(col: string): string {
  return col
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function errorMiddleware(
  err: PgError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const pgCode = err?.code

  // Surface known Postgres constraint violations as user-friendly 400 / 409s.
  if (pgCode && PG_CONSTRAINT_CODES[pgCode]) {
    const friendly = PG_CONSTRAINT_CODES[pgCode](err)
    const status = pgCode === '23505' ? 409 : 400
    res.status(status).json({ error: friendly, code: pgCode })
    return
  }

  // Custom application-level errors thrown with a .code property
  if ((err as NodeJS.ErrnoException).code === 'SUPPLIER_HAS_PURCHASE_ORDERS') {
    res.status(409).json({ error: err.message })
    return
  }

  const message = err?.message ?? String(err)
  const stack   = err?.stack   ?? message
  console.error('[error]', stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  })
}
