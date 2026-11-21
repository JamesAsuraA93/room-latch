// Pure, dependency-free pieces of the live render (gate, image sniffing, prompt).
// No Next imports so `node scripts/live-render.test.mts` can test them directly.

export type Provider = 'codex' | 'openai'
export type Gate = {ok: true; provider: Provider} | {ok: false; status: number; code: string}

/**
 * Which live provider is enabled. Fail closed: off unless explicitly enabled, never on Vercel,
 * and codex only when running locally (it drives the Mac's signed-in CLI).
 * There is no fallback between providers: a failed job fails, it is never retried on the other one.
 */
export function liveProvider(env: Record<string, string | undefined>): Provider | null {
  if (env.VERCEL || env.VERCEL_ENV) return null
  const p = env.ROOMLATCH_RENDER_PROVIDER
  if (p === 'codex' && env.ROOMLATCH_CODEX_RENDER === '1') return 'codex'
  if (p === 'openai' && env.ROOMLATCH_OPENAI_RENDER === '1' && !!env.OPENAI_API_KEY) return 'openai'
  return null
}

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i

/** Request gate: feature on, loopback Host, same-origin Origin, not a cross-site fetch. */
export function gateRequest(env: Record<string, string | undefined>, headers: Headers, method: string): Gate {
  const provider = liveProvider(env)
  if (!provider) return {ok: false, status: 404, code: 'live_render_disabled'}
  const host = headers.get('host') ?? ''
  if (!LOOPBACK.test(host)) return {ok: false, status: 403, code: 'not_loopback'}
  const site = headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return {ok: false, status: 403, code: 'cross_site'}
  if (method !== 'GET') {
    // state-changing requests must carry an Origin equal to this server
    const origin = headers.get('origin')
    if (!origin || origin !== `http://${host}`) return {ok: false, status: 403, code: 'bad_origin'}
  }
  return {ok: true, provider}
}

export type ImageKind = {ext: 'jpg' | 'png' | 'webp'; mime: string}

/** Identify JPEG/PNG/WebP by magic bytes; anything else is rejected. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return {ext: 'jpg', mime: 'image/jpeg'}
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return {ext: 'png', mime: 'image/png'}
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return {ext: 'webp', mime: 'image/webp'}
  return null
}

export const INPUT_MAX_BYTES = 10 * 1024 * 1024
export const OUTPUT_MAX_BYTES = 30 * 1024 * 1024
export const OUTPUT_NAME = 'output.png'

export type StyleEntry = {key: string; th: string; prompt: string}
export type PromptItem = {id: string; name: string; x: number; y: number; w: number}

/**
 * Prompt built only from server data: validated style id → registry text, validated SKU ids → catalog names.
 * The client never sends prompt text, models, paths or URLs.
 */
export function buildPrompt(style: StyleEntry, items: PromptItem[], inputFile: string): string {
  const lines = items.map((it, i) => `${i + 1}. id=${it.id} | ${it.name}${it.w > 0 ? ` | bbox x=${Math.round(it.x)}% y=${Math.round(it.y)}% w=${Math.round(it.w)}%` : ''}`)
  return [
    `Use your built-in image generation tool ($imagegen) to EDIT the attached room photo (${inputFile}). Do not run shell commands, do not browse, do not read or write any other file.`,
    `Save exactly one result image in the current folder as ${OUTPUT_NAME} (PNG, same aspect ratio as the input). Then stop.`,
    '',
    `แต่งห้องในรูปที่แนบในสไตล์ ${style.th}: ${style.prompt}`,
    'ให้ผลเป็นภาพถ่ายห้องจริง ไม่ใช่ภาพวาดหรือเรนเดอร์ 3D',
    'ห้ามเปลี่ยน: ผนังทุกด้าน หน้าต่าง ประตู เสา คาน ฝ้า ความสูงเพดาน มุมกล้อง สัดส่วนห้อง และพื้นเดิม',
    'ห้ามเพิ่มเฟอร์นิเจอร์หรือของตกแต่งอื่นนอกรายการ ห้ามใส่ตัวหนังสือ โลโก้ หรือลายน้ำ ถ้ามีคนในรูปให้ลบออกแล้วเติมพื้นหลังให้กลมกลืน',
    '',
    'สินค้าที่ต้องวาง (ตำแหน่งเป็นเปอร์เซ็นต์ของรูป จากมุมซ้ายบน ถ้ามี):',
    ...lines,
  ].join('\n')
}

/** Minimal env for the child: keep login/home so the CLI finds its own auth, drop API keys and everything else. */
export function childEnv(env: Record<string, string | undefined>, tmp: string): Record<string, string> {
  return {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
    HOME: env.HOME ?? '',
    USER: env.USER ?? '',
    LANG: 'en_US.UTF-8',
    TMPDIR: tmp,
  }
}
