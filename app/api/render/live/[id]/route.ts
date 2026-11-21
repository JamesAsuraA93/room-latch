import {gateRequest} from '@/lib/live-render-core'
import {cancelJob, getJob} from '@/lib/live-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {'Cache-Control': 'no-store'}
type Context = {params: Promise<{id: string}>}

export async function GET(req: Request, {params}: Context) {
  const gate = gateRequest(process.env, req.headers, 'GET')
  if (!gate.ok) return Response.json({error: {code: gate.code}}, {status: gate.status, headers})
  const job = await getJob(gate.provider, (await params).id)
  if (!job) return Response.json({error: {code: 'not_found'}}, {status: 404, headers})
  return Response.json({job, live: true}, {headers})
}

export async function DELETE(req: Request, {params}: Context) {
  const gate = gateRequest(process.env, req.headers, 'DELETE')
  if (!gate.ok) return Response.json({error: {code: gate.code}}, {status: gate.status, headers})
  return Response.json({cancelled: await cancelJob(gate.provider, (await params).id)}, {headers})
}
