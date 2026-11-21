import type {Plan} from './demo'
import {RECOMMEND_KEY} from './storage-keys.ts'

export type AiItem = {id: string; title: string; category: string; price: number; rating: number | null; reason: string; url: string | null; image?: string | null}
export type ClientRecommendation = {source: 'ai' | 'rules'; items: AiItem[]; total: number; budget: number; summary: string; fallbackReason?: import('./recommend-status.ts').RecommendFailure}
export const recommendationKey = (plan: Plan, measuredWidth = false) => JSON.stringify({styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: measuredWidth ? plan.width : undefined, need: plan.need?.trim() || ''})

// Share in-flight requests across Strict Mode mounts and keep one answer per brief in this tab.
const pending = new Map<string, Promise<ClientRecommendation>>()
export async function requestRecommendation(key: string, fresh = false): Promise<ClientRecommendation> {
  if (!fresh) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(RECOMMEND_KEY) || 'null')
      if (saved?.version === 2 && saved.key === key && saved.rec?.source === 'ai' && Array.isArray(saved.rec.items)) return saved.rec
    } catch {}
  }
  const existing = pending.get(key)
  if (existing) return existing
  const request = (async () => {
    const response = await fetch('/api/recommend', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: key, signal: AbortSignal.timeout(150000)})
    if (!response.ok) throw new Error('recommend_unavailable')
    const result = await response.json() as ClientRecommendation
    if (!Array.isArray(result.items) || !['ai', 'rules'].includes(result.source)) throw new Error('invalid_recommendation')
    try {
      if (result.source === 'ai') sessionStorage.setItem(RECOMMEND_KEY, JSON.stringify({version: 2, key, rec: result}))
      else sessionStorage.removeItem(RECOMMEND_KEY)
    } catch {}
    return result
  })()
  pending.set(key, request)
  try { return await request } finally { pending.delete(key) }
}
