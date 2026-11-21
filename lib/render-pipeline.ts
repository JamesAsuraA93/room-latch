// Server-only accurate render pipeline (production, OpenAI). Runs anywhere Node runs, Vercel included:
// HTTP calls to OpenAI, Neon Object Storage through the S3 client, and sharp for pixels. No local tools.
//
//   0. clean    image model removes living beings from the room before placement
//   1. photo    the listing's photo from our bucket (listings/<shop>-<item>/original.*), else Shopee's CDN; or the user's upload
//   2. cutout   image model isolates the product on transparency           cached at listings/<shop>-<item>/cutout.png
//   3. size     vision model reads the real size in cm                      cached at listings/<shop>-<item>/spec.json
//   4. place    vision model decides where each product stands and how big it appears in the room photo
//   5. paste    sharp pastes every cutout at that spot and size
//   6. render   image model makes the pasted products sit naturally; position, size and look stay fixed
// Prompts, validation and size math live in lib/render-pipeline-core.ts (pure, tested).
import 'server-only'
import sharp from 'sharp'
import {sniffImage, type RenderImage, type StyleEntry} from '@/lib/live-render-core'
import {openaiEdit, openaiJson} from '@/lib/openai-render'
import {cutoutPrompt, fitCutout, isShopeeImageUrl, listingKeys, parsePlacements, parseSize, placedRenderPrompt, placementPrompt, roomCleanupPrompt, sizePrompt, withUserWidth, type ProductSize} from '@/lib/render-pipeline-core'
import {storage} from '@/lib/storage'

const PHOTO_MAX_BYTES = 8 * 1024 * 1024

/** A step failed in a way the user should hear about; `code` reaches the client as the job error. */
export class PipelineError extends Error {
  constructor(readonly code: string) { super(code) }
}

export type PipelineProduct = {
  id: string
  name: string // from our data, never from the client
  widthCm?: number // typed by the user: overrides the size the model reads
  hint?: {x: number; y: number} // where the user would like it, percent of the room photo
  upload?: RenderImage // the user's own photo of the product (never cached)
  listing?: {imagePath: string | null; imageUrl: string | null; dimensions: string | null} // a Shopee listing from our DB
}
export type PipelineInput = {
  room: RenderImage
  roomReferences: RenderImage[]
  floorPlan?: RenderImage
  roomAreaM2?: number
  products: PipelineProduct[]
  styleReference?: RenderImage
  style: StyleEntry
  roomType: string
  widthCm?: number // optional measured scale anchor; never infer it from a default
}

/** Step 1. Bytes are trusted only after sniffing; the CDN is fetched only for Shopee's own image host. */
export async function productPhoto(p: PipelineProduct, signal?: AbortSignal): Promise<RenderImage> {
  if (p.upload) return p.upload
  let bytes: Buffer | null = null
  if (p.listing?.imagePath) {
    const storageSignal = AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])])
    try { bytes = Buffer.from(await (await storage().download(p.listing.imagePath, storageSignal)).bytes()) } catch { signal?.throwIfAborted() }
    if (bytes && (bytes.length > PHOTO_MAX_BYTES || !sniffImage(new Uint8Array(bytes.subarray(0, 16))))) bytes = null
  }
  if (!bytes && p.listing?.imageUrl && isShopeeImageUrl(p.listing.imageUrl)) {
    const res = await fetch(p.listing.imageUrl, {signal, redirect: 'error'})
    if (res.ok && res.body) {
      const reader = res.body.getReader(), chunks: Uint8Array[] = []
      let total = 0
      try {
        while (true) {
          const {done, value} = await reader.read()
          if (done) break
          total += value.length
          if (total > PHOTO_MAX_BYTES) { await reader.cancel(); throw new PipelineError('listing_photo_missing') }
          chunks.push(value)
        }
        bytes = Buffer.concat(chunks)
      } finally { reader.releaseLock() }
    }
  }
  const kind = bytes && bytes.length <= PHOTO_MAX_BYTES ? sniffImage(new Uint8Array(bytes.subarray(0, 16))) : null
  if (!bytes || !kind) throw new PipelineError('listing_photo_missing')
  return {image: bytes, kind}
}

type Cutout = {png: Buffer; width: number; height: number}

/** A usable cutout has real transparency around an opaque product; trimmed to the product's own edges. */
async function checkedCutout(png: Buffer): Promise<Cutout> {
  const {channels} = await sharp(png).stats()
  const alpha = channels[3]
  if (!alpha || alpha.min > 10 || alpha.max < 240) throw new PipelineError('cutout_failed')
  const {data, info} = await sharp(png).trim({threshold: 10}).png().toBuffer({resolveWithObject: true})
  if (info.width < 32 || info.height < 32) throw new PipelineError('cutout_failed')
  return {png: data, width: info.width, height: info.height}
}

