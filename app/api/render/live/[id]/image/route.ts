import {readFile} from 'node:fs/promises'
import {gateRequest} from '@/lib/live-render-core'
import {jobImage} from '@/lib/live-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  const gate = gateRequest(process.env, req.headers, 'GET')
  if (!gate.ok) return new Response(null, {status: gate.status})
  const image = await jobImage(gate.provider, (await params).id)
  if (!image) return new Response(null, {status: 404})
  // Production: the image is in private Object storage, reached through a short-lived presigned URL.
  if ('url' in image) return new Response(null, {status: 302, headers: {Location: image.url, 'Cache-Control': 'private, max-age=300', 'Referrer-Policy': 'no-referrer'}})
  return new Response(new Uint8Array(await readFile(image.file)), {headers: {'Content-Type': image.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}})
}
