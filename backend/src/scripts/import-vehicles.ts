/**
 * Onyx Tyres — Vehicle Fitment Importer
 *
 * Imports vehicles + tyre/wheel fitments from the csv_en / csv_nogen reference
 * datasets. Both files are semicolon-delimited with NO header row, 16 columns:
 *
 *   0  make
 *   1  model
 *   2  series
 *   3  variant (trim/engine)
 *   4  year
 *   5  front tyre size(s), "|"-delimited
 *   6  rear tyre size(s), "|"-delimited
 *   7  (unused)
 *   8  front wheel size(s), "|"-delimited, format "W x D EToffset"
 *   9  rear wheel size(s), "|"-delimited
 *   10 (unused)
 *   11 PCD, e.g. "5*114.3"
 *   12 centre bore
 *   13 bolt spec (thread pitch) — sometimes empty, see col 14
 *   14 bolt spec (alt column — inconsistent upstream, use whichever is non-empty)
 *   15 (unused)
 *
 * "0 x 0 ET0" is a "no data" sentinel for wheel fields — skipped, not parsed.
 *
 * csv_en.csv and csv_nogen.csv overlap substantially but not completely — rows
 * are deduplicated across both files on (make, model, series, variant, year),
 * with csv_en.csv treated as authoritative when both contain the same key.
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/import-vehicles.ts \
 *     --en-csv    "C:\path\to\csv_en.csv" \
 *     --nogen-csv "C:\path\to\csv_nogen.csv" \
 *     [--clear] [--limit 20]
 *
 * Required env vars (loaded from .env automatically):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config'
import * as fs from 'fs'
import Papa from 'papaparse'
import { supabase } from '../services/supabase.service'

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE     = 250
const LOG_EVERY       = 20
const INTER_BATCH_MS  = 80

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || !process.argv[i + 1]) {
    console.error(`\nMissing required argument: --${name}\n`)
    console.error(`Usage:\n  npx ts-node src/scripts/import-vehicles.ts \\`)
    console.error(`    --en-csv    "path/to/csv_en.csv" \\`)
    console.error(`    --nogen-csv "path/to/csv_nogen.csv" \\`)
    console.error(`    [--clear] [--limit 20]\n`)
    process.exit(1)
  }
  return process.argv[i + 1]!
}

function optArg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return (i !== -1 && process.argv[i + 1]) ? process.argv[i + 1]! : fallback
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parseVehicleCsv(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf8')
  const result  = Papa.parse<string[]>(content, {
    header:         false,
    delimiter:      ';',
    skipEmptyLines: true,
    dynamicTyping:  false,
  })
  if (result.errors.some(e => e.type === 'Delimiter')) {
    throw new Error(`CSV parse failed on ${filePath}: ${result.errors[0]?.message}`)
  }
  return result.data
}

/** "7.5 x 18 ET45" → { width: 7.5, diameter: 18, offset: 45 } — null for the "0 x 0 ET0" sentinel or malformed tokens. */
function parseWheelToken(token: string): { width: number; diameter: number; offset: number } | null {
  const m = token.trim().match(/^([\d.]+)\s*x\s*([\d.]+)\s*ET(-?[\d.]+)$/i)
  if (!m) return null
  const width    = parseFloat(m[1]!)
  const diameter = parseFloat(m[2]!)
  const offset   = parseFloat(m[3]!)
  if (!width || !diameter) return null // filters out the 0 x 0 ET0 sentinel
  return { width, diameter, offset }
}

function splitList(s: string): string[] {
  return (s ?? '').split('|').map(v => v.trim()).filter(Boolean)
}

// ─── Row types ────────────────────────────────────────────────────────────────

interface VehicleInsert {
  make:      string
  model:     string
  series:    string | null
  variant:   string | null
  year_from: number
  year_to:   number
}

interface TyreFitmentInsert {
  front_size:   string
  rear_size:    string | null
  is_staggered: boolean
}

interface WheelFitmentInsert {
  diameter_range: string
  width_range:    string
  pcd:            string
  offset_min:     number | null
  offset_max:     number | null
  centre_bore:    number | null
  notes:          string | null
}

