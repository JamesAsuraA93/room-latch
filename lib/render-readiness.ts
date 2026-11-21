import 'server-only'
import {liveProvider, renderUnavailableReason, type Provider} from '@/lib/live-render-core'

export function renderReadiness(env: Record<string, string | undefined>): {provider: Provider | null; reason?: string} {
  const provider = liveProvider(env)
  if (!provider) return {provider: null, reason: renderUnavailableReason(env)}
  return {provider}
}
