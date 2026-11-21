// Postgres store for render jobs run by the OpenAI provider (table render_jobs, db/schema.sql).
// On a serverless host every request may land on a different instance, so job status cannot live in memory.
// The same rows back the daily limits. Database only: the caller owns the image in Object storage.
// Relative imports with extensions so `node scripts/render-jobs.test.mts` can load this file directly.
import type {Pool} from 'pg'
import {db} from './db.ts'

type Sql = Pick<Pool, 'query'>
type Env = Record<string, string | undefined>

/** A running row older than this lost its instance (the OpenAI call itself is capped well below it). */
export const STALE_AFTER_SECONDS = 6 * 60
const RETENTION = `interval '24 hours'`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const renderPath = (id: string) => `renders/${id}.png`

export type Limits = {perClient: number; total: number}
const count = (value: string | undefined, fallback: number) => value && /^\d+$/.test(value) ? Number(value) : fallback
/** Renders allowed per 24 hours: per caller, and for the whole deployment (the spending ceiling). */
export function renderLimits(env: Env): Limits {
  return {perClient: count(env.ROOMLATCH_RENDER_DAILY_LIMIT, 5), total: count(env.ROOMLATCH_RENDER_DAILY_CAP, 100)}
}

export type Refused = 'job_in_progress' | 'rate_limited' | 'daily_cap_reached'

/**
 * Record a new running job unless the caller is over a limit. Failed jobs are not counted: they cost nothing.
 * shortcut: check then insert, not atomic, so parallel requests can overshoot a limit by a few; take an advisory lock
 * per client_key if the limits ever need to be exact.
 */
export async function reserveJob(id: string, clientKey: string, limits: Limits, sql: Sql = db()): Promise<Refused | null> {
  const {rows: [used]} = await sql.query<{mine: number; total: number; running: number}>(
    `select count(*) filter (where client_key = $1)::int as mine,
            count(*)::int as total,
            count(*) filter (where client_key = $1 and status = 'running' and started_at > now() - make_interval(secs => $2))::int as running
       from render_jobs
      where status <> 'failed' and started_at > now() - ${RETENTION}`,
    [clientKey, STALE_AFTER_SECONDS])
  if (used.running) return 'job_in_progress'
  if (used.mine >= limits.perClient) return 'rate_limited'
  if (used.total >= limits.total) return 'daily_cap_reached'
  await sql.query(`insert into render_jobs (id, client_key) values ($1, $2)`, [id, clientKey])
  return null
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
            (status = 'running' and started_at < now() - make_interval(secs => $2)) as stale
       from render_jobs where id = $1`,
    [id, STALE_AFTER_SECONDS])
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

/** Drop jobs past retention and return the storage paths of their images, for the caller to delete. */
export async function purgeExpiredJobs(sql: Sql = db()): Promise<string[]> {
  const {rows} = await sql.query<{output_path: string | null}>(
    `delete from render_jobs where started_at < now() - ${RETENTION} returning output_path`)
  return rows.flatMap(r => r.output_path ?? [])
}