interface ParsedRow {
  key:            string // make|model|series|variant|year — dedup key
  vehicle:        VehicleInsert
  tyreFitments:   TyreFitmentInsert[]
  wheelFitment:   WheelFitmentInsert | null
}

function parseRow(cols: string[]): ParsedRow | null {
  const make   = cols[0]?.trim()
  const model  = cols[1]?.trim()
  const series = cols[2]?.trim() || null
  const variant = cols[3]?.trim() || null
  const year   = parseInt(cols[4]?.trim() ?? '', 10)
  if (!make || !model || !year) return null

  const key = `${make}|${model}|${series ?? ''}|${variant ?? ''}|${year}`

  const vehicle: VehicleInsert = { make, model, series, variant, year_from: year, year_to: year }

  // ── Tyre fitments ──
  const frontSizes = splitList(cols[5] ?? '')
  const rearSizes  = splitList(cols[6] ?? '')
  const tyreFitments: TyreFitmentInsert[] = []
  const maxLen = Math.max(frontSizes.length, rearSizes.length)
  for (let i = 0; i < maxLen; i++) {
    const front = frontSizes[i] ?? frontSizes[0]
    const rear  = rearSizes[i] ?? null
    if (!front) continue
    tyreFitments.push({
      front_size:   front,
      rear_size:    rear,
      is_staggered: !!rear && rear !== front,
    })
  }

  // ── Wheel fitment (one aggregate row per vehicle) ──
  const pcd = cols[11]?.trim()
  let wheelFitment: WheelFitmentInsert | null = null
  if (pcd) {
    const tokens = [...splitList(cols[8] ?? ''), ...splitList(cols[9] ?? '')]
      .map(parseWheelToken)
      .filter((t): t is { width: number; diameter: number; offset: number } => t !== null)

    if (tokens.length > 0) {
      const widths     = tokens.map(t => t.width)
      const diameters   = tokens.map(t => t.diameter)
      const offsets     = tokens.map(t => t.offset)
      const centreBoreV = parseFloat(cols[12]?.trim() ?? '')
      const bolts       = cols[13]?.trim() || cols[14]?.trim() || null

      wheelFitment = {
        diameter_range: `${Math.min(...diameters)}-${Math.max(...diameters)}`,
        width_range:    `${Math.min(...widths)}-${Math.max(...widths)}`,
        pcd,
        offset_min:     Math.min(...offsets),
        offset_max:     Math.max(...offsets),
        centre_bore:    Number.isFinite(centreBoreV) ? centreBoreV : null,
        notes:          bolts ? `Bolts: ${bolts}` : null,
      }
    }
  }

  return { key, vehicle, tyreFitments, wheelFitment }
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function importVehicles(enCsvPath: string, nogenCsvPath: string, limit: number): Promise<void> {
  console.log('  Parsing csv_en.csv...')
  const enRows = parseVehicleCsv(enCsvPath)
  console.log(`  ${enRows.length.toLocaleString()} rows`)

  console.log('  Parsing csv_nogen.csv...')
  const nogenRows = parseVehicleCsv(nogenCsvPath)
  console.log(`  ${nogenRows.length.toLocaleString()} rows`)

  const seenKeys = new Set<string>()
  const parsed: ParsedRow[] = []
  let nogenSkipped = 0

  for (const cols of enRows) {
    const row = parseRow(cols)
    if (!row || seenKeys.has(row.key)) continue
    seenKeys.add(row.key)
    parsed.push(row)
  }

  for (const cols of nogenRows) {
    const row = parseRow(cols)
    if (!row) continue
    if (seenKeys.has(row.key)) { nogenSkipped++; continue }
    seenKeys.add(row.key)
    parsed.push(row)
  }

  const toImport = limit ? parsed.slice(0, limit) : parsed
  console.log(`  ${parsed.length.toLocaleString()} unique vehicle rows after cross-file dedup (${nogenSkipped.toLocaleString()} nogen duplicates skipped)`)
  if (limit) console.log(`  Limit active — importing first ${toImport.length.toLocaleString()} rows only`)

  let vehiclesInserted = 0, tyreFitmentsInserted = 0, wheelFitmentsInserted = 0, errors = 0
  const batches = chunks(toImport, BATCH_SIZE)

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!

    const { data, error } = await supabase
      .from('vehicles')
      .insert(batch.map(r => r.vehicle))
      .select('vehicle_id, make, model, series, variant, year_from')

    if (error) {
      console.warn(`\n  [vehicles] batch ${bi + 1} error: ${error.message}`)
      errors += batch.length
      continue
    }

    vehiclesInserted += data?.length ?? 0

    // Match returned IDs back to source rows by the same key tuple, in insertion order
    // (Supabase preserves array insert order in the returned rows).
    const tyreRows: (TyreFitmentInsert & { vehicle_id: string })[] = []
    const wheelRows: (WheelFitmentInsert & { vehicle_id: string })[] = []

    ;(data ?? []).forEach((v, i) => {
      const source = batch[i]!
      for (const tf of source.tyreFitments) {
        tyreRows.push({ ...tf, vehicle_id: v.vehicle_id as string })
      }
      if (source.wheelFitment) {
        wheelRows.push({ ...source.wheelFitment, vehicle_id: v.vehicle_id as string })
      }
    })

    if (tyreRows.length > 0) {
      const { error: tfErr } = await supabase.from('vehicle_tyre_fitments').insert(tyreRows)
      if (tfErr) console.warn(`\n  [tyre fitments] batch ${bi + 1} error: ${tfErr.message}`)
      else tyreFitmentsInserted += tyreRows.length
    }

    if (wheelRows.length > 0) {
      const { error: wfErr } = await supabase.from('vehicle_wheel_fitments').insert(wheelRows)
      if (wfErr) console.warn(`\n  [wheel fitments] batch ${bi + 1} error: ${wfErr.message}`)
      else wheelFitmentsInserted += wheelRows.length
    }

    if ((bi + 1) % LOG_EVERY === 0 || bi === batches.length - 1) {
      const pct = Math.round(((bi + 1) / batches.length) * 100)
      process.stdout.write(
        `\r  [${String(pct).padStart(3)}%] batch ${bi + 1}/${batches.length} — ` +
        `${vehiclesInserted.toLocaleString()} vehicles, ${tyreFitmentsInserted.toLocaleString()} tyre fitments, ` +
        `${wheelFitmentsInserted.toLocaleString()} wheel fitments, ${errors} errors   `
      )
    }

    await sleep(INTER_BATCH_MS)
  }

  process.stdout.write('\n')
  console.log(`  Done — ${vehiclesInserted.toLocaleString()} vehicles | ${tyreFitmentsInserted.toLocaleString()} tyre fitments | ${wheelFitmentsInserted.toLocaleString()} wheel fitments | ${errors} errors`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const enCsvPath    = arg('en-csv')
  const nogenCsvPath = arg('nogen-csv')
  const doClear      = hasFlag('clear')
  const limit        = parseInt(optArg('limit', '0'), 10) || 0 // 0 = no limit

  for (const p of [enCsvPath, nogenCsvPath]) {
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`)
      process.exit(1)
    }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }
  const { error: pingErr } = await supabase.from('vehicles').select('vehicle_id').limit(1)
  if (pingErr) {
    console.error(`Cannot connect to Supabase: ${pingErr.message}`)
    process.exit(1)
  }

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   Onyx Tyres — Vehicle Fitment Importer  ║')
  console.log('╚══════════════════════════════════════════╝\n')
  console.log(`en CSV     : ${enCsvPath}`)
  console.log(`nogen CSV  : ${nogenCsvPath}`)
  if (limit)   console.log(`limit      : ${limit} rows (test mode)`)
  if (doClear) console.log(`mode       : CLEAR then import`)
  console.log()

  console.time('Total elapsed')

  if (doClear) {
    console.log('── Phase 0: Clear existing vehicle data ──')
    process.stdout.write('  Deleting vehicles (fitments cascade)... ')
    const { error } = await supabase.from('vehicles').delete().neq('vehicle_id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`\nFailed: ${error.message}`)
      process.exit(1)
    }
    process.stdout.write('done\n')
  }

  console.log('\n── Importing vehicles + fitments ──')
  await importVehicles(enCsvPath, nogenCsvPath, limit)

  console.timeEnd('Total elapsed')
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