/** Step 2. Listings are cut out once and reused by every later job; user uploads are cut out per job. */
async function productCutout(p: PipelineProduct, photo: RenderImage, signal?: AbortSignal): Promise<Cutout> {
  const key = p.listing ? listingKeys(p.id)?.cutout : undefined
  if (key && await storage().exists(key)) return checkedCutout(Buffer.from(await (await storage().download(key)).bytes()))
  const raw = await openaiEdit({image: photo.image, mime: photo.kind.mime, prompt: cutoutPrompt(p.name), purpose: 'cutout', background: 'transparent', signal})
  const cutout = await checkedCutout(raw)
  if (key) await storage().upload(key, cutout.png, {contentType: 'image/png'})
  return cutout
}

/** A smaller JPEG copy for vision calls: same content, fewer input tokens. */
const visionCopy = async (image: Buffer) => ({image: await sharp(image).rotate().resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 85}).toBuffer(), mime: 'image/jpeg'})

/** Step 3. Size read once per listing; a width the user typed always wins. */
async function productSize(p: PipelineProduct, photo: RenderImage, signal?: AbortSignal): Promise<ProductSize> {
  const key = p.listing ? listingKeys(p.id)?.spec : undefined
  let size = key && await storage().exists(key) ? parseSize(JSON.parse(await (await storage().download(key)).text())) : null
  if (!size) {
    size = parseSize(await openaiJson({prompt: sizePrompt(p.name, p.listing?.dimensions ?? null), images: [await visionCopy(photo.image)], signal}))
    if (!size) throw new PipelineError('size_failed')
    if (key) await storage().upload(key, JSON.stringify({width_cm: size.widthCm, depth_cm: size.depthCm, height_cm: size.heightCm, basis: size.basis, confidence: size.confidence}), {contentType: 'application/json'})
  }
  return withUserWidth(size, p.widthCm)
}

/** Runs the whole pipeline and returns the final PNG. */
export async function renderPlaced(input: PipelineInput, signal?: AbortSignal): Promise<Buffer> {
  // Clean the room before placement; prepare product assets concurrently.
  const [cleaned, prepared] = await Promise.all([
    openaiEdit({image: input.room.image, mime: input.room.kind.mime, prompt: roomCleanupPrompt(), signal}),
    Promise.all(input.products.map(async p => {
      const photo = await productPhoto(p, signal)
      const [cutout, size] = await Promise.all([productCutout(p, photo, signal), productSize(p, photo, signal)])
      return {...p, cutout, size}
    })),
  ])

  // Step 4. One retry: the answer is validated strictly and a second sample is cheap next to a wrong-size render.
  const {data: room, info: {width: roomW, height: roomH}} = await sharp(cleaned).rotate().png().toBuffer({resolveWithObject: true})
  const prompt = placementPrompt({
    roomType: input.roomType, styleTh: input.style.th, widthCm: input.widthCm, extraViews: input.roomReferences.length, floorPlan: !!input.floorPlan, roomAreaM2: input.roomAreaM2,
    products: prepared.map(p => ({id: p.id, name: p.name, size: p.size, aspect: p.cutout.width / p.cutout.height, hint: p.hint})),
  })
  const views = await Promise.all([room, ...input.roomReferences.map(r => r.image), ...(input.floorPlan ? [input.floorPlan.image] : [])].map(visionCopy))
  let placements = null
  for (let attempt = 0; attempt < 2 && !placements; attempt++) placements = parsePlacements(await openaiJson({prompt, images: views, signal}), prepared.map(p => p.id))
  if (!placements) throw new PipelineError('placement_failed')

  // Step 5. Back to front, so nearer products cover further ones.
  const layers = await Promise.all(placements.map(async pl => {
    const {cutout} = prepared.find(p => p.id === pl.id)!
    const box = fitCutout(cutout.width, cutout.height, pl, roomW, roomH)
    return {floorY: pl.floorY, input: await sharp(cutout.png).resize(box.width, box.height).png().toBuffer(), left: box.left, top: box.top}
  }))
  const composite = await sharp(room).composite(layers.sort((a, b) => a.floorY - b.floorY)).png().toBuffer()

  // Step 6.
  return openaiEdit({
    image: composite, mime: 'image/png', signal,
    prompt: placedRenderPrompt({styleTh: input.style.th, stylePrompt: input.style.prompt, products: prepared, styleReference: !!input.styleReference}),
    references: [
      ...await Promise.all(prepared.map(async (p, i) => ({
        image: await sharp(p.cutout.png).resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true}).png().toBuffer(),
        mime: 'image/png', name: `product-${i + 1}.png`,
      }))),
      ...(input.styleReference ? [{image: input.styleReference.image, mime: input.styleReference.kind.mime, name: `style-reference.${input.styleReference.kind.ext}`}] : []),
    ],
  })
}
