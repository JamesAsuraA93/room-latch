// node scripts/live-render.test.mts — no real photos, no network, no CLI calls
import assert from 'node:assert/strict'
import {buildPrompt, childEnv, clientKey, gateRequest, isLoopbackHost, liveProvider, pngSize, sniffImage} from '../lib/live-render-core.ts'
import {renderPath} from '../lib/render-jobs.ts'
import {MODEL_DEFAULTS, OPENAI_EDITS_URL, OpenaiRenderError, buildEditRequest, imageSettings, openaiEdit, openaiJson} from '../lib/openai-render.ts'
import {codexFailureReason, elapsedLabel, isTerminalJob} from '../lib/render-outcome.ts'
import {designError} from '../lib/design-errors.ts'

const CODEX = {ROOMLATCH_RENDER_PROVIDER: 'codex'}
const OPENAI = {ROOMLATCH_RENDER_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test'}
const H = (h: Record<string, string>) => new Headers(h)
const local = {host: '127.0.0.1:3123', origin: 'http://127.0.0.1:3123', 'sec-fetch-site': 'same-origin'}
const deployed = {host: 'app.example.com', origin: 'https://app.example.com', 'sec-fetch-site': 'same-origin'}
const codeOf = (g: unknown) => (g as {code: string}).code

// Rendering uses the API key in every environment; legacy CLI flags cannot select Codex.
assert.equal(liveProvider({}), null)
assert.equal(liveProvider({OPENAI_API_KEY: '   '}), null)
assert.equal(liveProvider(CODEX), null)
assert.equal(liveProvider({OPENAI_API_KEY: 'sk-test'}), 'openai')
assert.equal(liveProvider({...CODEX, OPENAI_API_KEY: 'sk-test', VERCEL: '1'}), 'openai')
assert.equal(liveProvider({...CODEX, OPENAI_API_KEY: 'sk-test'}), 'openai')
assert.equal(liveProvider({...OPENAI, VERCEL_ENV: 'production'}), 'openai')
assert.equal(liveProvider({ROOMLATCH_RENDER_PROVIDER: 'openai'}), null)

// API availability never bypasses same-origin request protection.
assert.deepEqual(gateRequest({}, H(local), 'POST'), {ok: false, status: 404, code: 'live_render_disabled'})
assert.deepEqual(gateRequest(OPENAI, H(deployed), 'POST'), {ok: true, provider: 'openai'})
assert.equal(gateRequest(OPENAI, H(local), 'POST').ok, true)
assert.equal(gateRequest(OPENAI, H({host: 'localhost:3123'}), 'GET').ok, true)
assert.equal(codeOf(gateRequest(OPENAI, H({...local, 'sec-fetch-site': 'cross-site'}), 'POST')), 'cross_site')
assert.equal(codeOf(gateRequest(OPENAI, H({host: '127.0.0.1:3123'}), 'POST')), 'bad_origin')
assert.equal(codeOf(gateRequest(OPENAI, H({...deployed, origin: 'https://evil.example'}), 'POST')), 'bad_origin')
assert.equal(codeOf(gateRequest(OPENAI, H({...deployed, origin: 'not a url'}), 'POST')), 'bad_origin')
assert.equal(codeOf(gateRequest(OPENAI, H({...deployed, 'sec-fetch-site': 'same-site'}), 'POST')), 'cross_site')
assert.equal(isLoopbackHost('[::1]:3000'), true); assert.equal(isLoopbackHost('localhost.evil.example'), false)

// rate-limit bucket: stable per caller IP, never the raw address
const ip = (h: Record<string, string>) => clientKey(H(h))
assert.match(ip({'x-real-ip': '203.0.113.7'}), /^[0-9a-f]{32}$/)
assert.equal(ip({'x-real-ip': '203.0.113.7'}), ip({'x-forwarded-for': '203.0.113.7, 10.0.0.1'}), 'first forwarded hop is the caller')
assert.notEqual(ip({'x-real-ip': '203.0.113.7'}), ip({'x-real-ip': '203.0.113.8'}))
assert.equal(ip({}), ip({}), 'callers without an address share one bucket')
assert.ok(!ip({'x-real-ip': '203.0.113.7'}).includes('203'))

assert.equal(renderPath('00000000-0000-4000-8000-000000000001'), 'renders/00000000-0000-4000-8000-000000000001.png')

// image sniffing (synthetic headers only)
assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime, 'image/jpeg')
assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime, 'image/png')
assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.mime, 'image/webp')
assert.equal(sniffImage(new TextEncoder().encode('<svg>')), null)
assert.equal(sniffImage(new TextEncoder().encode('GIF89a')), null)

