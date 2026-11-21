// Multipart helpers for the Decisions endpoints: capped body, one image checked by magic bytes, returned as a data URL.
import {INPUT_MAX_BYTES, sniffImage} from '@/lib/live-render-core'

export const FORM_MAX_BYTES = INPUT_MAX_BYTES + 64 * 1024

export class FormRefusal { constructor(readonly status: number, readonly code: string) {} }
const refuse = (status: number, code: string): never => { throw new FormRefusal(status, code) }

/** Whole multipart body (refusing anything over FORM_MAX_BYTES, with or without Content-Length). */
export async function readCappedForm(req: Request): Promise<FormData> {
  const type = req.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;/i.test(type)) refuse(415, 'unsupported_media_type')
  if (Number(req.headers.get('content-length') ?? 0) > FORM_MAX_BYTES) refuse(413, 'body_too_large')
  if (!req.body) refuse(400, 'bad_form')
  const reader = req.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > FORM_MAX_BYTES) { await reader.cancel(); refuse(413, 'body_too_large') }
    chunks.push(value)
  }
  return new Response(Buffer.concat(chunks), {headers: {'Content-Type': type}}).formData().catch(() => refuse(400, 'bad_form'))
}

/** The one image in `field` as a data URL (JPEG/PNG/WebP by magic bytes, never by the claimed type). */
export async function imageDataUrl(form: FormData, field: string): Promise<string> {
  const entry = form.get(field)
  if (!(entry instanceof File)) return refuse(400, 'image_required')
  if (entry.size === 0 || entry.size > INPUT_MAX_BYTES) refuse(413, 'image_too_large')
  const bytes = Buffer.from(await entry.arrayBuffer())
  const kind = sniffImage(new Uint8Array(bytes.subarray(0, 16)))
  if (!kind) refuse(415, 'image_not_jpeg_png_webp')
  return `data:${kind!.mime};base64,${bytes.toString('base64')}`
}
