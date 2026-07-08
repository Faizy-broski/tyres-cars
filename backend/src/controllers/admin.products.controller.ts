import type { Request, Response, NextFunction } from 'express'
import * as ProductsService from '../services/products.service'
import Papa from 'papaparse'
import { randomUUID } from 'crypto'
import { enqueueCatalogImport, getCatalogImportJob } from '../services/admin.catalog-import.service'

type P = Record<string, string>

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ProductsService.listProducts({
      search:    String(req.query.search    ?? ''),
      brandId:   String(req.query.brandId   ?? ''),
      patternId: String(req.query.patternId ?? ''),
      status:    String(req.query.status    ?? ''),
      stock:     String(req.query.stock     ?? ''),
      page:      req.query.page  ? Number(req.query.page)  : 1,
      limit:     req.query.limit ? Number(req.query.limit) : 20,
      sortBy:    (req.query.sortBy as 'updated_at' | 'created_at' | 'pattern_name' | 'show_on_website' | 'brand_name') ?? 'updated_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') ?? 'desc',
    })
    res.json(result)
  } catch (err) { next(err) }
}

export async function searchSkus(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? '')
    const limit = Number(req.query.limit ?? 20)
    const result = await ProductsService.searchSkus(q, limit)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ProductsService.getProduct(String((req.params as P).id))
    res.json(result)
  } catch (err) { next(err) }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ProductsService.createProduct(req.body)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String((req.params as P).id)
    await ProductsService.updateProduct(id, req.body)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function publishProduct(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.publishProduct(
      String((req.params as P).id),
      req.body.publish !== undefined ? req.body.publish === true : undefined,
      req.body.active  !== undefined ? req.body.active  === true : undefined,
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function patchVariant(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.patchVariant(
      String((req.params as P).variantId),
      req.body
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function addVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = await ProductsService.addVariant(
      String((req.params as P).id),
      req.body.variant,
      req.body.pricing
    )
    res.status(201).json({ product_id: productId })
  } catch (err) { next(err) }
}

export async function updateVariantStock(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateVariantStock(
      String((req.params as P).variantId),
      req.body.warehouseId,
      req.body.availableStock,
      req.body.lowStockAlert
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteProduct(String((req.params as P).id))
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function deleteVariant(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteVariant(String((req.params as P).variantId))
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function updateVariantPrices(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateVariantPrices(
      String((req.params as P).variantId),
      req.body.prices ?? {}
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function addPrice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ProductsService.addVariantPrice(
      String((req.params as P).variantId),
      req.body
    )
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export async function updatePriceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updatePrice(
      String((req.params as P).priceId),
      req.body
    )
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function deletePriceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deletePrice(String((req.params as P).priceId))
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function getProductStock(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ProductsService.getProductStock(String((req.params as P).variantId))
    res.json(result)
  } catch (err) { next(err) }
}

export async function updateProductStock(req: Request, res: Response, next: NextFunction) {
  try {
    const allocations = req.body as { warehouse_id: string; available: number }[]
    if (!Array.isArray(allocations)) {
      res.status(400).json({ error: 'Body must be an array of { warehouse_id, available }' })
      return
    }
    await ProductsService.updateProductStock(String((req.params as P).variantId), allocations)
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ============================================================
// PRODUCT-CENTRIC SUPPLIER MAPPINGS
// ============================================================

export async function getProductSupplierMappings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ProductsService.getProductSupplierMappings(String((req.params as P).variantId))
    res.json(data)
  } catch (err) { next(err) }
}

export async function addProductSupplierMapping(req: Request, res: Response, next: NextFunction) {
  try {
    const { supplier_id, supplier_sku, supplier_price, supplier_stock, lead_time_days } = req.body
    if (!supplier_id || !supplier_sku) {
      res.status(400).json({ error: 'supplier_id and supplier_sku are required' })
      return
    }
    const data = await ProductsService.addProductSupplierMapping(
      String((req.params as P).variantId),
      { supplier_id, supplier_sku, supplier_price, supplier_stock, lead_time_days }
    )
    res.status(201).json(data)
  } catch (err) { next(err) }
}

export async function removeProductSupplierMapping(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.removeProductSupplierMapping(String((req.params as P).mapId))
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function getFormMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const [brands, collections, categories, patterns] = await Promise.all([
      ProductsService.listBrands(),
      ProductsService.listCollections(),
      ProductsService.listCategories(),
      ProductsService.listPatternsForMeta(),
    ])
    // Allow CDN / browser to cache for 5 min; revalidate in background after that
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    res.json({ brands, collections, categories, patterns })
  } catch (err) { next(err) }
}

// ── Attributes ───────────────────────────────────────────────────────────────

export async function getAttributes(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await ProductsService.listAttributes()) } catch (err) { next(err) }
}

export async function postAttribute(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await ProductsService.createAttribute(req.body)) } catch (err) { next(err) }
}

export async function patchAttribute(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateAttribute(String((req.params as P).id), req.body)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function removeAttribute(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteAttribute(String((req.params as P).id))
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── Brands ───────────────────────────────────────────────────────────────────

export async function getBrands(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = req.query.page   ? Number(req.query.page)  : 1
    const limit  = req.query.limit  ? Number(req.query.limit) : 50
    const search = String(req.query.search ?? '')
    res.json(await ProductsService.listBrandsFull({ page, limit, search: search || undefined }))
  } catch (err) { next(err) }
}

export async function getBrandsAll(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await ProductsService.listBrandsAll()) } catch (err) { next(err) }
}