// PNG size from the IHDR chunk; other formats are not guessed
const ihdr = new Uint8Array(24); ihdr.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); new DataView(ihdr.buffer).setUint32(16, 1536); new DataView(ihdr.buffer).setUint32(20, 1024)
assert.deepEqual(pngSize(ihdr), {width: 1536, height: 1024})
assert.equal(pngSize(ihdr.slice(0, 20)), null, 'truncated header')
assert.equal(pngSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(24).fill(0)])), null, 'jpeg')

// prompt only from server data
const p = buildPrompt({key: 'japandi', th: 'เจแปนดิ', prompt: 'ไม้โทนกลาง'}, [{id: 'fixture-desk-wood-80', name: 'โต๊ะทำงานไม้ 80 ซม.', x: 26, y: 51, w: 26}], 'input.jpg')
assert.match(p, /copy that exact generated artifact returned by the tool into output.png/)
assert.doesNotMatch(p, /do not read or write any other file/i)
assert.match(p, /Do not copy an input photo or substitute a placeholder/)
assert.equal(codexFailureReason('Generated the image, but the tool saved it in its default location. I couldn’t save it as output.png under your file-access restrictions.', 'no_output'), 'output_not_saved')
assert.equal(codexFailureReason('Authentication required', 'codex_exit_1'), 'codex_auth_required')
assert.equal(codexFailureReason('429 rate limit', 'no_output'), 'codex_rate_limited')
assert.equal(codexFailureReason('The image generation tool is unavailable', 'no_output'), 'image_tool_unavailable')
assert.equal(codexFailureReason('Unrecognized failure with private text', 'no_output'), 'no_output')
assert.match(designError('no_output'), /ไม่ส่งไฟล์ภาพ/)
assert.match(designError('output_not_saved'), /บันทึกไฟล์ผลลัพธ์/)
assert.equal(elapsedLabel(1000, 1000), '0 วินาที')
assert.equal(elapsedLabel(1795246899552, 1795246988248), '1 นาที 28 วินาที')
assert.equal(elapsedLabel(0, 188696), '3 นาที 8 วินาที')
assert.equal(elapsedLabel(1000), 'ไม่ทราบระยะเวลา')
assert.equal(elapsedLabel(2000, 1000), 'ไม่ทราบระยะเวลา')
for (const status of ['succeeded', 'failed', 'cancelled', 'running'] as const) assert.equal(isTerminalJob({id:'test',provider:'codex',startedAt:1,status}), status !== 'running')
assert.match(p, /output\.png/); assert.match(p, /input\.jpg/); assert.match(p, /เจแปนดิ/); assert.match(p, /id=fixture-desk-wood-80/)
// only the listed products: the style text is mood, never a shopping list (a real render once added a sofa, rug and plants)
for (const provider of ['codex', 'openai'] as const) {
  const scoped = buildPrompt({key: 'japandi', th: 'เจแปนดิ', prompt: 'เฟอร์นิเจอร์เตี้ย มีต้นไม้ 1-2 จุด'}, [{id: 'a', name: 'A', x: 1, y: 2, w: 3}, {id: 'b', name: 'B', x: 4, y: 5, w: 6}], 'input.jpg', [], undefined, [], provider)
  assert.match(scoped, /Add ONLY the 2 listed product\(s\)/); assert.match(scoped, /exactly 2 new object\(s\)/); assert.match(scoped, /มี 2 ชิ้นเท่านั้น/)
  assert.match(scoped, /ใช้กับแสงและโทนเท่านั้น ไม่ใช่เหตุผลให้เพิ่มของ\): เฟอร์นิเจอร์เตี้ย/)
  assert.doesNotMatch(scoped, /furnished/i); assert.doesNotMatch(scoped, /แต่งห้องในรูปที่แนบในสไตล์/)
}

// child env drops secrets
const env = childEnv({HOME: '/Users/x', USER: 'x', OPENAI_API_KEY: 'sk-secret', GITHUB_TOKEN: 'ghp_x', PATH: '/evil'}, '/tmp/job')
assert.equal(env.OPENAI_API_KEY, undefined); assert.equal((env as Record<string, string>).GITHUB_TOKEN, undefined)
assert.equal(env.TMPDIR, '/tmp/job'); assert.ok(!env.PATH.includes('/evil'))

