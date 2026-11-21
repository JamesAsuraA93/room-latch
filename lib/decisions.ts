// OpenAI Decisions API (POST /v1/decisions): typed yes/no, choice and score answers about images.
// Pure request builders + parsers (no Next imports, testable offline) and one fetch call with an injectable fetch.
// Reference: https://developers.openai.com/api/docs/guides/decisions
// Questions carry their own candidate image; the shared evidence (room photo or reference product) goes in `input`.

export const DECISIONS_URL = 'https://api.openai.com/v1/decisions'
export const DECISIONS_MODEL = 'gpt-6-luna'
export const DECISION_BATCH = 8 // candidates per request; several questions each
export const DECISIONS_USD_PER_M_INPUT = 0.10 // output tokens are free (pricing page, 2026-11-21)

export type ImageRef = {id: string; imageUrl: string} // https URL or data: URL
type Level = {label: string; description: string}
type Question =
  | {type: 'predicate'; name: string; instructions: unknown}
  | {type: 'score'; name: string; levels: Level[]; instructions: unknown}
  | {type: 'choice'; name: string; choices: {value: string; description?: string}[]; instructions: unknown}
export type DecisionsBody = {model: string; input: unknown[]; questions: Question[]}
type Answer = {type: string; name: string; probability?: number; score?: number; choice?: string; confidence?: number}
export type DecisionsPayload = {answers?: Answer[]; usage?: {input_tokens?: number}}

// What each shop category means in a question ("is this a ...?")
export const CATEGORY_WORDS: Record<string, string> = {
  seating: 'sofa, chair, stool or bench', table: 'coffee, side or dining table', light: 'lamp or light fitting',
  textile: 'rug, curtain or cushion', accent: 'decor piece (vase, shelf, mirror, plant, wall art or storage)',
}

const STYLE_FIT: Level[] = [
  {label: 'clashes', description: 'its style, colour or material would look out of place in this room and style'},
  {label: 'neutral', description: 'would not clash but has nothing of the requested style'},
  {label: 'fits', description: "clearly in the requested style and suits the room's colours and light"},
  {label: 'perfect', description: 'exactly the requested style; looks chosen for this room'},
]
const LOOKS_LIKE: Level[] = [
  {label: 'different', description: 'a different kind of object, or clearly different shape and material'},
  {label: 'same category', description: 'same kind of object but a different shape or material'},
  {label: 'similar', description: 'similar shape and material; details differ (proportions, colour tint, legs)'},
  {label: 'near identical', description: 'would pass as the same product in a room photo'},
]
export const MAX_SCORE = LOOKS_LIKE.length - 1

const withImage = (text: string, imageUrl: string) => [{type: 'input_text', text}, {type: 'input_image', image_url: imageUrl}]
const evidence = (text: string, imageUrl: string) => [{role: 'user', content: withImage(text, imageUrl)}]

/** "How well does each listing fit this room in this style?" plus the checks that keep junk out of the top. */
export function fitRequest(roomImage: string, style: {th: string; prompt: string}, batch: (ImageRef & {category: string})[]): DecisionsBody {
  const questions = batch.flatMap((c, i): Question[] => {
    const what = CATEGORY_WORDS[c.category] ?? 'piece of home furniture'
    return [
      {type: 'predicate', name: `q${i}_is`, instructions: withImage(`Is the main product in this listing photo a ${what}?`, c.imageUrl)},
      {type: 'predicate', name: `q${i}_clean`, instructions: withImage('Is the whole product clearly visible, not hidden behind text, collages or people?', c.imageUrl)},
      {type: 'predicate', name: `q${i}_full`, instructions: withImage('Is this a full-size piece for a home room, not a miniature, toy, desk or decorative model?', c.imageUrl)},
      {type: 'score', name: `q${i}_style`, levels: STYLE_FIT,
        instructions: withImage(`Requested style: ${style.th} (${style.prompt}). How well would this product fit the room in the reference photo?`, c.imageUrl)},
    ]
  })
  return {model: DECISIONS_MODEL, input: evidence('The room the product is for:', roomImage), questions}
}

/** "How closely does each listing match the reference product?" */
export function matchRequest(referenceImage: string, category: string, batch: ImageRef[]): DecisionsBody {
  const what = CATEGORY_WORDS[category] ?? 'product'
  const questions = batch.flatMap((c, i): Question[] => [
    {type: 'predicate', name: `q${i}_is`, instructions: withImage(`Is the main product in this listing photo a ${what}?`, c.imageUrl)},
    {type: 'score', name: `q${i}_like`, levels: LOOKS_LIKE,
      instructions: withImage('How closely does the product in this listing photo match the reference product?', c.imageUrl)},
  ])
  return {model: DECISIONS_MODEL, input: evidence('Reference product the user is looking for:', referenceImage), questions}
}

