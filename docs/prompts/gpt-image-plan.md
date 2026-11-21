# GPT Image "After" plan (SKU-first)

Status: plan only. No code, no key, no API calls made. Items marked **verify** were not confirmed in the OpenAI docs and must be checked before coding.

Sources read on 2026-11-21:
- Image generation guide: https://developers.openai.com/api/docs/guides/image-generation (G)
- API quickstart: https://developers.openai.com/api/docs/quickstart (Q)
- Pricing page linked from G, not opened: https://developers.openai.com/api/docs/pricing#image-generation

## 1. What exists today (no API)

- User picks/locks products: `Placement.locked: Product[]` (catalog, `room-latch/lib/plan.ts`) plus `EXACT_LISTINGS` (`room-latch/lib/listings.ts`, real listing photo + link, `priceTHB`/`widthCm` = null).
- User places them: `Placement.pos[id] = Pos {x, y, w}` as percentages of the room frame (`room-latch/lib/demo.ts`).
- After = user room photo + product images laid on top at `Pos`, with listings clipped by `cutout` (`room-latch/components/room-compare.tsx`). Hit-boxes, links and price labels all come from our data. Nothing leaves the tab.

This deterministic composite stays the default and the fallback. GPT Image adds one optional "harmonize" pass on top.

## 2. Pipeline

```
lock items + place (Pos) ──► deterministic composite (client, today)
        │
        ▼  user taps "ทำให้ภาพสมจริง" + explicit consent sheet (photo leaves device)
POST /api/after (server route)
  inputs: room photo (resized, long edge ≤1600px as prompts/02 says)
          + product reference images we have rights to use (see §6)
          + bboxes from Pos (converted to px of the sent image)
          + style block (registry.json styles[key])
          + prompt = registry.json templates.sku_first_generate
  ► idempotency check (hash) ► quota/cap check ► OpenAI image edit, n=1
  ◄ one harmonized image (lighting, shadows, perspective)
        │
        ▼
QA step (§3) ─ fail ─► show deterministic composite, tell user "ใช้ภาพวางของแทน"
        │ pass
        ▼
client renders generated image + overlays item ids, links, price labels, hit-boxes
from OUR data (catalog/listings + Pos). Never from model output.
```

Rules:
- The model never decides prices, URLs, item names or which items exist. Prompt 03 (extract) is not used in the SKU-first path; the item list is already known.
- Hit-boxes stay at the user's `Pos`. If the model moved an item, QA flags it (§3) rather than moving the box to where the model put it.
- Endpoint: Image API Edits `/v1/images/edits` takes multiple images in `image` (G). The Responses API `image_generation` tool is the alternative (G); pick one in a spike, **verify**.
- Masks are guidance only: G says "Masking with GPT Image is entirely prompt-based" and the mask is applied to the first image. Edges are not guaranteed. If a mask is used: same format and size as the image, alpha channel, < 50MB (G).

## 3. Exact-SKU fidelity

Model output can drift from the SKU (shape, colour, proportion, extra items). G lists "difficulty placing elements precisely" in layout-sensitive compositions as a limitation.

- When exact match matters (exact listings, anything with a buy link to a specific product): use the deterministic cutout/overlay composite. Optionally use the generated image only for room lighting and paste the exact cutouts back on top (composite-after-generate).
- QA step on every generated image, before showing:
  1. Per item: crop the bbox from output, compare to the reference (perceptual hash / colour histogram / embedding similarity; method **verify** in spike). Below threshold → flag item.
  2. Room structure: compare output vs original outside all bboxes (edge map / SSIM). Large change → fail (maps to rubric dim 1).
  3. Any flag → show composite instead, or show generated image with a "ภาพจำลอง สินค้าจริงอาจต่างจากภาพ" label and the item's own listing photo in its card.
- Log QA scores per prompt version so prompt changes are measured.

## 4. Style registry

- `docs/prompts/registry.json` `styles[]` starts with the 8 UI ids: `minimal, muji, japandi, scandi, loft, luxe, boho, nordic` (must match `STYLES` in `room-latch/lib/demo.ts` and the `styles` column in `catalog/products.csv`). Adding a style = add one entry; code should iterate the registry, not hardcode 8.
- n=1 output per selected style (`n` default is one image, G). No multi-style fan-out by default.
- Regenerate / change item: first rebuild the deterministic composite (free). Only call the API again when the user asks for the realistic pass again, and only if the idempotency key changed.

## 5. Ops and safety