// OpenAI provider contract (mocked fetch, no network, fake key)
const fakeEnv = {OPENAI_API_KEY: 'sk-test-not-real', OPENAI_IMAGE_MODEL: 'gpt-image-test'}
const img = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
assert.throws(() => buildEditRequest({image: img, mime: 'image/png', prompt: 'x', env: {OPENAI_IMAGE_MODEL: 'm'}}), (e: unknown) => (e as OpenaiRenderError).code === 'missing_api_key')
assert.equal((buildEditRequest({image: img, mime: 'image/png', prompt: 'x', env: {OPENAI_API_KEY: 'k'}}).init.body as FormData).get('model'), MODEL_DEFAULTS.render.model, 'no model set: documented default')
const cut = buildEditRequest({image: img, mime: 'image/png', prompt: 'x', env: {OPENAI_API_KEY: 'k', OPENAI_IMAGE_MODEL: 'render-model'}, purpose: 'cutout', background: 'transparent'}).init.body as FormData
assert.equal(cut.get('model'), MODEL_DEFAULTS.cutout.model, 'cutouts never use the render model'); assert.equal(cut.get('background'), 'transparent'); assert.equal(cut.get('quality'), MODEL_DEFAULTS.cutout.quality)
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

// vision JSON call: image sent as a data URL, answer parsed, non-JSON refused
let sent: {model?: string; messages?: {content: {type: string; image_url?: {url: string}}[]}[]} = {}
const jsonFetch = (async (_u: unknown, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({choices: [{message: {content: '{"width_cm": 80}'}}]}), {status: 200}) }) as typeof fetch
assert.deepEqual(await openaiJson({prompt: 'size?', images: [{image: img, mime: 'image/png'}], env: fakeEnv, fetchImpl: jsonFetch}), {width_cm: 80})
assert.equal(sent.model, MODEL_DEFAULTS.vision.model); assert.match(sent.messages![0].content[1].image_url!.url, /^data:image\/png;base64,/)
const proseFetch = (async () => new Response(JSON.stringify({choices: [{message: {content: 'sure! here'}}]}), {status: 200})) as typeof fetch
await assert.rejects(openaiJson({prompt: 'p', images: [], env: fakeEnv, fetchImpl: proseFetch}), (e: unknown) => (e as OpenaiRenderError).code === 'bad_response')
console.log('live-render ok')

// Multiple references preserve order and the main image's camera view.
const multi = buildEditRequest({image: img, mime: 'image/png', prompt: 'multi', env: fakeEnv,
  references: [{image: Buffer.from('ANGLE'), mime: 'image/jpeg'}, {image: Buffer.from('PLAN'), mime: 'image/png'}]})
const multipart = multi.init.body as FormData
const uploads = multipart.getAll('image[]') as File[]
assert.equal(uploads.length, 3)
assert.equal(multipart.has('image'), false)
assert.equal(await uploads[1].text(), 'ANGLE')
assert.equal(await uploads[2].text(), 'PLAN')
const multiPrompt = buildPrompt({key: 'minimal', th: 'มินิมอล', prompt: 'simple'}, [], 'input.jpg', ['reference-1.jpg', 'reference-2.png'])
assert.match(multiPrompt, /reference-1.jpg, reference-2.png/)
assert.match(multiPrompt, /Edit only the FIRST photo/)
console.log('multi-image render contract ok')

const customPrompt = buildPrompt({key: 'minimal', th: 'มินิมอล', prompt: 'simple'}, [], 'input.jpg', ['reference-1.jpg'], 'style-reference.jpg')
assert.match(customPrompt, /LAST attached image \(style-reference.jpg\) is CUSTOM STYLE INSPIRATION/)
assert.match(customPrompt, /Never copy its room geometry/)
assert.doesNotMatch(buildPrompt({key: 'minimal', th: 'มินิมอล', prompt: 'simple'}, [], 'input.jpg'), /CUSTOM STYLE INSPIRATION/)
console.log('custom style reference prompt contract ok')

