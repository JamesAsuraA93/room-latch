// node scripts/live-render.test.mts — no real photos, no network, no CLI calls
import assert from 'node:assert/strict'
import {buildPrompt, childEnv, gateRequest, liveProvider, sniffImage} from '../lib/live-render-core.ts'
import {OPENAI_EDITS_URL, OpenaiRenderError, buildEditRequest, openaiEdit} from '../lib/openai-render.ts'

const ON = {ROOMLATCH_RENDER_PROVIDER: 'codex', ROOMLATCH_CODEX_RENDER: '1'}
const H = (h: Record<string, string>) => new Headers(h)
const local = {host: '127.0.0.1:3123', origin: 'http://127.0.0.1:3123', 'sec-fetch-site': 'same-origin'}

// provider selection: fail closed
assert.equal(liveProvider({}), null)
assert.equal(liveProvider({...ON, VERCEL: '1'}), null, 'never on Vercel')
assert.equal(liveProvider({ROOMLATCH_RENDER_PROVIDER: 'codex'}), null, 'needs explicit flag')
assert.equal(liveProvider(ON), 'codex')
assert.equal(liveProvider({ROOMLATCH_RENDER_PROVIDER: 'openai', ROOMLATCH_OPENAI_RENDER: '1'}), null, 'openai needs key')
assert.equal(liveProvider({ROOMLATCH_RENDER_PROVIDER: 'openai', ROOMLATCH_OPENAI_RENDER: '1', OPENAI_API_KEY: 'sk-test'}), 'openai')
assert.equal(liveProvider({ROOMLATCH_RENDER_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test'}), null, 'openai off by default')

// request gate
assert.deepEqual(gateRequest({}, H(local), 'POST'), {ok: false, status: 404, code: 'live_render_disabled'})
assert.equal(gateRequest(ON, H(local), 'POST').ok, true)
assert.equal((gateRequest(ON, H({...local, host: '192.168.1.10:3123', origin: 'http://192.168.1.10:3123'}), 'POST') as {code: string}).code, 'not_loopback')
assert.equal((gateRequest(ON, H({...local, 'sec-fetch-site': 'cross-site'}), 'POST') as {code: string}).code, 'cross_site')
assert.equal((gateRequest(ON, H({...local, origin: 'http://evil.example'}), 'POST') as {code: string}).code, 'bad_origin')
assert.equal((gateRequest(ON, H({host: '127.0.0.1:3123'}), 'POST') as {code: string}).code, 'bad_origin', 'POST without Origin refused')
assert.equal(gateRequest(ON, H({host: 'localhost:3123'}), 'GET').ok, true)

// image sniffing (synthetic headers only)
assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime, 'image/jpeg')
assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime, 'image/png')
assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.mime, 'image/webp')
assert.equal(sniffImage(new TextEncoder().encode('<svg>')), null)
assert.equal(sniffImage(new TextEncoder().encode('GIF89a')), null)

// prompt only from server data
const p = buildPrompt({key: 'japandi', th: 'เจแปนดิ', prompt: 'ไม้โทนกลาง'}, [{id: 'fixture-desk-wood-80', name: 'โต๊ะทำงานไม้ 80 ซม.', x: 26, y: 51, w: 26}], 'input.jpg')
assert.match(p, /output\.png/); assert.match(p, /input\.jpg/); assert.match(p, /เจแปนดิ/); assert.match(p, /id=fixture-desk-wood-80/)

// child env drops secrets
const env = childEnv({HOME: '/Users/x', USER: 'x', OPENAI_API_KEY: 'sk-secret', GITHUB_TOKEN: 'ghp_x', PATH: '/evil'}, '/tmp/job')
assert.equal(env.OPENAI_API_KEY, undefined); assert.equal((env as Record<string, string>).GITHUB_TOKEN, undefined)
assert.equal(env.TMPDIR, '/tmp/job'); assert.ok(!env.PATH.includes('/evil'))

// OpenAI provider contract (mocked fetch, no network, fake key)
const fakeEnv = {OPENAI_API_KEY: 'sk-test-not-real', OPENAI_IMAGE_MODEL: 'gpt-image-test'}
const img = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
assert.throws(() => buildEditRequest({image: img, mime: 'image/png', prompt: 'x', env: {OPENAI_IMAGE_MODEL: 'm'}}), (e: unknown) => (e as OpenaiRenderError).code === 'missing_api_key')
assert.throws(() => buildEditRequest({image: img, mime: 'image/png', prompt: 'x', env: {OPENAI_API_KEY: 'k'}}), (e: unknown) => (e as OpenaiRenderError).code === 'missing_model')
const {url, init} = buildEditRequest({image: img, mime: 'image/png', prompt: 'hello', env: fakeEnv})
assert.equal(url, OPENAI_EDITS_URL); assert.equal(init.method, 'POST')
assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer sk-test-not-real')
const form = init.body as FormData
assert.equal(form.get('model'), 'gpt-image-test'); assert.equal(form.get('prompt'), 'hello'); assert.equal(form.get('n'), '1')
assert.equal((form.get('image') as File).type, 'image/png')

let calls = 0
const okFetch = (async () => { calls++; return new Response(JSON.stringify({data: [{b64_json: Buffer.from('PNGDATA').toString('base64')}]}), {status: 200}) }) as typeof fetch
assert.equal((await openaiEdit({image: img, mime: 'image/png', prompt: 'p', env: fakeEnv, fetchImpl: okFetch})).toString(), 'PNGDATA')
const errFetch = (async () => new Response('{"error":"nope sk-test-not-real"}', {status: 401})) as typeof fetch
await assert.rejects(openaiEdit({image: img, mime: 'image/png', prompt: 'p', env: fakeEnv, fetchImpl: errFetch}), (e: unknown) => {
  const err = e as OpenaiRenderError
  return err.code === 'http_error' && err.status === 401 && !err.message.includes('sk-test')
})
const badFetch = (async () => new Response('{"data":[]}', {status: 200})) as typeof fetch
await assert.rejects(openaiEdit({image: img, mime: 'image/png', prompt: 'p', env: fakeEnv, fetchImpl: badFetch}), (e: unknown) => (e as OpenaiRenderError).code === 'bad_response')
assert.equal(calls, 1)
console.log('live-render ok')
