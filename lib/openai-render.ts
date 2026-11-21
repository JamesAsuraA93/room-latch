// Server-only OpenAI Images renderer for local and production environments.
// Enabled by OPENAI_API_KEY on the server (see liveProvider in lib/live-render-core.ts).
// Reference: POST https://api.openai.com/v1/images/edits (multipart: model, image, prompt; response data[0].b64_json)
// https://developers.openai.com/api/docs/guides/image-generation
// The key is read from env per call and is never logged or returned. No fallback to Codex.

export const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits'
export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_B64 = 40 * 1024 * 1024

/**
 * Model defaults when the env sets none. Chosen 2026-11-21 from GET /v1/models and side-by-side tests; OpenAI retires
 * image models within about a year, so check the deprecations page before relying on these.
 *   render  final room image: cheapest setting that kept room and products intact (~$0.04 with 3 products)
 *   cutout  once per product, cached: accuracy over cost
 *   vision    product size and placement (JSON)
 *   decision  which catalog products to recommend within the budget (JSON)
 */
export const MODEL_DEFAULTS = {
  render: {model: 'gpt-image-2.5-sunburst', quality: 'low'},
  cutout: {model: 'gpt-image-2.6-sunburst', quality: 'medium'},
  vision: {model: 'gpt-6.1-terra'},
  decision: {model: 'gpt-6.1-terra'},
} as const

// Vercel production prioritizes final image detail; local and preview retain cheaper defaults.
export const PRODUCTION_RENDER_DEFAULTS = {model: 'gpt-image-2.6-sunburst', quality: 'max'} as const

function supportsExtendedQuality(model: string) {
  return /^gpt-image-2\.[56]-(sunburst|flare)(?:-\d{4}-\d{2}-\d{2})?$/.test(model)
}

/** Public configuration only; never return the API key in diagnostics. */
export function imageSettings(env: Record<string, string | undefined>, purpose: 'render' | 'cutout' = 'render') {
  const defaults = purpose === 'render' && env.VERCEL_ENV === 'production' ? PRODUCTION_RENDER_DEFAULTS : MODEL_DEFAULTS[purpose]
  const model = (purpose === 'cutout' ? env.OPENAI_CUTOUT_MODEL : env.OPENAI_IMAGE_MODEL) || defaults.model
  const configuredQuality = purpose === 'cutout' ? env.OPENAI_CUTOUT_QUALITY : env.OPENAI_IMAGE_QUALITY
  return {
    model,
    // An older explicitly selected model cannot inherit production's max quality.
    quality: configuredQuality || (defaults.quality === 'max' && !supportsExtendedQuality(model) ? 'high' : defaults.quality),
  }
}

type OpenaiEditArgs = {
  image: Buffer
  mime: string
  references?: {image: Buffer; mime: string; name?: string}[]
  prompt: string
  signal?: AbortSignal
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  /** 'transparent' for product cutouts; PNG output keeps the alpha channel. */
  background?: 'transparent'
  /** Use the cutout model settings (OPENAI_CUTOUT_MODEL / OPENAI_CUTOUT_QUALITY) instead of the render ones. */
  purpose?: 'render' | 'cutout'
}

export class OpenaiRenderError extends Error {
  code: string
  status?: number
  constructor(code: string, status?: number) { super(code); this.code = code; this.status = status }
}

/** Build the multipart request. Exported for contract tests. */
export function buildEditRequest({image, mime, prompt, references = [], env = process.env, background, purpose = 'render'}: OpenaiEditArgs): {url: string; init: RequestInit} {
  const key = env.OPENAI_API_KEY
  const {model, quality} = imageSettings(env, purpose)
  if (!key) throw new OpenaiRenderError('missing_api_key')
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', 'auto')
  form.append('output_format', 'png')
  const allowedQualities = supportsExtendedQuality(model) ? ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] : ['low', 'medium', 'high', 'auto']
  if (!allowedQualities.includes(quality)) throw new OpenaiRenderError('invalid_quality')
  form.append('quality', quality)
  if (background) form.append('background', background)
  // Only gpt-image-1.5 takes input_fidelity (the API says to omit it for newer models); that model shuts down 2026-12-01.
  if (model === 'gpt-image-1.5') form.append('input_fidelity', 'high')
  if (references.length > 15) throw new OpenaiRenderError('too_many_images')
  form.append(references.length ? 'image[]' : 'image', new Blob([new Uint8Array(image)], {type: mime}), `room.${ext}`)
  references.forEach((r, i) => form.append('image[]', new Blob([new Uint8Array(r.image)], {type: r.mime}), r.name ?? `reference-${i}.${r.mime.split('/')[1]}`))
  return {url: OPENAI_EDITS_URL, init: {method: 'POST', headers: {Authorization: `Bearer ${key}`}, body: form}}
}

/** Returns the edited image bytes. Throws OpenaiRenderError without echoing secrets or response bodies. */
export async function openaiEdit(args: OpenaiEditArgs): Promise<Buffer> {
  const {url, init} = buildEditRequest(args)
  const res = await (args.fetchImpl ?? fetch)(url, {...init, signal: args.signal})
  if (!res.ok) throw new OpenaiRenderError('http_error', res.status)
  const json = await res.json().catch(() => null) as {data?: {b64_json?: string}[]} | null
  const b64 = json?.data?.[0]?.b64_json
  if (typeof b64 !== 'string' || b64.length === 0 || b64.length > MAX_B64) throw new OpenaiRenderError('bad_response')
  return Buffer.from(b64, 'base64')
}

type OpenaiJsonArgs = {
  prompt: string
  images: {image: Buffer; mime: string}[]
  signal?: AbortSignal
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  purpose?: 'vision' | 'decision'
}

/** Model call that must answer with one JSON object (OPENAI_VISION_MODEL or OPENAI_DECISION_MODEL). Returns the parsed object. */
export async function openaiJson({prompt, images, signal, env = process.env, fetchImpl = fetch, purpose = 'vision'}: OpenaiJsonArgs): Promise<unknown> {
  const key = env.OPENAI_API_KEY
  if (!key) throw new OpenaiRenderError('missing_api_key')
  const content = [
    {type: 'text', text: prompt},
    ...images.map(({image, mime}) => ({type: 'image_url', image_url: {url: `data:${mime};base64,${image.toString('base64')}`}})),
  ]
  const res = await fetchImpl(OPENAI_CHAT_URL, {
    method: 'POST', signal,
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: (purpose === 'decision' ? env.OPENAI_DECISION_MODEL : env.OPENAI_VISION_MODEL) || MODEL_DEFAULTS[purpose].model, response_format: {type: 'json_object'}, messages: [{role: 'user', content}]}),
  })
  if (!res.ok) throw new OpenaiRenderError('http_error', res.status)
  const json = await res.json().catch(() => null) as {choices?: {message?: {content?: string}}[]} | null
  try { return JSON.parse(json?.choices?.[0]?.message?.content ?? '') } catch { throw new OpenaiRenderError('bad_response') }
}
