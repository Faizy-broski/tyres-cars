/**
 * Onyx Tyres — Wheel Catalogue Importer
 *
 * Imports wheel_brands, wheels (models) and wheel_variants (size/PCD/offset specs)
 * from three reference CSV datasets. All three are semicolon-delimited with NO
 * header row.
 *
 *   csv_en.csv (13.9k rows)       — one row per wheel MODEL:
 *     0 vendor_id, 1 model_id, 2 vendor_name, 3 model_name, 4 material,
 *     5 vendor_url, 6 model_url, 7 photo, 8 (unused), 9 (unused), 10 (unused)
 *
 *   csv_full_en.csv (128.6k rows) — one row per wheel VARIANT:
 *     0 vendor_id, 1 model_id, 2 vendor_name, 3 model_name, 4 material,
 *     5 width, 6 diameter, 7 bolt_count, 8 pcd, 9 centre_bore, 10 offset, 11 colour,
 *     12 vendor_url, 13 model_url, 14 photo, 15 (unused), 16 (unused), 17 (unused)
 *
 *   csv_photos_en.csv (16.1k rows) — gallery, multiple rows per model_id:
 *     0 vendor_id, 1 model_id, 2 vendor_name, 3 model_name, 4 photo,
 *     5 (unused id), 6 colour_code, 7 type ('main' | 'normal'), 8 (unused)
 *
 * Image URLs: unlike the tyres dataset (whose `photo` column already embeds a
 * full relative path), the wheels `photo` column is a bare filename. The real
 * CDN URL has to be reconstructed as:
 *   https://cdn.tyresaddict.com/wheels/{vendor_url}/{model_url}/{photo}
 * (verified live against multiple brands before writing this importer).
 *
 * No style_category equivalent exists in the source data — left null, same as
 * vehicles.body_type in the vehicle importer. No SKU/EAN field for variants —
 * synthesized from brand+model+specs, mirroring seed-catalogue.ts's approach
 * for tyre SKUs without a real EAN.
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/import-wheels.ts \
 *     --models-csv   "C:\path\to\csv_en.csv" \
 *     --variants-csv "C:\path\to\csv_full_en.csv" \
 *     --photos-csv   "C:\path\to\csv_photos_en.csv" \
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

const BATCH_SIZE    = 250
const LOG_EVERY      = 20
const INTER_BATCH_MS = 80
const WHEEL_CDN_BASE = 'https://cdn.tyresaddict.com/wheels/'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || !process.argv[i + 1]) {
    console.error(`\nMissing required argument: --${name}\n`)
    console.error(`Usage:\n  npx ts-node src/scripts/import-wheels.ts \\`)
    console.error(`    --models-csv   "path/to/csv_en.csv" \\`)
    console.error(`    --variants-csv "path/to/csv_full_en.csv" \\`)
    console.error(`    --photos-csv   "path/to/csv_photos_en.csv" \\`)
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

function toSlug(s: string): string {
  return (s ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parseCsv(filePath: string): string[][] {
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

function buildWheelImageUrl(vendorUrl: string, modelUrl: string, photo: string): string | null {
  if (!vendorUrl || !modelUrl || !photo) return null
  return `${WHEEL_CDN_BASE}${vendorUrl}/${modelUrl}/${photo}`
}

/**
 * Supabase/PostgREST caps `.select()` at a default page size (commonly 1000
 * rows) regardless of table size — a plain `.select()` on a 13k+ row table
 * silently truncates. Page through with `.range()` until a short page comes back.
 */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  let from = 0
  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`Cannot load ${table}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return out
}

// ─── Phase 1: Brands ──────────────────────────────────────────────────────────

async function seedBrands(modelRows: string[][]): Promise<Map<string, string>> {
  const names = new Set<string>()
  for (const cols of modelRows) {
    const name = cols[2]?.trim()
    if (name) names.add(name)
  }
  console.log(`  ${names.size.toLocaleString()} distinct brands found`)

  // wheel_brands.brand_name has no UNIQUE constraint, so upsert-by-conflict
  // isn't possible — check what already exists, insert only the missing ones.
  const existing = await fetchAll<{ wheel_brand_id: string; brand_name: string }>('wheel_brands', 'wheel_brand_id, brand_name')
  const brandMap = new Map<string, string>()
  for (const b of existing) brandMap.set(b.brand_name, b.wheel_brand_id)

  const toInsert = [...names].filter(n => !brandMap.has(n)).map(brand_name => ({ brand_name }))
  console.log(`  ${toInsert.length.toLocaleString()} new brands to insert`)

  for (const batch of chunks(toInsert, BATCH_SIZE)) {
    const { data, error } = await supabase.from('wheel_brands').insert(batch).select('wheel_brand_id, brand_name')
    if (error) { console.warn(`  [brands] batch error: ${error.message}`); continue }
    for (const b of (data ?? [])) brandMap.set(b.brand_name as string, b.wheel_brand_id as string)
  }

  return brandMap
}

// ─── Phase 2: Photos ──────────────────────────────────────────────────────────

interface PhotoInfo { main: string | null; gallery: string[] }

function buildPhotosMap(photoRows: string[][]): Map<string, PhotoInfo> {
  const map = new Map<string, PhotoInfo>()
  for (const cols of photoRows) {
    const modelId  = cols[1]?.trim()
    const photo    = cols[4]?.trim()
    const type     = cols[7]?.trim()
    if (!modelId || !photo) continue

    // vendor_url/model_url aren't in this CSV — resolved later once we know
    // the model's vendor_url/model_url from csv_en.csv, so just stash the raw
    // filename here and build the URL in Phase 3 where those are in scope.
    if (!map.has(modelId)) map.set(modelId, { main: null, gallery: [] })
    const info = map.get(modelId)!
    if (!info.gallery.includes(photo)) info.gallery.push(photo)
    if (type === 'main') info.main = photo
  }
  return map
}

// ─── Phase 3: Wheels (models) ─────────────────────────────────────────────────

interface WheelInsert {
  wheel_brand_id: string
  model_name:     string
  model_slug:     string
  main_image:     string | null
  gallery_images: string[]
  finish:         string | null
}

async function seedWheels(
  modelRows: string[][],
  brandMap:  Map<string, string>,
  photosMap: Map<string, PhotoInfo>,
  limit:     number,
): Promise<Map<string, string>> {
  const deduped   = new Map<string, WheelInsert & { modelId: string }>() // modelId → insert row
  const slugTaken = new Set<string>()

  for (const cols of modelRows) {
    const vendorId   = cols[0]?.trim()
    const modelId    = cols[1]?.trim()
    const vendorName = cols[2]?.trim()
    const modelName  = cols[3]?.trim()
    const material   = cols[4]?.trim() || null
    const vendorUrl  = cols[5]?.trim()
    const modelUrl   = cols[6]?.trim()
    const photo      = cols[7]?.trim()
    if (!vendorId || !modelId || !vendorName || !modelName || !vendorUrl || !modelUrl) continue
    if (deduped.has(modelId)) continue

    const brandId = brandMap.get(vendorName)
    if (!brandId) continue

    const baseSlug = `${toSlug(vendorUrl)}-${toSlug(modelUrl)}`
    const slug     = slugTaken.has(baseSlug) ? `${baseSlug}-${modelId}` : baseSlug
    slugTaken.add(baseSlug)

    const photos = photosMap.get(modelId)
    const galleryFilenames = photos?.gallery.length ? photos.gallery : (photo ? [photo] : [])
    const mainFilename     = photos?.main ?? photo ?? galleryFilenames[0] ?? null

    const galleryUrls = galleryFilenames
      .map(f => buildWheelImageUrl(vendorUrl, modelUrl, f))
      .filter((u): u is string => u !== null)
    const mainUrl = mainFilename ? buildWheelImageUrl(vendorUrl, modelUrl, mainFilename) : null

    deduped.set(modelId, {
      modelId,
      wheel_brand_id: brandId,
      model_name:     modelName,
      model_slug:     slug,
      main_image:     mainUrl,
      gallery_images: galleryUrls,
      finish:         material,
    })
  }

  const all      = [...deduped.values()]
  const toInsert = limit ? all.slice(0, limit) : all
  console.log(`  ${toInsert.length.toLocaleString()} distinct wheel models found`)

  let inserted = 0
  for (const batch of chunks(toInsert, BATCH_SIZE)) {
    const rows = batch.map(({ modelId: _modelId, ...rest }) => rest)
    const { error } = await supabase.from('wheels').upsert(rows, { onConflict: 'model_slug', ignoreDuplicates: true })
    if (error) console.warn(`  [wheels] batch error: ${error.message}`)
    else inserted += batch.length
  }
  console.log(`  ${inserted.toLocaleString()} wheel model rows upserted`)

  // Reload to get authoritative wheel_ids, then map modelId → wheel_id via model_slug
  const allWheels = await fetchAll<{ wheel_id: string; model_slug: string }>('wheels', 'wheel_id, model_slug')
  const slugToWheelId = new Map<string, string>()
  for (const w of allWheels) slugToWheelId.set(w.model_slug, w.wheel_id)

  const modelIdToWheelId = new Map<string, string>()
  for (const row of toInsert) {
    const wheelId = slugToWheelId.get(row.model_slug)
    if (wheelId) modelIdToWheelId.set(row.modelId, wheelId)
  }
  return modelIdToWheelId
}

// ─── Phase 4: Wheel variants ───────────────────────────────────────────────────

async function seedVariants(
  variantsCsvPath: string,
  modelIdToWheelId: Map<string, string>,
  limit: number,
): Promise<void> {
  console.log('  Parsing csv_full_en.csv...')
  const allRows = parseCsv(variantsCsvPath)
  console.log(`  ${allRows.length.toLocaleString()} rows`)

  const skuSeen = new Map<string, Record<string, unknown>>()
  let skipped = 0

  for (const cols of allRows) {
    const vendorName = cols[2]?.trim()
    const modelName  = cols[3]?.trim()
    const modelId    = cols[1]?.trim()
    const width      = parseFloat(cols[5] ?? '')
    const diameter   = parseFloat(cols[6] ?? '')
    const boltCount  = cols[7]?.trim()
    const pcdVal     = cols[8]?.trim()
    const centreBore = parseFloat(cols[9] ?? '')
    const offsetVal  = parseFloat(cols[10] ?? '')
    const colour     = cols[11]?.trim() || null

    const wheelId = modelId ? modelIdToWheelId.get(modelId) : undefined
    if (!wheelId || !vendorName || !modelName || !width || !diameter || !pcdVal) { skipped++; continue }

    const pcd = boltCount ? `${boltCount}*${pcdVal}` : pcdVal

    const sku = [
      toSlug(vendorName),
      toSlug(modelName),
      `${width}x${diameter}`,
      `${boltCount ?? 'x'}x${pcdVal}`,
      `et${Number.isFinite(offsetVal) ? offsetVal : 'na'}`,
      colour ? toSlug(colour) : '',
    ].filter(Boolean).join('-')

    const record = {
      wheel_id:    wheelId,
      sku,
      diameter,
      width,
      pcd,
      offset:      Number.isFinite(offsetVal) ? offsetVal : 0,
      centre_bore: Number.isFinite(centreBore) ? centreBore : null,
      is_active:   true,
    }

    if (!skuSeen.has(sku)) skuSeen.set(sku, record) // first occurrence wins
  }

  const allUnique = [...skuSeen.values()]
  const uniqueRows = limit ? allUnique.slice(0, limit) : allUnique
  console.log(`  ${allUnique.length.toLocaleString()} unique variants after dedup (${skipped.toLocaleString()} skipped)${limit ? `, using first ${uniqueRows.length}` : ''}`)

  let inserted = 0, errors = 0
  const batches = chunks(uniqueRows, BATCH_SIZE)

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('wheel_variants')
      .upsert(batch, { onConflict: 'sku', ignoreDuplicates: true })

    if (error) {
      for (const row of batch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rowErr } = await (supabase as any).from('wheel_variants')
          .upsert([row], { onConflict: 'sku', ignoreDuplicates: true })
        if (rowErr) errors++
        else inserted++
      }
    } else {
      inserted += batch.length
    }

    if ((bi + 1) % LOG_EVERY === 0 || bi === batches.length - 1) {
      const pct = Math.round(((bi + 1) / batches.length) * 100)
      process.stdout.write(`\r  [${String(pct).padStart(3)}%] batch ${bi + 1}/${batches.length} — ${inserted.toLocaleString()} inserted, ${errors} errors   `)
    }

    await sleep(INTER_BATCH_MS)
  }

  process.stdout.write('\n')
  console.log(`  Done — ${inserted.toLocaleString()} inserted | ${errors} errors`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const modelsCsvPath   = arg('models-csv')
  const variantsCsvPath = arg('variants-csv')
  const photosCsvPath   = arg('photos-csv')
  const doClear = hasFlag('clear')
  const limit   = parseInt(optArg('limit', '0'), 10) || 0

  for (const p of [modelsCsvPath, variantsCsvPath, photosCsvPath]) {
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`)
      process.exit(1)
    }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }
  const { error: pingErr } = await supabase.from('wheel_brands').select('wheel_brand_id').limit(1)
  if (pingErr) {
    console.error(`Cannot connect to Supabase: ${pingErr.message}`)
    process.exit(1)
  }

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   Onyx Tyres — Wheel Catalogue Importer  ║')
  console.log('╚══════════════════════════════════════════╝\n')
  console.log(`models CSV   : ${modelsCsvPath}`)
  console.log(`variants CSV : ${variantsCsvPath}`)
  console.log(`photos CSV   : ${photosCsvPath}`)
  if (limit)   console.log(`limit        : ${limit} (test mode)`)
  if (doClear) console.log(`mode         : CLEAR then import`)
  console.log()

  console.time('Total elapsed')

  if (doClear) {
    console.log('── Phase 0: Clear existing wheel data ──')
    // wheel_variants.wheel_id and wheels.wheel_brand_id are both ON DELETE
    // RESTRICT (not CASCADE), so children must be deleted before parents.
    process.stdout.write('  Deleting wheel_variants... ')
    const { error: delVariantsErr } = await supabase.from('wheel_variants').delete().neq('wheel_variant_id', '00000000-0000-0000-0000-000000000000')
    if (delVariantsErr) { console.error(`\nFailed: ${delVariantsErr.message}`); process.exit(1) }
    process.stdout.write('done\n')
    process.stdout.write('  Deleting wheels... ')
    const { error: delWheelsErr } = await supabase.from('wheels').delete().neq('wheel_id', '00000000-0000-0000-0000-000000000000')
    if (delWheelsErr) { console.error(`\nFailed: ${delWheelsErr.message}`); process.exit(1) }
    process.stdout.write('done\n')
    process.stdout.write('  Deleting wheel_brands... ')
    const { error: delBrandsErr } = await supabase.from('wheel_brands').delete().neq('wheel_brand_id', '00000000-0000-0000-0000-000000000000')
    if (delBrandsErr) { console.error(`\nFailed: ${delBrandsErr.message}`); process.exit(1) }
    process.stdout.write('done\n')
  }

  console.log('\n── Phase 1: Brands ──')
  const modelRows = parseCsv(modelsCsvPath)
  console.log(`  ${modelRows.length.toLocaleString()} rows in models CSV`)
  const brandMap = await seedBrands(modelRows)

  console.log('\n── Phase 2: Photos ──')
  const photoRows = parseCsv(photosCsvPath)
  console.log(`  ${photoRows.length.toLocaleString()} rows in photos CSV`)
  const photosMap = buildPhotosMap(photoRows)
  console.log(`  ${photosMap.size.toLocaleString()} models have gallery photos`)

  console.log('\n── Phase 3: Wheels (models) ──')
  const modelIdToWheelId = await seedWheels(modelRows, brandMap, photosMap, limit)

  console.log('\n── Phase 4: Wheel Variants ──')
  await seedVariants(variantsCsvPath, modelIdToWheelId, limit)

  console.timeEnd('Total elapsed')
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
