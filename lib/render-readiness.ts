import 'server-only'
import {liveProvider, renderUnavailableReason, type Provider} from '@/lib/live-render-core'
import {imageSettings} from '@/lib/openai-render'

export function renderReadiness(env: Record<string, string | undefined>): {provider: Provider | null; reason?: string; model?: string; quality?: string} {
  const provider = liveProvider(env)
  if (!provider) return {provider: null, reason: renderUnavailableReason(env)}
  return {provider, ...imageSettings(env)}
}
