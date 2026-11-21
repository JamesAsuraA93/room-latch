// 360 walkthrough of the user's own rendered room. LOCAL ONLY: runs pano360/roomscene.py (Python, ONNX depth,
// Real-ESRGAN) on this machine and writes a static scene into public/walk/scenes/u-<render job id>/.
// One scene per finished render job; the scene id is the job id, so asking twice returns the same scene.
// Status lives in that folder's status.json (written atomically by the Python side), so polls survive restarts.
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isSceneId = (id: string) => UUID.test(id)
export const sceneWebPrefix = (id: string) => `scenes/u-${id}`

const PANO_DIR = process.env.ROOMLATCH_PANO_DIR || path.resolve(/*turbopackIgnore: true*/ process.cwd(), '..', 'pano360')
const PYTHON = process.env.ROOMLATCH_PANO_PYTHON || 'python3'
const sceneDir = (id: string) => path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'walk', sceneWebPrefix(id))
// outpaint + 2 standpoints at high quality, depth, LDI and 4x upscale: minutes, not seconds
const TIMEOUT_MS = 20 * 60 * 1000

export type SceneStatus = {status: 'running' | 'succeeded' | 'failed'; step: string; error?: string | null; startedAt?: number; updatedAt?: number}
export type SceneProduct = {id: string; title: string; url: string; price_thb: number | null}

/** Off on Vercel (no Python there) and without an API key. */
export function scenesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !env.VERCEL && !env.VERCEL_ENV && !!env.OPENAI_API_KEY?.trim() && existsSync(path.join(/*turbopackIgnore: true*/ PANO_DIR, 'roomscene.py'))
}

export async function readScene(id: string): Promise<SceneStatus | null> {
  if (!isSceneId(id)) return null
  try {
    const s = JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ sceneDir(id), 'status.json'), 'utf8')) as SceneStatus
    // a running scene whose process is gone (server restart) would spin forever: report it failed instead
    if (s.status === 'running' && !running.has(id) && Date.now() - (s.updatedAt ?? 0) > STALL_MS) return {...s, status: 'failed', error: 'scene_lost'}
    return s
  } catch { return null }
}
// the slowest single step (two high-quality panorama edits in parallel) stays well under this
const STALL_MS = 15 * 60 * 1000

const running = new Set<string>()

export type StartScene = {id: string; render: Buffer; before: Buffer | null; products: SceneProduct[]}

/** Start building the scene unless it already exists or another one is being built (one at a time: CPU heavy). */
export async function startScene({id, render, before, products}: StartScene): Promise<{ok: true; scene: SceneStatus} | {ok: false; status: number; code: string}> {
  if (!isSceneId(id)) return {ok: false, status: 400, code: 'bad_id'}
  const existing = await readScene(id)
  if (existing && existing.status !== 'failed') return {ok: true, scene: existing}
  if (running.size) return {ok: false, status: 409, code: 'scene_in_progress'}
  running.add(id)
  try {
    const work = await mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), 'roomlatch-scene-'))
    await writeFile(path.join(/*turbopackIgnore: true*/ work, 'render.png'), render, {mode: 0o600})
    if (before) await writeFile(path.join(/*turbopackIgnore: true*/ work, 'before.img'), before, {mode: 0o600})
    await writeFile(path.join(/*turbopackIgnore: true*/ work, 'products.json'), JSON.stringify(products))
    const web = sceneDir(id)
    await rm(web, {recursive: true, force: true})
    await mkdir(web, {recursive: true})
    const initial: SceneStatus = {status: 'running', step: 'start', startedAt: Date.now(), updatedAt: Date.now()}
    await writeFile(path.join(/*turbopackIgnore: true*/ web, 'status.json'), JSON.stringify(initial))
    const args = ['roomscene.py', '--render', path.join(/*turbopackIgnore: true*/ work, 'render.png'),
      '--products', path.join(/*turbopackIgnore: true*/ work, 'products.json'),
      '--out', path.join('out', 'scenes', id), '--web-dir', web, '--web-prefix', sceneWebPrefix(id),
      ...(before ? ['--before', path.join(/*turbopackIgnore: true*/ work, 'before.img')] : [])]
    // no shell; the Python side reads the API key from the workspace .env itself
    const child = spawn(PYTHON, args, {cwd: PANO_DIR, env: {PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '', LANG: 'en_US.UTF-8'} as unknown as NodeJS.ProcessEnv, stdio: ['ignore', 'ignore', 'pipe']})
    let stderr = ''
    child.stderr.on('data', d => { stderr = (stderr + String(d)).slice(-4000) })
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS)
    const done = async (code: number | null) => {
      clearTimeout(timer)
      running.delete(id)
      await rm(work, {recursive: true, force: true}).catch(() => {})
      const s = await readScene(id)
      if (code !== 0 && s?.status !== 'failed') {
        console.error('roomscene failed', code, stderr.slice(-800))
        await writeFile(path.join(/*turbopackIgnore: true*/ web, 'status.json'), JSON.stringify({status: 'failed', step: 'error', error: code === null ? 'timeout' : `exit_${code}`, updatedAt: Date.now()})).catch(() => {})
      }
    }
    child.on('error', () => { void done(-1) })
    child.on('close', code => { void done(code) })
    return {ok: true, scene: initial}
  } catch (e) {
    running.delete(id)
    throw e
  }
}
