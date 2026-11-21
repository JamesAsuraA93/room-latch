// Server-only step 5: pick real Shopee listings for the room within the budget.
// The decision model (OpenAI) chooses among candidates from Postgres; prices and the total always come from the DB.
// No API key, or the model fails twice: a rules pick (best rated per role that fits), labelled as such.
import 'server-only'
import {recommendCandidates} from '@/lib/db'
import {openaiJson} from '@/lib/openai-render'
import {recommendLimits, reserveModelCall} from '@/lib/render-jobs'
import {parsePicks, recommendPrompt, rulesPick, totalOf, withinBudget, type Pick, type RecommendInput, type Recommendation} from '@/lib/recommend-core'

const TIMEOUT_MS = 60_000

async function aiPicks(input: RecommendInput, candidates: Awaited<ReturnType<typeof recommendCandidates>>): Promise<{items: Pick[]; summary: string} | null> {
  let previousTotal: number | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await openaiJson({prompt: recommendPrompt(input, candidates, previousTotal), images: [], purpose: 'decision', signal: AbortSignal.timeout(TIMEOUT_MS)})
    const parsed = parsePicks(answer, candidates)
    if (!parsed) continue
    const total = totalOf(parsed.items)
    if (total <= input.budget) return parsed
    previousTotal = total
    // second answer still over budget: keep the model's choice, minus the most expensive items until it fits
    if (attempt === 1) { const kept = withinBudget(parsed.items, input.budget); return kept.length ? {...parsed, items: kept} : null }
  }
  return null
}

/** Model call only while the caller and the deployment are under their daily limits; otherwise (or if the
 *  counter is unreachable) the free rules pick. */
async function modelAllowed(clientKey: string): Promise<boolean> {
  try { return await reserveModelCall(clientKey, recommendLimits(process.env)) } catch (e) {
    console.error('recommend limit check failed', (e as Error).message)
    return false
  }
}

export async function recommend(input: RecommendInput, clientKey: string): Promise<Recommendation> {
  const candidates = await recommendCandidates(input.style, input.budget)
  if (process.env.OPENAI_API_KEY && candidates.length && await modelAllowed(clientKey)) {
    try {
      const picked = await aiPicks(input, candidates)
      if (picked) return {source: 'ai', items: picked.items, total: totalOf(picked.items), budget: input.budget, summary: picked.summary}
    } catch (e) { console.error('recommend model failed', (e as Error).message) }
  }
  const items = rulesPick(candidates, input.budget)
  return {source: 'rules', items, total: totalOf(items), budget: input.budget, summary: ''}
}