| Concern | Plan |
|---|---|
| API key | Server-side env only, `OPENAI_API_KEY` (the SDK reads this name, Q). Never in client code, never committed. Model id from env, e.g. `OPENAI_IMAGE_MODEL` (already the convention in `prompts/README.md`). |
| Consent | Explicit opt-in sheet before upload, per session. Default path never uploads. |
| Quota | Per user (anonymous id) per day, e.g. 3 realistic passes. Number is a product choice. |
| Rate limit | Per IP + per user on `/api/after`. Also respect OpenAI rate limits, **verify** tier limits. |
| Idempotency | key = sha256(room photo bytes + sorted item ids + Pos + style key + prompt version). Same key → return cached result, no API call. |
| Cost cap | Server-side monthly budget counter; stop at cap. Also set budget alarm in OpenAI dashboard (task 3 in sheet). Measure cost per run (task 14). |
| Retention | Room photo + generated image: memory only or private storage with short TTL (e.g. 24h), delete on user request, never used in feed unless user shares. **Verify** OpenAI's own API data retention policy (not stated in G). |
| Fallback / mock | Key missing, cap hit, quota hit, moderation block, timeout, QA fail → return deterministic composite. Same UI, no error wall. |
| Logging | Log hash key, item ids, style, prompt version, latency, QA scores, cost estimate, error code. No images, no base64, no EXIF, no IP in plain text. |
| Abuse/safety | G recommends a hashed `safety_identifier` (≤128 chars) per end user; `user` is deprecated. Moderation blocks return `error.code = "moderation_blocked"` (G). |
| Org setup | G says API Organization Verification may be needed for GPT Image models. |
| Latency | G: complex prompts "may take up to 2 minutes". Show progress; keep composite visible meanwhile. |

Prompt versioning tied to rubric: each template in `registry.json` has a `version`. Generated samples follow `samples/generated/<source>__<style>__v<version>.jpg` (from `prompts/README.md`), scored with `rubric/rubric.md`; dim 1 pass = ≥4 on ≥15 of 20 photos before shipping a new version.

Note: Codex is a coding assistant used to write this integration. It is not the runtime image endpoint; runtime calls go to the OpenAI Image API from our server route.

## 6. Image rights

- Room photo: user's own, sent only after opt-in.
- Catalog `Product` images in the app today are demo stand-ins (`demoProductImage`), not the real product. Do not send them as "exact" references.
- `EXACT_LISTINGS` photos come from Shopee seller CDN. Using them as model input needs a rights check (seller/platform terms). Until cleared, use them only in the client composite, not in API calls. **Open question.**
- User-uploaded product photos (`Placement.photos`): include in consent text.

## 7. Facts read in G (cite before using)

- Models named on page: `gpt-image-2`, GPT-Image-2.5 / 2.6 "Sunburst" and "Flare" variants (example ids `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`). Read through an automated page summary, so **verify exact ids** on the page/models list before coding.
- Recommended sizes `1024x1024`, `1536x1024`, `1024x1536`; custom sizes on Sunburst/Flare: multiples of 16, ratio 1:3 to 3:1, 655,360 to 8,294,400 total px, edge ≤3840.
- `quality`: Sunburst/Flare `low|medium|high|xhigh|max|auto`; `gpt-image-2` `low|medium|high|auto`.
- `input_fidelity`: omit for `gpt-image-2` (always high fidelity). Other models **verify**.
- `output_format` png (default) / jpeg / webp; `output_compression` 0-100 for jpeg/webp.
- `moderation` `auto` (default) / `low`.
- Mask: same format and size as image, <50MB, alpha channel, applied to first image, prompt-based.
- Pricing on G (GPT-Image-2.5): $8 / 1M image input tokens, $30 / 1M image output tokens, $5 / 1M text input tokens. Per-image token counts for Sunburst/Flare not stated; check pricing page.

## 8. Open questions / verify

1. Exact model ids and which one supports multi-image edit best for furniture fidelity.
2. Max number of input images per edit (not stated in G; examples use 4). Our item count can exceed that, so we may need to cap items per pass.
3. Accepted input formats and per-image size limit for non-mask inputs (only the mask/image 50MB rule was stated).
4. Whether `size` can match the room photo's aspect ratio closely enough (prompts/02 needs same ratio; custom sizes need multiples of 16).
5. Real cost per run at our size/quality (use pricing page calculator), to set quota and cap.
6. OpenAI data retention / zero-retention options for uploaded images.
7. Rights to send Shopee listing photos to a third-party model (§6).
8. QA method and thresholds (spike on the 20 sample rooms).

## 9. Implemented: mock route (2026-11-21)

`POST /api/render` (`room-latch/app/api/render/route.ts`, logic in `room-latch/lib/render.ts`, tests `room-latch/scripts/render.test.mts`). No OpenAI call, no key, no `process.env`.

- Body (JSON, ≤16 KB): `{styleId, roomType, budget, width, items: [{id, x, y, w}]}`. Strict: unknown keys rejected; photo-like keys or any `data:` string anywhere → 400 `photo_not_accepted`. The route never receives a photo.
- Errors: `{error: {code, message}}` with `unsupported_style`, `invalid_room_type`, `invalid_number`, `invalid_items`, `unknown_field`, `photo_not_accepted`, `bad_json` (400), 413 too large, 415 wrong content-type, 405 non-POST.
- 200: `{status: "completed", provider: "mock", jobId, promptVersion: "v1", styleId, after: {type: "client-composite", image: null, note}, layout: [{id, bbox}], createdAt}`. `jobId` = sha256 of canonical validated input + prompt version, i.e. the idempotency key from §5 minus photo bytes (add them when a real upload path exists).
- `Cache-Control: no-store`; request bodies are not logged.
- Still to do before a real provider: everything in §5 (auth, consent, quota, rate limit, cost cap, retention) and §8.
