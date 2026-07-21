/**
 * Onyx Tyres — Catalogue Seeder
 *
 * Seeds brands, patterns, SKUs and generation lineage from three reference CSV datasets.
 * Use --clear to wipe existing product data before importing.
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/seed-catalogue.ts \
 *     --brands-csv       "C:\path\to\csv.csv"             \
 *     --skus-csv         "C:\path\to\csv_full.csv"         \
 *     [--generations-csv "C:\path\to\csv_generations.csv"] \
 *     [--clear]                                            \
 *     [--limit 20]
 *
 * Required env vars (loaded from .env automatically):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * CSV format: semicolon-delimited, UTF-8, first row = headers.
 *
 * What gets seeded:
 *   csv.csv             (8 k rows)   → brands + patterns (with CDN image URLs)
 *   csv_full.csv        (216 k rows) → skus (with CDN variant_images; no prices / no stock)
 *   csv_generations.csv (opt.)       → skus.replacement_product_id via size-matched lineage
 */

import 'dotenv/config'
import * as fs from 'fs'
import Papa from 'papaparse'
import { supabase } from '../services/supabase.service'

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE      = 250        // rows per Supabase upsert call (kept modest to avoid payload limits)
const LOG_EVERY       = 20         // log progress every N batches
const INTER_BATCH_MS  = 80         // pause between SKU batches — avoids Supabase rate-limit
const CDN_BASE        = 'https://cdn.tyresaddict.com/tyres/'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || !process.argv[i + 1]) {
    console.error(`\nMissing required argument: --${name}\n`)
    console.error(`Usage:\n  npx ts-node src/scripts/seed-catalogue.ts \\`)
    console.error(`    --brands-csv "path/to/csv.csv" \\`)
    console.error(`    --skus-csv   "path/to/csv_full.csv" \\`)
    console.error(`    [--limit 20]\n`)
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

function toSlug(s: string): string {
  return (s ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function mapCarType(t: string): 'PCR' | '4x4' | 'TBR' {
  switch ((t ?? '').toLowerCase().trim()) {
    case 'truck': case 'tbr': case 'commercial': case 'van': case 'bus': return 'TBR'
    case 'suv':   case '4x4': case '4wd': case 'offroad': case 'lt':    return '4x4'
    default: return 'PCR'
  }
}

function mapSeason(s: string): 'summer' | 'winter' | 'all_season' | null {
  const lc = (s ?? '').toLowerCase().trim()
  if (lc === 'summer') return 'summer'
  if (lc === 'winter') return 'winter'
  if (lc.includes('all') || lc === 'four' || lc === '4season') return 'all_season'
  return null
}

function mapAutoClass(autoClass: string): string | null {
  const lc = (autoClass ?? '').toLowerCase().trim()
  if (!lc) return null
  // Stored as-is — performance_category is TEXT so the raw segment value is useful
  return lc
}

function mapTruckAxle(axle: string): string | null {
  switch ((axle ?? '').toLowerCase().trim()) {
    case 'steer': case 'front': return 'steer'
    case 'drive': case 'rear':  return 'drive'
    case 'trailer':             return 'trailer'
    case 'all_position': case 'all': return 'all_position'
    default: return null
  }
}

function buildTags(row: BrandsCsvRow): string[] | null {
  const tags: string[] = []
  const truthy = (v: string) => ['yes', 'on', '1', 'true', 'green'].includes((v ?? '').toLowerCase().trim())
  if (truthy(row.stud))  tags.push('studded')
  if (truthy(row.green)) tags.push('eco')
  if (truthy(row.oe))    tags.push('oe')
  return tags.length > 0 ? tags : null
}

function parseCsv<T extends Record<string, string>>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const result  = Papa.parse<T>(content, {
    header:        true,
    delimiter:     ';',
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  if (result.errors.some(e => e.type === 'Delimiter')) {
    throw new Error(`CSV parse failed on ${filePath}: ${result.errors[0]?.message}`)
  }
  return result.data
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Phase 0: Clear ───────────────────────────────────────────────────────────

async function clearProductData(): Promise<void> {
  // Single TRUNCATE ... CASCADE — Postgres resolves all FK dependencies automatically.
  // Requires the clear_product_catalogue() RPC to be deployed (see migration
  // supabase/migrations/20260622000000_clear_product_catalogue_fn.sql).
  process.stdout.write('  Running TRUNCATE ... CASCADE via RPC... ')
  const { error } = await supabase.rpc('clear_product_catalogue')
  if (error) {
    console.error(`\nFailed: ${error.message}`)
    console.error('  Make sure migration 20260622000000_clear_product_catalogue_fn.sql is applied.')
    process.exit(1)
  }
  process.stdout.write('done\n')
}

// ─── CSV row types ────────────────────────────────────────────────────────────

interface BrandsCsvRow {
  vendor_id:      string
  model_id:       string
  vendor_name:    string
  model_name:     string
  year:           string
  season:         string
  car_type:       string
  auto_class:     string   // vehicle segment: mid_family, suv, sport, luxury, economy …
  moto_type:      string   // motorcycle sub-type: cruiser | motocross | scooter | sport … | 'no'
  truck_axle:     string   // steer | drive | trailer | '' | 'no'
  stud:           string   // studded capability: 'yes' | '' | 'no'
  green:          string   // eco flag: 'green' | '' | 'yes'
  oe:             string   // original equipment flag: 'yes' | '' | 'no'
  vendor_url:     string
  model_url:      string
  photo:          string
  description_en: string
  [key: string]: string
}

interface GenCsvRow {
  model_id:      string
  model_prev_id: string
  [key: string]: string
}

interface SkusCsvRow {
  vendor_id:       string
  model_id:        string
  ean:             string
  vendor_name:     string
  model_name:      string
  model_year:      string
  season:          string
  car_type:        string
  eu_label_fuel:   string
  eu_label_wet:    string
  eu_label_noise:  string
  width:           string
  profile:         string
  diameter:        string
  load_index:      string
  speed_index:     string
  rof_flag:        string   // run-flat: 'on' | 'off'
  xl_flag:         string   // XL reinforced
  c_flag:          string   // commercial
  vendor_url:      string
  model_url:       string
  photo_name:      string
  [key: string]: string
}

// ─── Phase 1: Brands ──────────────────────────────────────────────────────────

async function seedBrands(rows: BrandsCsvRow[]): Promise<Map<string, string>> {
  // Deduplicate by vendor_name — first occurrence wins
  const deduped = new Map<string, { brand_name: string; brand_slug: string }>()

  for (const row of rows) {
    const name = row.vendor_name?.trim()
    if (!name || deduped.has(name)) continue
    const slug = row.vendor_url?.trim() ? toSlug(row.vendor_url) : toSlug(name)
    deduped.set(name, { brand_name: name, brand_slug: slug })
  }

  const toInsert = [...deduped.values()]
  console.log(`  ${toInsert.length} distinct brands found`)

  let ok = 0
  for (const batch of chunks(toInsert, BATCH_SIZE)) {
    const { error } = await supabase.from('brands').upsert(batch, {
      onConflict:      'brand_slug',
      ignoreDuplicates: true,
    })
    if (error) console.warn(`  [brands] batch error: ${error.message}`)
    else ok += batch.length
  }
  console.log(`  ${ok} brand rows upserted`)

  // Reload from DB to get authoritative IDs (handles rows that already existed)
  const { data, error } = await supabase.from('brands').select('brand_id, brand_name, brand_slug')
  if (error) throw new Error(`Cannot load brands: ${error.message}`)

  const brandMap = new Map<string, string>() // brand_name → brand_id
  for (const b of (data ?? [])) brandMap.set(b.brand_name as string, b.brand_id as string)
  return brandMap
}

// ─── Phase 2: Patterns ────────────────────────────────────────────────────────

interface PatternInsert {
  brand_id:                  string
  pattern_name:              string
  pattern_slug:              string
  pattern_short_description: string | null
  main_image:                string | null
  application_type:          'PCR' | '4x4' | 'TBR'
  season_type:               'summer' | 'winter' | 'all_season' | null
  performance_category:      string | null
  position_category:         string | null
  tags:                      string[] | null
  is_active:                 boolean
  show_on_website:           boolean
}

async function seedPatterns(
  rows:     BrandsCsvRow[],
  brandMap: Map<string, string>,
  limit:    number,
): Promise<Map<string, string>> {
  const deduped   = new Map<string, PatternInsert>()
  const slugTaken = new Set<string>() // tracks brand_id:slug combos already claimed

  for (const row of rows) {
    const brandId     = brandMap.get(row.vendor_name?.trim())
    const patternName = row.model_name?.trim()
    if (!brandId || !patternName) continue

    // Dedup key: vendor_id:model_id is always unique per model
    const key = `${row.vendor_id}:${row.model_id}`
    if (deduped.has(key)) continue

    // If two models share the same brand+slug, suffix the second with model_id
    const baseSlug     = row.model_url?.trim() ? toSlug(row.model_url) : toSlug(patternName)
    const brandSlugKey = `${brandId}:${baseSlug}`
    const slug         = slugTaken.has(brandSlugKey) ? `${baseSlug}-${row.model_id}` : baseSlug
    slugTaken.add(brandSlugKey)

    deduped.set(key, {
      brand_id:                  brandId,
      pattern_name:              patternName,
      pattern_slug:              slug,
      pattern_short_description: row.description_en?.trim() || null,
      main_image:                row.photo?.trim() ? `${CDN_BASE}${row.photo.trim()}` : null,
      application_type:          mapCarType(row.car_type),
      season_type:               mapSeason(row.season),
      performance_category:      mapAutoClass(row.auto_class),
      position_category:         mapTruckAxle(row.truck_axle),
      tags:                      buildTags(row),
      is_active:                 true,
      show_on_website:           true,
    })
  }

  const all      = [...deduped.values()]
  const toInsert = limit ? all.slice(0, limit) : all
  console.log(`  ${toInsert.length} distinct patterns found`)

  let ok = 0
  for (const batch of chunks(toInsert, BATCH_SIZE)) {
    const { error } = await supabase.from('patterns').upsert(batch, {
      onConflict:      'brand_id,pattern_slug',
      ignoreDuplicates: true,
    })
    if (error) console.warn(`  [patterns] batch error: ${error.message}`)
    else ok += batch.length
  }
  console.log(`  ${ok} pattern rows upserted`)

  // Reload from DB
  const { data, error } = await supabase
    .from('patterns')
    .select('pattern_id, brand_id, pattern_slug')
  if (error) throw new Error(`Cannot load patterns: ${error.message}`)

  const patternMap = new Map<string, string>() // `brandId:patternSlug` → pattern_id
  for (const p of (data ?? [])) {
    patternMap.set(`${p.brand_id as string}:${p.pattern_slug as string}`, p.pattern_id as string)
  }
  return patternMap
}

// ─── Phase 3: SKUs ────────────────────────────────────────────────────────────

async function seedSkus(
  csvPath:    string,
  brandMap:   Map<string, string>,
  patternMap: Map<string, string>,
  limit:      number,
): Promise<void> {
  console.log('  Parsing csv_full.csv...')
  const allRows = parseCsv<SkusCsvRow>(csvPath)
  const rows    = limit ? allRows.slice(0, limit) : allRows
  console.log(`  ${allRows.length.toLocaleString()} rows parsed${limit ? `, using first ${rows.length}` : ''}`)

  // Pre-build all SKU records and deduplicate by product_slug (first real EAN wins).
  // This prevents UNIQUE constraint errors from hitting the DB at all.
  const slugSeen = new Map<string, Record<string, unknown>>()
  let skipped = 0

  for (const row of rows) {
    const brandName  = row.vendor_name?.trim()
    const modelName  = row.model_name?.trim()
    if (!brandName || !modelName) { skipped++; continue }

    const brandId = brandMap.get(brandName)
    if (!brandId) { skipped++; continue }

    const patternSlug = row.model_url?.trim() ? toSlug(row.model_url) : toSlug(modelName)
    // Fall back to model_id-suffixed slug for the 5 known collision cases
    const patternId   = patternMap.get(`${brandId}:${patternSlug}`)
                     ?? patternMap.get(`${brandId}:${patternSlug}-${row.model_id}`)
    if (!patternId) { skipped++; continue }

    const w = parseFloat(row.width)
    const d = parseFloat(row.diameter)
    if (!w || !d) { skipped++; continue }

    const p  = parseFloat(row.profile) || null
    const li = row.load_index?.trim()  || null
    const sr = row.speed_index?.trim() || null

    const sizePart    = p ? `${w}/${p}R${d}` : `${w}R${d}`
    const sizeDisplay = li && sr ? `${sizePart} ${li}${sr}` : sizePart

    const rawEan = row.ean?.trim()
    const sku    = rawEan && rawEan !== '0'
      ? rawEan
      : `${toSlug(brandName)}-${toSlug(modelName)}-${w}-${p ?? 0}-r${d}-${li ?? 'xx'}${sr ?? 'xx'}`

    const productSlug = [
      toSlug(brandName),
      toSlug(modelName),
      `${w}-${p ?? 0}r${d}`,
      ((li ?? '') + (sr ?? '')).toLowerCase() || 'xx',
    ].join('-').replace(/[^a-z0-9-]/g, '')

    const rawEanVal = rawEan && rawEan !== '0' ? rawEan : null

    const record = {
      brand_id:              brandId,
      pattern_id:            patternId,
      sku,
      barcode_ean:           rawEanVal,
      tyre_size_display:     sizeDisplay,
      normalized_size_code:  sizePart,
      width:                 w,
      profile:               p,
      rim_size:              d,
      construction_type:     'R',
      load_index:            li,
      speed_rating:          sr,
      runflat:               row.rof_flag === 'on',
      xl_reinforced:         row.xl_flag  === 'on',
      load_range:            row.c_flag   === 'on' ? 'C' : null,
      fuel_rating:           row.eu_label_fuel?.trim()  || null,
      wet_grip:              row.eu_label_wet?.trim()   || null,
      // Source CSV uses "0" as a "no data" sentinel for noise (unlike fuel/wet, which are left blank)
      noise_db:              (row.eu_label_noise?.trim() && row.eu_label_noise.trim() !== '0') ? row.eu_label_noise.trim() : null,
      country_of_origin:     'Unknown',
      status:                'active',
      total_available_stock: 0,
      product_slug:          productSlug,
      variant_images:        row.photo_name?.trim() ? [`${CDN_BASE}${row.photo_name.trim()}`] : [],
    }

    // Keep first occurrence per product_slug; prefer rows that have a real EAN
    const existing = slugSeen.get(productSlug)
    if (!existing) {
      slugSeen.set(productSlug, record)
    } else if (rawEan && rawEan !== '0' && !(existing.sku as string).match(/^\d+$/)) {
      slugSeen.set(productSlug, record) // replace synthesised sku with real EAN
    } else {
      skipped++
    }
  }

  const uniqueRows = [...slugSeen.values()]
  console.log(`  ${uniqueRows.length.toLocaleString()} unique SKUs after dedup (${skipped} duplicates removed)`)

  let inserted = 0, errors = 0
  const batches = chunks(uniqueRows, BATCH_SIZE)

  for (let bi = 0; bi < batches.length; bi++) {
    const toInsert = batches[bi]!

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('skus')
      .upsert(toInsert, { onConflict: 'product_slug', ignoreDuplicates: true })

    if (error) {
      // Fall back to row-by-row — isolates any remaining bad row
      for (const row of toInsert) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rowErr } = await (supabase as any).from('skus')
          .upsert([row], { onConflict: 'product_slug', ignoreDuplicates: true })
        if (rowErr) errors++
        else inserted++
      }
    } else {
      inserted += toInsert.length
    }

    if ((bi + 1) % LOG_EVERY === 0 || bi === batches.length - 1) {
      const pct = Math.round(((bi + 1) / batches.length) * 100)
      process.stdout.write(
        `\r  [${String(pct).padStart(3)}%] batch ${bi + 1}/${batches.length} — ` +
        `${inserted.toLocaleString()} inserted, ${skipped} skipped, ${errors} errors   `
      )
    }

    // Gentle pause — keeps us well under Supabase's rate limit on any plan
    await sleep(INTER_BATCH_MS)
  }

  process.stdout.write('\n')
  console.log(`  Done — ${inserted.toLocaleString()} inserted | ${skipped} skipped | ${errors} errors`)
}

// ─── Phase 4: Generations ─────────────────────────────────────────────────────
//
// Links old-generation SKUs to their successor via skus.replacement_product_id.
// Matching is done by normalized size code derived from csv_full.csv rows so that
// a 205/55R16 variant of model A points to the 205/55R16 variant of model B.

async function seedGenerations(genCsvPath: string, skusCsvPath: string): Promise<void> {
  console.log('  Parsing csv_generations.csv...')
  const genRows = parseCsv<GenCsvRow>(genCsvPath)
  console.log(`  ${genRows.length.toLocaleString()} generation pairs`)

  // Build map: new_model_id → prev_model_id
  const genMap = new Map<string, string>()
  for (const r of genRows) {
    if (r.model_id && r.model_prev_id) genMap.set(r.model_id.trim(), r.model_prev_id.trim())
  }

  console.log('  Parsing csv_full.csv for size → product_slug mapping...')
  const skusRows = parseCsv<SkusCsvRow>(skusCsvPath)

  // Build map: model_id → { sizeCode → product_slug }
  const modelSizeToSlug = new Map<string, Map<string, string>>()
  for (const row of skusRows) {
    const modelId   = row.model_id?.trim()
    const brandName = row.vendor_name?.trim()
    const modelName = row.model_name?.trim()
    if (!modelId || !brandName || !modelName) continue

    const w  = parseFloat(row.width)
    const d  = parseFloat(row.diameter)
    if (!w || !d) continue
    const p  = parseFloat(row.profile) || null
    const li = row.load_index?.trim()  || null
    const sr = row.speed_index?.trim() || null

    const sizePart   = p ? `${w}/${p}R${d}` : `${w}R${d}`
    const productSlug = [
      toSlug(brandName),
      toSlug(modelName),
      `${w}-${p ?? 0}r${d}`,
      ((li ?? '') + (sr ?? '')).toLowerCase() || 'xx',
    ].join('-').replace(/[^a-z0-9-]/g, '')

    if (!modelSizeToSlug.has(modelId)) modelSizeToSlug.set(modelId, new Map())
    // First occurrence wins — mirrors the dedup logic in seedSkus so slugs stay in sync
    if (!modelSizeToSlug.get(modelId)!.has(sizePart)) {
      modelSizeToSlug.get(modelId)!.set(sizePart, productSlug)
    }
  }

  // For each generation pair, match by size and update replacement_product_id
  let linked = 0, skipped = 0
  const updatePairs: Array<{ prevSlug: string; newSlug: string }> = []

  for (const [newModelId, prevModelId] of genMap) {
    const newSizes  = modelSizeToSlug.get(newModelId)
    const prevSizes = modelSizeToSlug.get(prevModelId)
    if (!newSizes || !prevSizes) { skipped++; continue }

    for (const [sizeCode, newSlug] of newSizes) {
      const prevSlug = prevSizes.get(sizeCode)
      if (prevSlug) updatePairs.push({ prevSlug, newSlug })
    }
  }

  console.log(`  ${updatePairs.length.toLocaleString()} size-matched pairs to link`)
  if (updatePairs.length === 0) return

  // ── Step 1: Fetch product_ids for all involved slugs ──────────────────────
  // Batch size 50 — Supabase REST uses GET params; large .in() arrays exceed URL limits.
  const allSlugs = [...new Set(updatePairs.flatMap(p => [p.prevSlug, p.newSlug]))]
  const slugToId = new Map<string, string>()
  console.log(`  Fetching product_ids for ${allSlugs.length.toLocaleString()} slugs...`)

  for (const batch of chunks(allSlugs, 50)) {
    const { data, error } = await supabase
      .from('skus')
      .select('product_id, product_slug')
      .in('product_slug', batch)
    if (error) { console.warn(`  [generations] fetch error: ${error.message}`); continue }
    for (const row of (data ?? [])) slugToId.set(row.product_slug as string, row.product_id as string)
    await sleep(50)
  }

  // ── Step 2: Resolve UUIDs and batch-update via RPC ────────────────────────
  // link_replacement_products(prev_ids[], new_ids[]) does a single SQL UPDATE
  // per batch — reduces ~6000 individual API calls to ~12 RPC calls.
  const prevIds: string[] = []
  const newIds:  string[] = []

  for (const { prevSlug, newSlug } of updatePairs) {
    const prevId = slugToId.get(prevSlug)
    const newId  = slugToId.get(newSlug)
    if (!prevId || !newId) { skipped++; continue }
    prevIds.push(prevId)
    newIds.push(newId)
  }

  console.log(`  Slugs resolved in DB: ${slugToId.size.toLocaleString()} / ${allSlugs.length.toLocaleString()}`)
  console.log(`  Linking ${prevIds.length.toLocaleString()} pairs via RPC batches...`)
  const RPC_BATCH = 500
  for (let i = 0; i < prevIds.length; i += RPC_BATCH) {
    const { error } = await supabase.rpc('link_replacement_products', {
      prev_ids: prevIds.slice(i, i + RPC_BATCH),
      new_ids:  newIds.slice(i, i + RPC_BATCH),
    })
    if (error) {
      console.warn(`  [generations] RPC error at batch ${Math.floor(i / RPC_BATCH) + 1}: ${error.message}`)
      skipped += Math.min(RPC_BATCH, prevIds.length - i)
      continue
    }
    linked += Math.min(RPC_BATCH, prevIds.length - i)
    process.stdout.write(`\r  linked ${linked.toLocaleString()} / ${prevIds.length.toLocaleString()}   `)
    await sleep(80)
  }

  process.stdout.write('\n')
  console.log(`  Done — ${linked.toLocaleString()} linked | ${skipped} skipped`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const brandsCsvPath = arg('brands-csv')
  const skusCsvPath   = arg('skus-csv')
  const genCsvPath    = process.argv.includes('--generations-csv')
    ? optArg('generations-csv', '')
    : ''
  const doClear = hasFlag('clear')
  const limit   = parseInt(optArg('limit', '0'), 10) || 0  // 0 = no limit

  const requiredFiles = [brandsCsvPath, skusCsvPath]
  if (genCsvPath) requiredFiles.push(genCsvPath)
  for (const p of requiredFiles) {
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`)
      process.exit(1)
    }
  }

  // Validate Supabase connection
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }
  const { error: pingErr } = await supabase.from('brands').select('brand_id').limit(1)
  if (pingErr) {
    console.error(`Cannot connect to Supabase: ${pingErr.message}`)
    process.exit(1)
  }

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   Onyx Tyres — Catalogue Seeder          ║')
  console.log('╚══════════════════════════════════════════╝\n')
  console.log(`brands CSV      : ${brandsCsvPath}`)
  console.log(`skus CSV        : ${skusCsvPath}`)
  if (genCsvPath) console.log(`generations CSV : ${genCsvPath}`)
  if (limit)      console.log(`limit           : ${limit} patterns / ${limit} SKUs (test mode)`)
  if (doClear)    console.log(`mode            : CLEAR then import`)
  console.log()

  console.time('Total elapsed')

  // ── Phase 0: Clear ──────────────────────────────────────────────────────────
  if (doClear) {
    console.log('── Phase 0: Clear existing product data ──')
    await clearProductData()
  }

  // ── Phase 1: Brands ─────────────────────────────────────────────────────────
  console.log('\n── Phase 1: Brands ──')
  const brandRows = parseCsv<BrandsCsvRow>(brandsCsvPath)
  console.log(`  ${brandRows.length.toLocaleString()} rows in brands CSV`)
  const brandMap = await seedBrands(brandRows)

  // ── Phase 2: Patterns ────────────────────────────────────────────────────────
  console.log('\n── Phase 2: Patterns ──')
  const patternMap = await seedPatterns(brandRows, brandMap, limit)

  // ── Phase 3: SKUs ────────────────────────────────────────────────────────────
  console.log('\n── Phase 3: SKUs ──')
  await seedSkus(skusCsvPath, brandMap, patternMap, limit)

  // ── Phase 4: Generations ─────────────────────────────────────────────────────
  if (genCsvPath) {
    console.log('\n── Phase 4: Generations (replacement_product_id) ──')
    await seedGenerations(genCsvPath, skusCsvPath)
  }

  console.log('\n── Complete ──')
  console.timeEnd('Total elapsed')
  console.log()
}

main().catch(err => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
