// Read-only checks using the same local env files as Next. No image generation or model-token charges.
import nextEnv from '@next/env'
import pg from 'pg'
import {liveProvider, renderUnavailableReason} from '../lib/live-render-core.ts'
import {MODEL_DEFAULTS} from '../lib/openai-render.ts'

nextEnv.loadEnvConfig(process.cwd(), true)
console.log('Render:', liveProvider(process.env) || renderUnavailableReason(process.env))
const model = process.env.OPENAI_DECISION_MODEL || MODEL_DEFAULTS.decision.model
console.log('Recommendation model:', model)
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 7000, query_timeout: 7000})
await Promise.all([
  (async () => {
    try {
      if (!process.env.DATABASE_URL) { console.log('DB: DATABASE_URL is missing'); return }
      const {rows: [schema]} = await pool.query("select to_regclass('public.recommend_calls') as recommendation_table")
      if (!schema.recommendation_table) console.log('Recommendation: missing table; apply db/migrations/005-recommend-calls.sql')
      else {
        const {rows: [usage]} = await pool.query("select count(*)::int as calls from recommend_calls where at > now() - interval '24 hours'")
        console.log('Recommendation calls in 24h:', usage.calls, '/ deployment cap:', process.env.ROOMLATCH_RECOMMEND_DAILY_CAP || '500')
      }
      const {rows: [photos]} = await pool.query("select count(*)::int as total, count(*) filter (where coalesce(nullif(trim(image_path), ''), nullif(trim(image_url), '')) is not null)::int as with_photo from shopee_listings")
      console.log('Catalog photos:', photos)
    } catch (error) { console.log('DB check failed:', (error as {code?: string}).code || 'connection_error') }
    finally { await pool.end() }
  })(),
  (async () => {
    if (!process.env.OPENAI_API_KEY?.trim()) { console.log('Recommendation: OPENAI_API_KEY is missing'); return }
    try {
      const response = await fetch('https://api.openai.com/v1/models', {headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`}, signal: AbortSignal.timeout(10000)})
      if (!response.ok) { console.log('OpenAI access:', response.status); return }
      const result = await response.json() as {data: {id: string}[]}
      console.log('Configured model accessible:', result.data.some(item => item.id === model))
    } catch (error) { console.log('OpenAI check failed:', (error as {cause?: {code?: string}; name: string}).cause?.code || (error as Error).name) }
  })(),
])
