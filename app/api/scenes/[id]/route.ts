// GET /api/scenes/[id] — progress of a 360 walkthrough build (see lib/scene-jobs.ts).
import {readScene, sceneWebPrefix} from '@/lib/scene-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {'Cache-Control': 'no-store'}

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const id = (await params).id
  const scene = await readScene(id)
  if (!scene) return Response.json({error: {code: 'not_found'}}, {status: 404, headers})
  return Response.json({id, scene, path: sceneWebPrefix(id)}, {headers})
}
