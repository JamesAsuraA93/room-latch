// Server-only room rendering via OpenAI API, for local and deployed environments.
import type {Job, JobImage, PromptItem, Provider, RenderImage, StartResult, StyleEntry} from '@/lib/live-render-core'
import {cancelOpenaiJob, getOpenaiJob, openaiJobImage, startOpenaiJob} from '@/lib/live-render-openai'
import {MAX_PRODUCT_IMAGES} from '@/lib/product-render'
import type {PipelineProduct} from '@/lib/render-pipeline'

export const MAX_ROOM_REFERENCES = 3

export type StartArgs = {
  provider: Provider
  clientKey: string // hash of the caller's IP, stored with the job (see clientKey in lib/live-render-core.ts)
  room: RenderImage // the photo that gets edited
  roomReferences?: RenderImage[] // other angles of the same room
  floorPlan?: RenderImage
  roomAreaM2?: number
  products: PipelineProduct[] // in the same order as items
  styleReference?: RenderImage
  style: StyleEntry
  items: PromptItem[] // position the user chose (w = 0: none)
  roomType: string
  widthCm?: number // only a width actually supplied by the user
}

export async function startJob({provider, clientKey, room, roomReferences = [], products, styleReference, floorPlan, roomAreaM2, style, items, roomType, widthCm}: StartArgs): Promise<StartResult> {
  if (provider !== 'openai') return {ok: false, status: 400, code: 'live_render_disabled'}
  if (products.length > MAX_PRODUCT_IMAGES) return {ok: false, status: 400, code: 'too_many_products'}
  if (roomReferences.length > MAX_ROOM_REFERENCES) return {ok: false, status: 400, code: 'image_count_1_to_4'}
  const hinted = products.map((product, i) => {
    const at = items[i]
    return at && at.w > 0 ? {...product, hint: {x: at.x + at.w / 2, y: at.y}} : product
  })
  if (products.some(p => !p.upload && !p.listing?.imagePath && !p.listing?.imageUrl)) return {ok: false, status: 422, code: 'listing_photo_missing'}
  return startOpenaiJob({room, roomReferences, products: hinted, styleReference, floorPlan, roomAreaM2, style, roomType, widthCm}, clientKey)
}

export const getJob = async (provider: Provider, id: string): Promise<Job | null> =>
  provider === 'openai' ? getOpenaiJob(id) : null

export const jobImage = async (provider: Provider, id: string): Promise<JobImage | null> =>
  provider === 'openai' ? openaiJobImage(id) : null

export const cancelJob = async (provider: Provider, id: string): Promise<boolean> =>
  provider === 'openai' ? cancelOpenaiJob(id) : false