export async function postBrand(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await ProductsService.createBrand(req.body)) } catch (err) { next(err) }
}

export async function patchBrand(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateBrand(String((req.params as P).id), req.body)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function removeBrand(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteBrand(String((req.params as P).id))
    res.json({ success: true })
  } catch (err) { next(err) }
}


// ── Patterns ─────────────────────────────────────────────────────────────────

export async function getPatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const page    = req.query.page    ? Number(req.query.page)   : 1
    const limit   = req.query.limit   ? Number(req.query.limit)  : 50
    const search  = String(req.query.search  ?? '')
    const brandId = (req.params as P).brandId || String(req.query.brandId ?? '')
    const appType = String(req.query.appType ?? '')
    res.json(await ProductsService.listPatterns({
      page, limit,
      search:  search  || undefined,
      brandId: brandId || undefined,
      appType: appType || undefined,
    }))
  } catch (err) { next(err) }
}

export async function getPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ProductsService.getPattern(String((req.params as P).patternId))
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) { next(err) }
}

export async function postPattern(req: Request, res: Response, next: NextFunction) {
  try {
    const brandId = String((req.params as P).brandId)
    const { brand_name: _, ...rest } = req.body as Record<string, unknown>
    const payload = { ...rest, brand_id: brandId } as ProductsService.PatternPayload
    res.status(201).json(await ProductsService.createPattern(payload))
  } catch (err) { next(err) }
}

export async function patchPattern(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updatePattern(String((req.params as P).patternId), req.body)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function removePattern(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deletePattern(String((req.params as P).patternId))
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── Collections ──────────────────────────────────────────────────────────────

export async function getCollections(req: Request, res: Response, next: NextFunction) {
  try { res.json(await ProductsService.listCollections()) } catch (err) { next(err) }
}

export async function postCollection(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await ProductsService.createCollection(req.body)) } catch (err) { next(err) }
}

export async function patchCollection(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateCollection((req.params as P).id, req.body)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function removeCollection(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteCollection((req.params as P).id)
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try { res.json(await ProductsService.listCategories()) } catch (err) { next(err) }
}

export async function postCategory(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await ProductsService.createCategory(req.body)) } catch (err) { next(err) }
}

export async function patchCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.updateCategory((req.params as P).id, req.body)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function removeCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductsService.deleteCategory((req.params as P).id)
    res.json({ success: true })
  } catch (err) { next(err) }
}

export async function getProductCategories(req: Request, res: Response, next: NextFunction) {
  try { res.json(await ProductsService.getProductCategories((req.params as P).variantId)) } catch (err) { next(err) }
}

export async function putProductCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryIds } = req.body as { categoryIds: string[] }
    await ProductsService.setProductCategories((req.params as P).variantId, categoryIds ?? [])
    res.json({ success: true })
  } catch (err) { next(err) }
}


// ── Bulk catalog import ───────────────────────────────────────────────────────

function parseCsvFromBuffer(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf8')
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header:          true,
    skipEmptyLines:  true,
    transformHeader: (h: string) => h.trim(),
  })
  if (errors.length && data.length === 0) throw new Error(errors[0].message)
  return data
}

export async function importSkus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' })
    const rows      = parseCsvFromBuffer(req.file.buffer)
    const columnMap = JSON.parse(req.body.column_map ?? '{}') as Record<string, string>
    const jobId     = await enqueueCatalogImport('skus', rows, columnMap, randomUUID())
    res.status(202).json({ jobId })
  } catch (err) { next(err) }
}

export async function importBrands(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' })
    const rows      = parseCsvFromBuffer(req.file.buffer)
    const columnMap = JSON.parse(req.body.column_map ?? '{}') as Record<string, string>
    const jobId     = await enqueueCatalogImport('brands', rows, columnMap, randomUUID())
    res.status(202).json({ jobId })
  } catch (err) { next(err) }
}

export async function importCategories(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' })
    const rows      = parseCsvFromBuffer(req.file.buffer)
    const columnMap = JSON.parse(req.body.column_map ?? '{}') as Record<string, string>
    const jobId     = await enqueueCatalogImport('categories', rows, columnMap, randomUUID())
    res.status(202).json({ jobId })
  } catch (err) { next(err) }
}

export async function importPatterns(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' })
    const rows      = parseCsvFromBuffer(req.file.buffer)
    const columnMap = JSON.parse(req.body.column_map ?? '{}') as Record<string, string>
    const jobId     = await enqueueCatalogImport('patterns', rows, columnMap, randomUUID())
    res.status(202).json({ jobId })
  } catch (err) { next(err) }
}

export async function getImportJob(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getCatalogImportJob((req.params as Record<string, string>).jobId)
    res.json(status)
  } catch (err) { next(err) }
}
