// LOCAL provider: this machine's signed-in Codex CLI. One job at a time, isolated temp dir, bounded time.
// Jobs live in this process's memory, which is enough for a single local server and never runs on Vercel.
import {execFile, spawn, type ChildProcess} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {existsSync} from 'node:fs'
import {lstat, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {OUTPUT_MAX_BYTES, OUTPUT_NAME, childEnv, pngSize, sniffImage, type Attachment, type Job, type JobImage, type StartResult} from '@/lib/live-render-core'
import {codexFailureReason} from '@/lib/render-outcome'

// Fixed executable. Never taken from the request. Override only via server env on this Mac.
// turbopackIgnore below: these paths are outside the project, so the build must not trace the whole repo into the function.
const CODEX_BIN = process.env.ROOMLATCH_CODEX_BIN || '/opt/homebrew/bin/codex'
const SIPS = '/usr/bin/sips'
const TIMEOUT_MS = 8 * 60 * 1000

type CodexJob = Job & {dir: string; inputFiles: string[]; outputFile?: string; child?: ChildProcess; timer?: NodeJS.Timeout; finishing?: boolean}

const g = globalThis as unknown as {__rlJobs?: Map<string, CodexJob>}
const jobs = (g.__rlJobs ??= new Map<string, CodexJob>())

const publicJob = ({id, provider, status, startedAt, finishedAt, error, output}: CodexJob): Job => ({id, provider, status, startedAt, finishedAt, error, output})
const running = () => [...jobs.values()].some(j => j.status === 'running')

/** Mark a running job failed. A job that already ended (cancelled, timed out) keeps its first outcome. */
function fail(job: CodexJob, error: string) {
  if (job.status !== 'running') return
  job.status = 'failed'
  job.error = error
  job.finishedAt = Date.now()
}

/** Image size via macOS sips (fixed path, argument array, no shell). */
function sipsSize(file: string): Promise<{width: number; height: number} | null> {
  return new Promise(resolve => {
    execFile(SIPS, ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {timeout: 20_000, env: {PATH: '/usr/bin:/bin'} as unknown as NodeJS.ProcessEnv}, (err, out) => {
      if (err) return resolve(null)
      const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]), h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1])
      resolve(w > 0 && h > 0 ? {width: w, height: h} : null)
    })
  })
}

/** Success bar: the fixed output name exists in the job dir, is a regular file (no symlink), sniffs as an image and has a readable size. */
async function verifyOutput(dir: string): Promise<{file: string; output: NonNullable<Job['output']>} | string> {
  const file = path.join(/*turbopackIgnore: true*/ dir, OUTPUT_NAME)
  let st
  try { st = await lstat(file) } catch { return 'no_output' }
  if (!st.isFile() || st.isSymbolicLink()) return 'bad_output'
  if (st.size === 0 || st.size > OUTPUT_MAX_BYTES) return 'bad_output_size'
  const head = new Uint8Array((await readFile(file)).subarray(0, 24))
  const kind = sniffImage(head)
  if (!kind) return 'output_not_image'
  // Codex may save JPEG/WebP under the PNG name: those need sips to measure.
  const size = pngSize(head) ?? await sipsSize(file)
  if (!size || size.width < 256 || size.height < 256) return 'output_not_decodable'
  return {file, output: {mime: kind.mime, width: size.width, height: size.height, bytes: st.size}}
}

async function finish(job: CodexJob, exitCode?: number | null, diagnostics = '') {
  if (job.finishing) return
  job.finishing = true
  clearTimeout(job.timer)
  await Promise.all(job.inputFiles.map(file => rm(file, {force: true}).catch(() => {}))) // cleanup must not hide a valid result
  if (job.status !== 'running') return
  const verified = await verifyOutput(job.dir).catch(() => 'output_not_decodable')
  if (job.status !== 'running') return
  if (typeof verified === 'string') {
    const message = await readFile(path.join(/*turbopackIgnore: true*/ job.dir, 'last-message.txt'), 'utf8').catch(() => '')
    const fallback = exitCode ? `codex_exit_${exitCode}` : verified
    return fail(job, codexFailureReason(`${message.slice(-16000)}\n${diagnostics}`, fallback))
  }
  job.status = 'succeeded'
  job.outputFile = verified.file
  job.output = verified.output
  job.finishedAt = Date.now()
}

function run(job: CodexJob, prompt: string) {
  if (!path.isAbsolute(CODEX_BIN) || !existsSync(/*turbopackIgnore: true*/ CODEX_BIN)) { fail(job, 'codex_not_installed'); void finish(job); return }
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'workspace-write',
    '-C', job.dir, '-o', path.join(/*turbopackIgnore: true*/ job.dir, 'last-message.txt'), '-', ...job.inputFiles.flatMap(file => ['--image', file])]
  // No shell; cwd = isolated job dir; sandbox lets the agent write only there; env has no API keys.
  const child = spawn(/*turbopackIgnore: true*/ CODEX_BIN, args, {cwd: job.dir, env: childEnv(process.env, job.dir) as unknown as NodeJS.ProcessEnv, stdio: ['pipe', 'ignore', 'pipe']})
  let diagnostics = ''
  child.stderr.on('data', data => { diagnostics = (diagnostics + String(data)).slice(-8000) })
  job.child = child
  child.stdin.on('error', () => { fail(job, 'codex_spawn_failed'); void finish(job) })
  child.stdin.end(prompt)
  child.on('error', () => { fail(job, 'codex_spawn_failed'); void finish(job) })
  child.on('close', code => {
    void finish(job, code, diagnostics)
  })
}

let starting = false
export async function startCodexJob(attachments: Attachment[], prompt: string): Promise<StartResult> {
  if (starting || running()) return {ok: false, status: 409, code: 'job_in_progress'}
  starting = true
  try {
    // keep only the newest finished job on disk
    for (const [id, old] of jobs) { await rm(old.dir, {recursive: true, force: true}); jobs.delete(id) }
    const dir = await mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), 'roomlatch-render-'))
    const inputFiles: string[] = []
    for (const {name, image} of attachments) {
      const file = path.join(/*turbopackIgnore: true*/ dir, name)
      await writeFile(file, image, {mode: 0o600})
      inputFiles.push(file)
    }
    const job: CodexJob = {id: randomUUID(), provider: 'codex', status: 'running', startedAt: Date.now(), dir, inputFiles}
    jobs.set(job.id, job)
    job.timer = setTimeout(() => cancelCodexJob(job.id, 'timeout'), TIMEOUT_MS)
    run(job, prompt)
    return {ok: true, job: publicJob(job)}
  } finally { starting = false }
}

export function getCodexJob(id: string): Job | null {
  const job = jobs.get(id)
  return job ? publicJob(job) : null
}

export function codexJobImage(id: string): JobImage | null {
  const job = jobs.get(id)
  // the path is our own fixed output name inside the job dir, never from the request or the model
  return job?.status === 'succeeded' && job.outputFile && job.output ? {file: job.outputFile, mime: job.output.mime} : null
}

export function cancelCodexJob(id: string, reason = 'cancelled') {
  const job = jobs.get(id)
  if (!job || job.status !== 'running') return false
  job.status = reason === 'timeout' ? 'failed' : 'cancelled'
  job.error = reason
  job.finishedAt = Date.now()
  clearTimeout(job.timer)
  job.child?.kill('SIGTERM')
  setTimeout(() => { if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL') }, 5000).unref()
  return true
}