/** Which shop category and app styles a reference image belongs to (used to pick search words). */
export function classifyRequest(referenceImage: string, categories: readonly string[], styles: readonly string[]): DecisionsBody {
  return {model: DECISIONS_MODEL, input: evidence('A product photo:', referenceImage), questions: [
    {type: 'choice', name: 'category', instructions: 'Which kind of product is this?',
      choices: categories.map(value => ({value, description: CATEGORY_WORDS[value]}))},
    {type: 'choice', name: 'style', instructions: 'Which interior style does this product fit best?', choices: styles.map(value => ({value}))},
  ]}
}

export type Fit = {id: string; isProduct: number; clean: number; fullSize: number; style: number; score: number}
export type Match = {id: string; isProduct: number; likeness: number; score: number}

const answersOf = (payload: DecisionsPayload) => new Map((payload.answers ?? []).filter(a => a.type !== 'refusal').map(a => [a.name, a]))
const prob = (m: Map<string, Answer>, k: string) => m.get(k)?.probability ?? 0
const score = (m: Map<string, Answer>, k: string) => m.get(k)?.score ?? 0

/** 0..3, like the style score, but zeroed out for non-products, toys and unusable photos. Refused answers count as 0. */
export const fitScore = (f: Omit<Fit, 'id' | 'score'>) => f.isProduct * f.fullSize * (0.5 + 0.5 * f.clean) * f.style

export function parseFit(payload: DecisionsPayload, batch: ImageRef[]): Fit[] {
  const m = answersOf(payload)
  return batch.map((c, i) => {
    const f = {isProduct: prob(m, `q${i}_is`), clean: prob(m, `q${i}_clean`), fullSize: prob(m, `q${i}_full`), style: score(m, `q${i}_style`)}
    return {id: c.id, ...f, score: fitScore(f)}
  })
}

export function parseMatch(payload: DecisionsPayload, batch: ImageRef[]): Match[] {
  const m = answersOf(payload)
  return batch.map((c, i) => {
    const isProduct = prob(m, `q${i}_is`), likeness = score(m, `q${i}_like`)
    return {id: c.id, isProduct, likeness, score: isProduct * likeness}
  })
}

export function parseClassify(payload: DecisionsPayload): {category: string | null; style: string | null} {
  const m = answersOf(payload)
  return {category: m.get('category')?.choice ?? null, style: m.get('style')?.choice ?? null}
}

export class DecisionsError extends Error {
  code: string
  status?: number
  constructor(code: string, status?: number) { super(code); this.code = code; this.status = status }
}

/** One Decisions call. The key is read per call and never logged or echoed; response bodies are not surfaced. */
export async function decide(body: DecisionsBody, {env = process.env, fetchImpl = fetch, signal}: {env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; signal?: AbortSignal} = {}): Promise<DecisionsPayload> {
  const key = env.OPENAI_API_KEY
  if (!key) throw new DecisionsError('missing_api_key')
  const res = await fetchImpl(DECISIONS_URL, {method: 'POST', signal, body: JSON.stringify(body),
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'}})
  if (!res.ok) throw new DecisionsError('http_error', res.status)
  const json = await res.json().catch(() => null) as DecisionsPayload | null
  if (!json || !Array.isArray(json.answers)) throw new DecisionsError('bad_response')
  return json
}

/** Ask in batches; returns parsed rows in input order and the input tokens spent. */
export async function decideAll<T extends ImageRef, R>(items: T[], build: (batch: T[]) => DecisionsBody, parse: (p: DecisionsPayload, batch: T[]) => R[],
  opts?: Parameters<typeof decide>[1]): Promise<{rows: R[]; inputTokens: number}> {
  const rows: R[] = []
  let inputTokens = 0
  for (let i = 0; i < items.length; i += DECISION_BATCH) {
    const batch = items.slice(i, i + DECISION_BATCH)
    const payload = await decide(build(batch), opts)
    inputTokens += payload.usage?.input_tokens ?? 0
    rows.push(...parse(payload, batch))
  }
  return {rows, inputTokens}
}

export const decisionsUsd = (inputTokens: number) => inputTokens * DECISIONS_USD_PER_M_INPUT / 1e6
