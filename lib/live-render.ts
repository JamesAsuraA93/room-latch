// Server-only live render jobs (Node runtime). One job at a time, isolated temp dir, bounded time.
import {execFile, spawn, type ChildProcess} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {existsSync} from 'node:fs'
import {lstat, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {OUTPUT_MAX_BYTES, OUTPUT_NAME, buildPrompt, childEnv, sniffImage, type ImageKind, type PromptItem, type Provider, type StyleEntry} from '@/lib/live-render-core'
import {openaiEdit} from '@/lib/openai-render'

// Fixed executable. Never taken from the request. Override only via server env on this Mac.
const CODEX_BIN = process.env.ROOMLATCH_CODEX_BIN || '/opt/homebrew/bin/codex'
const SIPS = '/usr/bin/sips'
const TIMEOUT_MS = 8 * 60 * 1000

export type JobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type Job = {
  id: string
  provider: Provider
  status: JobStatus
  startedAt: number
  finishedAt?: number
  error?: string
  output?: {file: string; mime: string; width: number; height: number; bytes: number}
}
type Internal = Job & {dir: string; child?: ChildProcess; abort?: AbortController; timer?: NodeJS.Timeout; inputFiles?: string[]}

// shortcut: in-memory job table for a single local Next process; jobs vanish on restart. Needs a real store before multi-instance use.
const g = globalThis as unknown as {__rlJobs?: Map<string, Internal>}
const jobs = (g.__rlJobs ??= new Map<string, Internal>())

export const publicJob = (j: Internal): Job => ({id: j.id, provider: j.provider, status: j.status, startedAt: j.startedAt, finishedAt: j.finishedAt, error: j.error,
  output: j.output && {...j.output, file: ''}})
export const getJob = (id: string) => jobs.get(id)
const running = () => [...jobs.values()].find(j => j.status === 'running')

/** Decode check with macOS sips (fixed path, argument array, no shell). */
function decodeSize(file: string): Promise<{width: number; height: number} | null> {
  return new Promise(resolve => {
    execFile(SIPS, ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {timeout: 20_000, env: {PATH: '/usr/bin:/bin'} as unknown as NodeJS.ProcessEnv}, (err, out) => {
      if (err) return resolve(null)
      const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]), h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1])
      resolve(w > 0 && h > 0 ? {width: w, height: h} : null)
    })
  })
}

/** Success bar: the fixed output name exists in the job dir, is a regular file (no symlink), sniffs as an image and decodes. */
async function verifyOutput(dir: string): Promise<Job['output'] | string> {
  const file = path.join(dir, OUTPUT_NAME)
  let st
  try { st = await lstat(file) } catch { return 'no_output' }
  if (!st.isFile() || st.isSymbolicLink()) return 'bad_output'
  if (st.size === 0 || st.size > OUTPUT_MAX_BYTES) return 'bad_output_size'
  const kind = sniffImage(new Uint8Array((await readFile(file)).subarray(0, 16)))
  if (!kind) return 'output_not_image'
  const size = await decodeSize(file)
  if (!size || size.width < 256 || size.height < 256) return 'output_not_decodable'
  return {file, mime: kind.mime, width: size.width, height: size.height, bytes: st.size}
}

async function finish(job: Internal, inputFile: string) {
  clearTimeout(job.timer)
  await Promise.all((job.inputFiles ?? [inputFile]).map(file => rm(file, {force: true}))) // the room photo never outlives the run
  if (job.status !== 'running') return
  const out = await verifyOutput(job.dir)
  if (typeof out === 'string') { job.status = 'failed'; job.error = out } else { job.status = 'succeeded'; job.output = out }
  job.finishedAt = Date.now()
}

