import {readFile} from 'node:fs/promises'
import {gateRequest} from '@/lib/live-render-core'
import {getJob} from '@/lib/live-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  const gate = gateRequest(process.env, req.headers, 'GET')
  if (!gate.ok) return new Response(null, {status: gate.status})
  const job = getJob((await params).id)
  if (!job || job.status !== 'succeeded' || !job.output) return new Response(null, {status: 404})
  // file path comes from our own fixed output name inside the job dir, never from the request or the model
  return new Response(new Uint8Array(await readFile(job.output.file)), {headers: {'Content-Type': job.output.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}})
}
