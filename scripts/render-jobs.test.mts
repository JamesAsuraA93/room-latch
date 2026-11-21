// Render job store against real Postgres. Everything runs in ONE transaction that is always rolled back,
// including the table itself, so it is safe on a live database and needs no migration first.
//   node --env-file=.env.local scripts/render-jobs.test.mts
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import pg from 'pg'
import {beatJob, purgeExpiredJobs, readJob, recommendLimits, renderPath, reserveJob, reserveModelCall, settleJob} from '../lib/render-jobs.ts'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) { console.log('render-jobs skipped: DATABASE_URL_UNPOOLED or DATABASE_URL is not set'); process.exit(0) }

// The migration carries its own begin/commit; they must not end our transaction.
const migration = ['002-render-jobs.sql', '005-recommend-calls.sql', '006-render-heartbeat.sql']
  .map(f => readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8').replace(/^\s*(begin|commit)\s*;\s*$/gim, '')).join('\n')
assert.doesNotMatch(migration, /\b(commit|rollback|begin)\b/i)

const sql = new pg.Client({connectionString: url})
await sql.connect()
try {
  await sql.query('begin')
  await sql.query(migration)
  await sql.query('delete from render_jobs; delete from recommend_calls') // clean slate for the counts below (rolled back)

  const output = (id: string) => ({path: renderPath(id), width: 1536, height: 1024, bytes: 2_000_000})
  const [a1, a2, a3, b1, d1] = Array.from({length: 5}, () => randomUUID())

  // no lock and no daily limit: one caller may run jobs side by side
  for (const id of [a1, a2, a3]) await reserveJob(id, 'a', sql)
  for (const id of [a1, a2, a3]) assert.deepEqual({...(await readJob(id, sql)), startedAt: 0}, {id, status: 'running', startedAt: 0, finishedAt: undefined, error: undefined, output: undefined})

  // the first outcome stands
  assert.equal(await settleJob(a1, {status: 'succeeded', output: output(a1)}, sql), true)
  assert.equal(await settleJob(a1, {status: 'cancelled', error: 'cancelled'}, sql), false)
  const done = await readJob(a1, sql)
  assert.equal(done?.status, 'succeeded'); assert.deepEqual(done?.output, output(a1)); assert.ok(done!.finishedAt! >= done!.startedAt)

  assert.equal(await settleJob(a2, {status: 'failed', error: 'openai_quota'}, sql), true)
  assert.equal((await readJob(a2, sql))?.error, 'openai_quota')
  assert.equal(await settleJob(a3, {status: 'cancelled', error: 'cancelled'}, sql), true)

  // a running row whose instance died reads as a timeout
  await reserveJob(b1, 'b', sql)
  await sql.query(`update render_jobs set started_at = now() - interval '10 minutes' where id = $1`, [b1])
  assert.deepEqual({...(await readJob(b1, sql)), startedAt: 0}, {id: b1, status: 'failed', startedAt: 0, error: 'timeout'})

  // a server that dies mid-job stops beating: after LOST_AFTER_SECONDS the job reads as failed, long before the 6 minute cap
  await reserveJob(d1, 'd', sql)
  await sql.query(`update render_jobs set heartbeat_at = now() - interval '1 minute' where id = $1`, [d1])
  assert.equal((await readJob(d1, sql))?.status, 'failed')
  await beatJob(d1, sql) // a live instance beating again revives it
  assert.equal((await readJob(d1, sql))?.status, 'running')

  // ids come from the URL: junk never reaches a uuid column
  assert.equal(await readJob('nope', sql), null)
  assert.equal(await readJob(randomUUID(), sql), null)
  assert.equal(await settleJob("x'; drop table render_jobs; --", {status: 'cancelled', error: 'cancelled'}, sql), false)

  // retention: old rows go, and the caller gets the image paths to delete
  await sql.query(`update render_jobs set started_at = now() - interval '25 hours', finished_at = now() - interval '25 hours' where id = any($1)`, [[a1, a2]])
  assert.deepEqual(await purgeExpiredJobs(sql), [renderPath(a1)])
  assert.equal(await readJob(a1, sql), null)
  assert.equal((await readJob(a3, sql))?.status, 'cancelled')

  // recommend model calls: per caller, then deployment-wide, and old calls stop counting
  assert.deepEqual(recommendLimits({}), {perClient: 20, total: 500})
  assert.deepEqual(recommendLimits({ROOMLATCH_RECOMMEND_DAILY_LIMIT: '0', ROOMLATCH_RECOMMEND_DAILY_CAP: 'x'}), {perClient: 0, total: 500})
  const rl = {perClient: 2, total: 3}
  assert.equal(await reserveModelCall('a', rl, sql), true)
  assert.equal(await reserveModelCall('a', rl, sql), true)
  assert.equal(await reserveModelCall('a', rl, sql), false)
  assert.equal(await reserveModelCall('b', rl, sql), true)
  assert.equal(await reserveModelCall('c', rl, sql), false)
  await sql.query(`update recommend_calls set at = now() - interval '25 hours' where client_key = 'a'`)
  assert.equal(await reserveModelCall('a', rl, sql), true)
  assert.equal((await sql.query(`select count(*)::int as n from recommend_calls where at < now() - interval '24 hours'`)).rows[0].n, 0)

  // the schema refuses an image path that is not ours (kept last: it aborts the transaction)
  await assert.rejects(sql.query(`update render_jobs set output_path = 'designs/x.png' where id = $1`, [a3]), /render_jobs_output_path_check/)
  console.log('render-jobs ok (rolled back)')
} finally {
  await sql.query('rollback').catch(() => {})
  await sql.end()
}