function runCodex(job: Internal, inputFile: string, prompt: string) {
  if (!path.isAbsolute(CODEX_BIN) || !existsSync(CODEX_BIN)) { job.status = 'failed'; job.error = 'codex_not_installed'; job.finishedAt = Date.now(); void finish(job, inputFile); return }
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'workspace-write',
    '-C', job.dir, '-o', path.join(job.dir, 'last-message.txt'), '-', ...(job.inputFiles ?? [inputFile]).flatMap(file => ['--image', file])]
  // No shell; cwd = isolated job dir; sandbox lets the agent write only there; env has no API keys.
  const child = spawn(CODEX_BIN, args, {cwd: job.dir, env: childEnv(process.env, job.dir) as unknown as NodeJS.ProcessEnv, stdio: ['pipe', 'ignore', 'ignore']})
  job.child = child
  child.stdin.end(prompt)
  child.on('error', () => { job.status = 'failed'; job.error = 'codex_spawn_failed'; job.finishedAt = Date.now(); void finish(job, inputFile) })
  child.on('exit', code => {
    if (job.status === 'running' && code !== 0) { job.status = 'failed'; job.error = `codex_exit_${code}`; job.finishedAt = Date.now() }
    void finish(job, inputFile)
  })
}

async function runOpenai(job: Internal, input: Buffer, kind: ImageKind, prompt: string, references: {image: Buffer; kind: ImageKind}[] = []) {
  const abort = new AbortController()
  job.abort = abort
  try {
    const png = await openaiEdit({image: input, mime: kind.mime, prompt, references: references.map(r => ({image: r.image, mime: r.kind.mime})), signal: abort.signal})
    await writeFile(path.join(job.dir, OUTPUT_NAME), png, {mode: 0o600})
  } catch (e) {
    if (job.status === 'running') { job.status = 'failed'; job.error = (e as Error).name === 'AbortError' ? 'cancelled' : 'openai_failed' ; job.finishedAt = Date.now() }
  }
  await finish(job, path.join(job.dir, `input.${kind.ext}`))
}

export type StartResult = {ok: true; job: Job} | {ok: false; status: number; code: string}

export async function startJob(provider: Provider, image: Buffer, kind: ImageKind, style: StyleEntry, items: PromptItem[], references: {image: Buffer; kind: ImageKind}[] = []): Promise<StartResult> {
  if (references.length > 3) return {ok: false, status: 400, code: 'image_count_1_to_4'}
  if (running()) return {ok: false, status: 409, code: 'job_in_progress'}
  // keep only the newest finished job on disk
  for (const [id, j] of jobs) { await rm(j.dir, {recursive: true, force: true}); jobs.delete(id) }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'roomlatch-render-'))
  const inputFile = path.join(dir, `input.${kind.ext}`)
  await writeFile(inputFile, image, {mode: 0o600})
  const inputFiles = [inputFile]
  for (const [i, reference] of references.entries()) {
    const file = path.join(dir, `reference-${i + 1}.${reference.kind.ext}`)
    await writeFile(file, reference.image, {mode: 0o600})
    inputFiles.push(file)
  }
  const job: Internal = {id: randomUUID(), provider, status: 'running', startedAt: Date.now(), dir, inputFiles}
  jobs.set(job.id, job)
  job.timer = setTimeout(() => cancelJob(job.id, 'timeout'), TIMEOUT_MS)
  const prompt = buildPrompt(style, items, path.basename(inputFile), inputFiles.slice(1).map(file => path.basename(file)))
  if (provider === 'codex') runCodex(job, inputFile, prompt)
  else void runOpenai(job, image, kind, prompt, references)
  return {ok: true, job: publicJob(job)}
}

export function cancelJob(id: string, reason = 'cancelled') {
  const job = jobs.get(id)
  if (!job || job.status !== 'running') return false
  job.status = reason === 'timeout' ? 'failed' : 'cancelled'
  job.error = reason
  job.finishedAt = Date.now()
  clearTimeout(job.timer)
  job.child?.kill('SIGTERM')
  setTimeout(() => { if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL') }, 5000).unref()
  job.abort?.abort()
  return true
}
