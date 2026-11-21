// PRODUCTION provider: OpenAI. Nothing is kept on this instance: job status goes to Postgres (lib/render-jobs.ts)
// and the image to Object storage, so any instance can answer a poll. The work itself is lib/render-pipeline.ts.
import {randomUUID} from 'node:crypto'
import {waitUntil} from '@vercel/functions'
import {OUTPUT_MAX_BYTES, pngSize, type Job, type JobImage, type StartResult} from '@/lib/live-render-core'
import {OpenaiRenderError} from '@/lib/openai-render'
import {purgeExpiredJobs, readJob, renderLimits, renderPath, reserveJob, settleJob, type Outcome} from '@/lib/render-jobs'
import {PipelineError, renderPlaced, type PipelineInput} from '@/lib/render-pipeline'
import {storage} from '@/lib/storage'

// The whole pipeline (cutouts, sizes, placement, render) stays under the route's maxDuration (300 s),
// so a slow job fails cleanly instead of being killed.
const TIMEOUT_MS = 280 * 1000
const DOWNLOAD_NAME = 'roomlatch-room.png'

// Requests in flight on this instance, so a cancel that lands here can stop the OpenAI calls.
const aborts = new Map<string, AbortController>()

function errorCode(e: unknown): string {
  if ((e as Error).name === 'AbortError') return 'cancelled'
  if (e instanceof PipelineError) return e.code
  if (!(e instanceof OpenaiRenderError)) return 'openai_failed'
  if (e.status === 401) return 'openai_auth'
  if (e.status === 403) return 'openai_access'
  if (e.status === 429) return 'openai_quota'
  return e.code === 'bad_response' ? 'openai_bad_response' : 'openai_failed'
}

async function render(id: string, input: PipelineInput): Promise<Outcome> {
  const abort = new AbortController()
  aborts.set(id, abort)
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; abort.abort() }, TIMEOUT_MS)
  let png: Buffer
  try {
    png = await renderPlaced(input, abort.signal)
  } catch (e) {
    if (!(e instanceof PipelineError || e instanceof OpenaiRenderError) && (e as Error).name !== 'AbortError') console.error('render pipeline failed', (e as Error).message)
    return {status: 'failed', error: timedOut ? 'timeout' : errorCode(e)}
  } finally {
    clearTimeout(timer)
    aborts.delete(id)
  }
  const size = pngSize(png.subarray(0, 24))
  if (!size || size.width < 256 || size.height < 256 || png.length > OUTPUT_MAX_BYTES) return {status: 'failed', error: 'output_not_decodable'}
  const path = renderPath(id)
  try { await storage().upload(path, png, {contentType: 'image/png'}) } catch { return {status: 'failed', error: 'storage_failed'} }
  return {status: 'succeeded', output: {path, ...size, bytes: png.length}}
}

async function run(id: string, input: PipelineInput) {
  const outcome = await render(id, input)
  const settled = await settleJob(id, outcome)
  // Cancelled while it ran: that outcome stands, and the image must not stay behind.
  if (!settled && outcome.status === 'succeeded') await storage().delete(outcome.output.path)
}

/** Remove jobs past retention together with their images. */
async function purge() {
  for (const path of await purgeExpiredJobs()) await storage().delete(path)
}

const logged = (what: string) => (e: unknown) => console.error(what, (e as Error).message)

export async function startOpenaiJob(input: PipelineInput, clientKey: string): Promise<StartResult> {
  const id = randomUUID()
  let refused
  try { refused = await reserveJob(id, clientKey, renderLimits(process.env)) } catch (e) {
    logged('render job store unavailable')(e)
    return {ok: false, status: 503, code: 'job_store_unavailable'}
  }
  if (refused) return {ok: false, status: refused === 'job_in_progress' ? 409 : 429, code: refused}
  // waitUntil keeps a serverless instance alive until the job settles; locally the promise simply runs on.
  waitUntil(run(id, input).catch(logged('render job did not settle')))
  waitUntil(purge().catch(logged('render job purge failed')))
  return {ok: true, job: {id, provider: 'openai', status: 'running', startedAt: Date.now()}}
}

export async function getOpenaiJob(id: string): Promise<Job | null> {
  const job = await readJob(id)
  if (!job) return null
  const {output, ...rest} = job
  return {...rest, provider: 'openai', output: output && {mime: 'image/png', width: output.width, height: output.height, bytes: output.bytes}}
}

export async function openaiJobImage(id: string): Promise<JobImage | null> {
  const job = await readJob(id)
  if (job?.status !== 'succeeded' || !job.output) return null
  // the key comes from our own row, never from the request
  return {url: await storage().url(job.output.path, {expiresIn: 600, downloadName: DOWNLOAD_NAME})}
}

export async function cancelOpenaiJob(id: string) {
  const cancelled = await settleJob(id, {status: 'cancelled', error: 'cancelled'})
  // Only stops the OpenAI calls when this instance runs them; elsewhere the result is discarded when it lands.
  aborts.get(id)?.abort()
  return cancelled
}