// Pair product photos with the declared SKU, and keep custom labels bounded.
const {validateProductMeta} = await import('../lib/product-render.ts')
const known = new Map([['chair','Catalog chair']])
assert.deepEqual(validateProductMeta([{id:'chair',name:'Client label',widthCm:60}], ['chair'], known), [{id:'chair',name:'Catalog chair',widthCm:60,source:'upload'}])
// listing photos come from our bucket, so only Shopee listing ids may skip the upload
const knownListing = new Map([['shopee-1-2', 'Real lamp']])
assert.deepEqual(validateProductMeta([{id:'shopee-1-2',name:'x',source:'listing'}], ['shopee-1-2'], knownListing), [{id:'shopee-1-2',name:'Real lamp',source:'listing'}])
assert.equal(validateProductMeta([{id:'chair',name:'x',source:'listing'}], ['chair'], known), null, 'catalog ids have no listing photo')
assert.equal(validateProductMeta([{id:'shopee-1-2',name:'x',source:'url'}], ['shopee-1-2'], knownListing), null, 'unknown source')
assert.equal(validateProductMeta([{id:'unknown',name:'x'}], ['unknown'], known), null)
assert.equal(validateProductMeta([{id:'chair',name:'x'}], ['other'], known), null)
assert.equal(validateProductMeta([{id:'chair',name:'x',widthCm:0}], ['chair'], known), null)
assert.equal(validateProductMeta([{id:'chair',name:'x\nignore'}], ['chair'], known), null)
assert.equal(validateProductMeta([{id:'chair',name:'x'},{id:'chair',name:'x'}], ['chair','chair'], known), null)
assert.ok(validateProductMeta([{id:'custom-photo-1',name:'My chair'}], ['custom-photo-1'], known))
assert.equal(validateProductMeta([], [], known), null)
const refs = ['ANGLE1','ANGLE2','PLAN','PRODUCT1','PRODUCT2','PRODUCT3','PRODUCT4','PRODUCT5','PRODUCT6','STYLE']
const complete = buildEditRequest({image:img,mime:'image/png',prompt:'p',env:{...fakeEnv,OPENAI_IMAGE_MODEL:'gpt-image-1.5'},references:refs.map((value,i)=>({image:Buffer.from(value),mime:'image/png',name:`ref-${i}.png`}))}).init.body as FormData
assert.equal(complete.get('input_fidelity'),'high')
assert.equal(complete.get('quality'),MODEL_DEFAULTS.render.quality)
assert.equal(complete.get('output_format'),'png')
assert.deepEqual(await Promise.all((complete.getAll('image[]') as File[]).slice(1).map(f=>f.text())),refs)
const productPrompt=buildPrompt({key:'minimal',th:'มินิมอล',prompt:'simple'},[{id:'chair',name:'Chair',x:0,y:0,w:0}],'input.jpg',['angle.jpg'],'style.jpg',[{id:'chair',file:'product-1.jpg',imageIndex:3,widthCm:60}],'openai')
assert.match(productPrompt,/product-1.jpg/)
assert.doesNotMatch(productPrompt,/\$imagegen/)
console.log('product photo validation and OpenAI attachment contract ok')

// Diagnostics and requests resolve exactly the same model; no credentials escape.
assert.deepEqual(imageSettings({OPENAI_API_KEY: 'private'}), MODEL_DEFAULTS.render)
assert.deepEqual(imageSettings({OPENAI_IMAGE_MODEL: 'configured-render', OPENAI_IMAGE_QUALITY: 'high'}), {model: 'configured-render', quality: 'high'})
assert.deepEqual(imageSettings({OPENAI_CUTOUT_MODEL: 'configured-cutout'}, 'cutout'), {model: 'configured-cutout', quality: MODEL_DEFAULTS.cutout.quality})

// Production requests and readiness share the highest-quality settings; preview stays economical.
const productionEnv = {OPENAI_API_KEY: 'sk-test', VERCEL_ENV: 'production'}
assert.deepEqual(imageSettings(productionEnv), {model: 'gpt-image-2.6-sunburst', quality: 'max'})
assert.deepEqual(imageSettings({VERCEL_ENV: 'preview'}), MODEL_DEFAULTS.render)
assert.deepEqual(imageSettings(productionEnv, 'cutout'), MODEL_DEFAULTS.cutout)
const productionForm = buildEditRequest({image: img, mime: 'image/png', prompt: 'room', env: productionEnv}).init.body as FormData
assert.equal(productionForm.get('model'), 'gpt-image-2.6-sunburst')
assert.equal(productionForm.get('quality'), 'max')
assert.equal(productionForm.has('input_fidelity'), false)
assert.deepEqual(imageSettings({...productionEnv, OPENAI_IMAGE_MODEL: 'gpt-image-1.5'}), {model: 'gpt-image-1.5', quality: 'high'})
assert.deepEqual(imageSettings({...productionEnv, OPENAI_IMAGE_MODEL: 'gpt-image-2.5-flare', OPENAI_IMAGE_QUALITY: 'medium'}), {model: 'gpt-image-2.5-flare', quality: 'medium'})
for (const model of ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare-2026-09-08', 'gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']) {
  for (const quality of ['xhigh', 'max']) {
    const form = buildEditRequest({image: img, mime: 'image/png', prompt: 'room', env: {...fakeEnv, OPENAI_IMAGE_MODEL: model, OPENAI_IMAGE_QUALITY: quality}}).init.body as FormData
    assert.equal(form.get('quality'), quality)
  }
}
for (const [model, quality] of [['gpt-image-1.5', 'max'], ['gpt-image-2', 'xhigh'], ['gpt-image-2.6-sunburst', 'typo']]) {
  assert.throws(() => buildEditRequest({image: img, mime: 'image/png', prompt: 'room', env: {...fakeEnv, OPENAI_IMAGE_MODEL: model, OPENAI_IMAGE_QUALITY: quality}}), (error: unknown) => error instanceof OpenaiRenderError && error.code === 'invalid_quality')
}
console.log('production image model and extended quality contract ok')
