// Server-only OpenAI Images edit provider (Phase 2). Off by default: used only when
// ROOMLATCH_RENDER_PROVIDER=openai, ROOMLATCH_OPENAI_RENDER=1 and OPENAI_API_KEY are set on the server.
// Reference: POST https://api.openai.com/v1/images/edits (multipart: model, image, prompt; response data[0].b64_json)
// https://developers.openai.com/api/docs/guides/image-generation
// The key is read from env per call and is never logged or returned. No fallback to Codex.

export const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits'
const MAX_B64 = 40 * 1024 * 1024

export type OpenaiEditArgs = {
  image: Buffer
  mime: string
  prompt: string
  signal?: AbortSignal
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}

export class OpenaiRenderError extends Error {
  code: string
  status?: number
  constructor(code: string, status?: number) { super(code); this.code = code; this.status = status }
}

/** Build the multipart request. Exported for contract tests. */
export function buildEditRequest({image, mime, prompt, env = process.env}: OpenaiEditArgs): {url: string; init: RequestInit} {
  const key = env.OPENAI_API_KEY
  const model = env.OPENAI_IMAGE_MODEL
  if (!key) throw new OpenaiRenderError('missing_api_key')
  if (!model) throw new OpenaiRenderError('missing_model')
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('image', new Blob([new Uint8Array(image)], {type: mime}), `room.${ext}`)
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
