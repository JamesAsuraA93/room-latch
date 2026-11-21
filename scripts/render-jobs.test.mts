// Render job store against real Postgres. Everything runs in ONE transaction that is always rolled back,
// including the table itself, so it is safe on a live database and needs no migration first.
//   node --env-file=.env.local scripts/render-jobs.test.mts
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import pg from 'pg'
import {purgeExpiredJobs, readJob, renderPath, reserveJob, settleJob} from '../lib/render-jobs.ts'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) { console.log('render-jobs skipped: DATABASE_URL_UNPOOLED or DATABASE_URL is not set'); process.exit(0) }

// The migration carries its own begin/commit; they must not end our transaction.
const migration = readFileSync(new URL('../db/migrations/002-render-jobs.sql', import.meta.url), 'utf8').replace(/^\s*(begin|commit)\s*;\s*$/gim, '')
assert.doesNotMatch(migration, /\b(commit|rollback|begin)\b/i)

const sql = new pg.Client({connectionString: url})
await sql.connect()
try {
  await sql.query('begin')
  await sql.query(migration)
  await sql.query('delete from render_jobs') // clean slate for the counts below (rolled back)

  const limits = {perClient: 2, total: 3}
  const output = (id: string) => ({path: renderPath(id), width: 1536, height: 1024, bytes: 2_000_000})
  const [a1, a2, a3, a4, b1, c1] = Array.from({length: 6}, () => randomUUID())

  // one running job per caller
  assert.equal(await reserveJob(a1, 'a', limits, sql), null)
  assert.equal(await reserveJob(a2, 'a', limits, sql), 'job_in_progress')
  assert.deepEqual({...(await readJob(a1, sql)), startedAt: 0}, {id: a1, status: 'running', startedAt: 0, finishedAt: undefined, error: undefined, output: undefined})

  // the first outcome stands
  assert.equal(await settleJob(a1, {status: 'succeeded', output: output(a1)}, sql), true)
  assert.equal(await settleJob(a1, {status: 'cancelled', error: 'cancelled'}, sql), false)
  const done = await readJob(a1, sql)
  assert.equal(done?.status, 'succeeded'); assert.deepEqual(done?.output, output(a1)); assert.ok(done!.finishedAt! >= done!.startedAt)

  // failed jobs cost nothing and are not counted; succeeded and cancelled ones are
  assert.equal(await reserveJob(a2, 'a', limits, sql), null)
  assert.equal(await settleJob(a2, {status: 'failed', error: 'openai_quota'}, sql), true)
  assert.equal((await readJob(a2, sql))?.error, 'openai_quota')
  assert.equal(await reserveJob(a3, 'a', limits, sql), null)
  assert.equal(await settleJob(a3, {status: 'cancelled', error: 'cancelled'}, sql), true)
  assert.equal(await reserveJob(a4, 'a', limits, sql), 'rate_limited')

  // deployment-wide ceiling
  assert.equal(await reserveJob(b1, 'b', limits, sql), null)
  assert.equal(await reserveJob(c1, 'c', limits, sql), 'daily_cap_reached')

  // a running row whose instance died reads as a timeout and no longer blocks its caller
  await sql.query(`update render_jobs set started_at = now() - interval '10 minutes' where id = $1`, [b1])
  assert.deepEqual({...(await readJob(b1, sql)), startedAt: 0}, {id: b1, status: 'failed', startedAt: 0, error: 'timeout'})
  assert.equal(await reserveJob(c1, 'b', {perClient: 9, total: 9}, sql), null)

  // ids come from the URL: junk never reaches a uuid column
  assert.equal(await readJob('nope', sql), null)
  assert.equal(await readJob(randomUUID(), sql), null)
  assert.equal(await settleJob("x'; drop table render_jobs; --", {status: 'cancelled', error: 'cancelled'}, sql), false)

  // retention: old rows go, and the caller gets the image paths to delete
  await sql.query(`update render_jobs set started_at = now() - interval '25 hours', finished_at = now() - interval '25 hours' where id = any($1)`, [[a1, a2]])
  assert.deepEqual(await purgeExpiredJobs(sql), [renderPath(a1)])
  assert.equal(await readJob(a1, sql), null)
  assert.equal((await readJob(a3, sql))?.status, 'cancelled')

  // the schema refuses an image path that is not ours (kept last: it aborts the transaction)
  await assert.rejects(sql.query(`update render_jobs set output_path = 'designs/x.png' where id = $1`, [a3]), /render_jobs_output_path_check/)
  console.log('render-jobs ok (rolled back)')
} finally {
  await sql.query('rollback').catch(() => {})
  await sql.end()
}
