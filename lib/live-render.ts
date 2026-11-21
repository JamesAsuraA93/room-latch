// Server-only entry point for live render jobs (Node runtime). One job API, two providers:
//   codex  → lib/live-render-codex.ts   local development, this machine's Codex CLI
//   openai → lib/live-render-openai.ts  production, OpenAI Images API + Postgres + Object storage
import {buildPrompt, type Attachment, type Job, type JobImage, type PromptItem, type PromptProductFile, type Provider, type RenderImage, type StartResult, type StyleEntry} from '@/lib/live-render-core'
import {cancelCodexJob, codexJobImage, getCodexJob, startCodexJob} from '@/lib/live-render-codex'
import {cancelOpenaiJob, getOpenaiJob, openaiJobImage, startOpenaiJob} from '@/lib/live-render-openai'
import {MAX_PRODUCT_IMAGES} from '@/lib/product-render'

export const MAX_ROOM_REFERENCES = 3

export type ProductImage = RenderImage & {id: string; widthCm?: number}
export type StartArgs = {
  provider: Provider
  clientKey: string // rate-limit bucket of the caller (see clientKey in lib/live-render-core.ts)
  room: RenderImage // the photo that gets edited
  roomReferences?: RenderImage[] // other angles / floor plans of the same room
  products?: ProductImage[]
  styleReference?: RenderImage
  style: StyleEntry
  items: PromptItem[]
}

export async function startJob({provider, clientKey, room, roomReferences = [], products = [], styleReference, style, items}: StartArgs): Promise<StartResult> {
  if (products.length > MAX_PRODUCT_IMAGES) return {ok: false, status: 400, code: 'too_many_products'}
  if (roomReferences.length > MAX_ROOM_REFERENCES) return {ok: false, status: 400, code: 'image_count_1_to_4'}

  // Name every input in the order both providers attach them; the prompt refers to these names and positions.
  const attachments: Attachment[] = []
  const attach = (name: string, {image, kind}: RenderImage) => {
    const file = `${name}.${kind.ext}`
    attachments.push({name: file, image, kind})
    return file
  }
  const inputFile = attach('input', room)
  const referenceFiles = roomReferences.map((reference, i) => attach(`reference-${i + 1}`, reference))
  const productFiles: PromptProductFile[] = products.map((product, i) => {
    const file = attach(`product-${i + 1}`, product)
    return {id: product.id, file, imageIndex: attachments.length, widthCm: product.widthCm}
  })
  const styleFile = styleReference && attach('style-reference', styleReference)
  const prompt = buildPrompt(style, items, inputFile, referenceFiles, styleFile, productFiles, provider)

  return provider === 'codex' ? startCodexJob(attachments, prompt) : startOpenaiJob(attachments, prompt, clientKey)
}

export const getJob = async (provider: Provider, id: string): Promise<Job | null> =>
  provider === 'codex' ? getCodexJob(id) : getOpenaiJob(id)

export const jobImage = async (provider: Provider, id: string): Promise<JobImage | null> =>
  provider === 'codex' ? codexJobImage(id) : openaiJobImage(id)

export const cancelJob = async (provider: Provider, id: string): Promise<boolean> =>
  provider === 'codex' ? cancelCodexJob(id) : cancelOpenaiJob(id)
