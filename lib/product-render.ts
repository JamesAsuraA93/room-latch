// Pure validation shared by the multipart endpoint's tests.
// source 'upload' = the client sends a photo (paired by order among uploads); 'listing' = a Shopee listing whose photo we
// already hold, so nothing is uploaded.
export const MAX_PRODUCT_IMAGES = 6
export const MAX_RENDER_BODY_BYTES = 32 * 1024 * 1024
export type ProductReferenceMeta = {id: string; name: string; widthCm?: number; source: 'upload' | 'listing'}
export function validateProductMeta(value: unknown, itemIds: string[], known: Map<string, string>): ProductReferenceMeta[] | null {
  if (!Array.isArray(value) || !value.length || value.length > MAX_PRODUCT_IMAGES || new Set(itemIds).size !== itemIds.length || value.length !== itemIds.length) return null
  const result: ProductReferenceMeta[] = []
  for (const [i, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !['id','name','widthCm','source'].includes(k))) return null
    const {id, name, widthCm, source = 'upload'} = raw
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || id !== itemIds[i]) return null
    if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[\x00-\x1f]/.test(name)) return null
    if (!known.has(id) && !id.startsWith('custom-')) return null
    if (widthCm !== undefined && (typeof widthCm !== 'number' || !Number.isFinite(widthCm) || widthCm <= 0 || widthCm > 1000)) return null
    if (source !== 'upload' && !(source === 'listing' && id.startsWith('shopee-'))) return null
    result.push({id, name: known.get(id) ?? name.trim(), ...(widthCm === undefined ? {} : {widthCm}), source})
  }
  return result
}
