// Postgres store for render jobs run by the OpenAI provider (table render_jobs, db/schema.sql).
// On a serverless host every request may land on a different instance, so job status cannot live in memory.
// Database only: the caller owns the image in Object storage.
// Relative imports with extensions so `node scripts/render-jobs.test.mts` can load this file directly.
import type {Pool} from 'pg'
import {db} from './db.ts'

type Sql = Pick<Pool, 'query'>
type Env = Record<string, string | undefined>

/** A running row older than this lost its instance (the OpenAI call itself is capped well below it). */
export const STALE_AFTER_SECONDS = 6 * 60
/** The instance running a job refreshes heartbeat_at this often (live-render-openai.ts). */
export const HEARTBEAT_SECONDS = 10
/** A running row that has not beaten for this long lost its server (crash, restart, deploy): it reads as failed. */
export const LOST_AFTER_SECONDS = 45
// Either rule marks a running row dead: no recent heartbeat, or older than any job can run.
const DEAD = `(heartbeat_at < now() - make_interval(secs => ${LOST_AFTER_SECONDS}) or started_at < now() - make_interval(secs => ${STALE_AFTER_SECONDS}))`
const RETENTION = `interval '24 hours'`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const renderPath = (id: string) => `renders/${id}.png`

export type Limits = {perClient: number; total: number}
const count = (value: string | undefined, fallback: number) => value && /^\d+$/.test(value) ? Number(value) : fallback
/**
 * Record a new running job.
 * shortcut: no per-caller lock or daily limit (callers behind one IP blocked each other), so the OpenAI account's
 * own budget is the only spending ceiling; bring back a count over client_key here before opening this to the public.
 */
export async function reserveJob(id: string, clientKey: string, sql: Sql = db()): Promise<void> {
  await sql.query(`insert into render_jobs (id, client_key) values ($1, $2)`, [id, clientKey])
}

/** Recommend calls allowed per 24 hours (each is up to 2 decision-model calls, ~$0.01). */
export function recommendLimits(env: Env): Limits {
  return {perClient: count(env.ROOMLATCH_RECOMMEND_DAILY_LIMIT, 20), total: count(env.ROOMLATCH_RECOMMEND_DAILY_CAP, 500)}
}

/** Count one recommend model call unless the caller or the deployment is over its daily limit; false = over. */
export async function reserveModelCall(clientKey: string, limits: Limits, sql: Sql = db()): Promise<boolean> {
  await sql.query(`delete from recommend_calls where at < now() - ${RETENTION}`)
  // one statement: the count and the insert see the same snapshot (parallel calls can still overshoot by a few)
  const {rowCount} = await sql.query(
    `insert into recommend_calls (client_key)
     select $1 from (select count(*) filter (where client_key = $1)::int as mine, count(*)::int as total
                       from recommend_calls where at > now() - ${RETENTION}) used
      where used.mine < $2 and used.total < $3`,
    [clientKey, limits.perClient, limits.total])
  return rowCount === 1
}

export type StoredOutput ={path: string; width: number; height: number; bytes: number}
export type StoredJob = {
  id: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  error?: string
  output?: StoredOutput
}

export async function readJob(id: string, sql: Sql = db()): Promise<StoredJob | null> {
  if (!UUID.test(id)) return null
  const {rows: [row]} = await sql.query(
    `select status, error, output_path, image_w, image_h, bytes, started_at, finished_at,
            (status = 'running' and ${DEAD}) as stale
       from render_jobs where id = $1`,
    [id])
  if (!row) return null
  const startedAt = new Date(row.started_at).getTime()
  // The instance running it is gone (crash, deploy, platform timeout): report it failed instead of running forever.
  if (row.stale) return {id, status: 'failed', startedAt, error: 'timeout'}
  return {
    id, status: row.status, startedAt,
    finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : undefined,
    error: row.error ?? undefined,
    output: row.output_path ? {path: row.output_path, width: row.image_w, height: row.image_h, bytes: row.bytes} : undefined,
  }
}

export type Outcome = {status: 'succeeded'; output: StoredOutput} | {status: 'failed' | 'cancelled'; error: string}

/** End a running job. False when it already ended (for example cancelled from another instance): the first outcome stands. */
export async function settleJob(id: string, outcome: Outcome, sql: Sql = db()): Promise<boolean> {
  if (!UUID.test(id)) return false
  const output = outcome.status === 'succeeded' ? outcome.output : undefined
  const {rowCount} = await sql.query(
    `update render_jobs
        set status = $2, error = $3, output_path = $4, image_w = $5, image_h = $6, bytes = $7, finished_at = now()
      where id = $1 and status = 'running'`,
    [id, outcome.status, outcome.status === 'succeeded' ? null : outcome.error.slice(0, 80), output?.path ?? null, output?.width ?? null, output?.height ?? null, output?.bytes ?? null])
  return rowCount === 1
}

/** Keep a running job alive. Called on an interval by the instance doing the work; a no-op once the job ended. */
export async function beatJob(id: string, sql: Sql = db()): Promise<void> {
  if (!UUID.test(id)) return
  await sql.query(`update render_jobs set heartbeat_at = now() where id = $1 and status = 'running'`, [id])
}

/** Drop jobs past retention and return the storage paths of their images, for the caller to delete. */
export async function purgeExpiredJobs(sql: Sql = db()): Promise<string[]> {
  const {rows} = await sql.query<{output_path: string | null}>(
    `delete from render_jobs where started_at < now() - ${RETENTION} returning output_path`)
  return rows.flatMap(r => r.output_path ?? [])
}
