// Server-only entry point for live render jobs (Node runtime). One job API, two providers:
//   codex  → lib/live-render-codex.ts   local development, this machine's Codex CLI, prompt-only placement
//   openai → lib/live-render-openai.ts  production: cutout, true-size placement and render (lib/render-pipeline.ts)
import {buildPrompt, type Attachment, type Job, type JobImage, type PromptItem, type PromptProductFile, type Provider, type RenderImage, type StartResult, type StyleEntry} from '@/lib/live-render-core'
import {cancelCodexJob, codexJobImage, getCodexJob, startCodexJob} from '@/lib/live-render-codex'
import {cancelOpenaiJob, getOpenaiJob, openaiJobImage, startOpenaiJob} from '@/lib/live-render-openai'
import {MAX_PRODUCT_IMAGES} from '@/lib/product-render'
import {PipelineError, productPhoto, type PipelineProduct} from '@/lib/render-pipeline'

export const MAX_ROOM_REFERENCES = 3

export type StartArgs = {
  provider: Provider
  clientKey: string // rate-limit bucket of the caller (see clientKey in lib/live-render-core.ts)
  room: RenderImage // the photo that gets edited
  roomReferences?: RenderImage[] // other angles / floor plans of the same room
  products: PipelineProduct[] // in the same order as items
  styleReference?: RenderImage
  style: StyleEntry
  items: PromptItem[] // position the user chose (w = 0: none)
  roomType: string
  widthCm: number // width the user measured: the scale anchor
}

export async function startJob({provider, clientKey, room, roomReferences = [], products, styleReference, style, items, roomType, widthCm}: StartArgs): Promise<StartResult> {
  if (products.length > MAX_PRODUCT_IMAGES) return {ok: false, status: 400, code: 'too_many_products'}
  if (roomReferences.length > MAX_ROOM_REFERENCES) return {ok: false, status: 400, code: 'image_count_1_to_4'}

  if (provider === 'openai') {
    const hinted = products.map((p, i) => {
      const at = items[i]
      return at && at.w > 0 ? {...p, hint: {x: at.x + at.w / 2, y: at.y}} : p
    })
    return startOpenaiJob({room, roomReferences, products: hinted, styleReference, style, roomType, widthCm}, clientKey)
  }

  // Codex: name every input in the order it is attached; the prompt refers to these names and positions.
  let photos: RenderImage[]
  try { photos = await Promise.all(products.map(p => productPhoto(p))) } catch (e) {
    return {ok: false, status: 422, code: e instanceof PipelineError ? e.code : 'listing_photo_missing'}
  }
  const attachments: Attachment[] = []
  const attach = (name: string, {image, kind}: RenderImage) => {
    const file = `${name}.${kind.ext}`
    attachments.push({name: file, image, kind})
    return file
  }
  const inputFile = attach('input', room)
  const referenceFiles = roomReferences.map((reference, i) => attach(`reference-${i + 1}`, reference))
  const productFiles: PromptProductFile[] = products.map((product, i) => {
    const file = attach(`product-${i + 1}`, photos[i])
    return {id: product.id, file, imageIndex: attachments.length, widthCm: product.widthCm}
  })
  const styleFile = styleReference && attach('style-reference', styleReference)
  return startCodexJob(attachments, buildPrompt(style, items, inputFile, referenceFiles, styleFile, productFiles, provider))
}

export const getJob = async (provider: Provider, id: string): Promise<Job | null> =>
  provider === 'codex' ? getCodexJob(id) : getOpenaiJob(id)

export const jobImage = async (provider: Provider, id: string): Promise<JobImage | null> =>
  provider === 'codex' ? codexJobImage(id) : openaiJobImage(id)

export const cancelJob = async (provider: Provider, id: string): Promise<boolean> =>
  provider === 'codex' ? cancelCodexJob(id) : cancelOpenaiJob(id)
