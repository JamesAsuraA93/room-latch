# RoomLatch

แต่งมุมห้องให้ลงงบและลงขนาดจริง: รูปห้อง → สไตล์ → งบ/ความกว้าง → ชุดของที่ซื้อได้ + ภาพ "หลังแต่ง"

Next.js 16 (App Router) fullstack · Neon Postgres · Neon Object Storage (S3-compatible) · Tailwind 4

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local   # แล้วเติมค่า (หรือ `neon env pull`)
npm run dev
```

```bash
npm test        # unit tests, ไม่ใช้เน็ต (node scripts/*.test.mts)
npm run test:db # ทดสอบ render job store กับ Postgres จริง ใน transaction ที่ rollback เสมอ
npm run build
```

## โครงสร้าง

| Path | หน้าที่ |
|---|---|
| `app/` | หน้าเว็บ (`upload → style → setup → loading → result`, `saved`, `profile`, `login`) และ API routes ใน `app/api/` |
| `components/` | UI ของแอป, `components/ui/` คือ primitive (button, card, dialog, skeleton) |
| `lib/` | logic ทั้งหมด (ดูตารางถัดไป) |
| `catalog/` | CSV สินค้า: `products.csv` (ช่วงราคา) และ `shopee-real-*.csv` (ประกาศจริง) อ่านตอน runtime โดย `lib/catalog.ts` |
| `prompts/registry.json` | ข้อความ prompt ของแต่ละสไตล์ ใช้ตอนสร้างภาพ AI |
| `db/` | `schema.sql`, `seed.sql`, `migrations/`, `checks.sql` (ดู `db/README.md`) |
| `scripts/` | tests (`*.test.mts`), `export-db-seed.mts`, `gather-shopee.mts` |
| `neon.ts` | config ของ Neon CLI (bucket `assets`, branch policy) |

### `lib/`

| ไฟล์ | หน้าที่ |
|---|---|
| `styles.ts` | id ของสไตล์และประเภทห้อง **ที่เดียวทั้งแอป** |
| `copy.ts` | ชื่อแบรนด์และข้อความ UI ทั้งหมด |
| `plan.ts` | engine เลือกชุดของให้ลงงบ/ความกว้าง (pure, มี test) |
| `catalog.ts`, `real-catalog.ts`, `fixtures.ts`, `listings.ts` | โหลดและแปลงข้อมูลสินค้า |
| `demo.ts` และไฟล์ฝั่ง client อื่น | state ใน session/localStorage ของผู้ใช้ |
| `db.ts` | Postgres pool + queries (server only) |
| `storage.ts` | Object Storage ผ่าน AWS S3 client, ให้รูปด้วย presigned URL (server only) |
| `render.ts`, `product-render.ts` | validate input ของ render API (pure, มี test) |
| `live-render-core.ts` | เลือก provider, gate ของ request, สร้าง prompt (pure, มี test) |
| `live-render.ts` | ทางเข้าเดียวของ render job แล้วส่งต่อตาม provider |
| `live-render-codex.ts` | provider ฝั่ง local: Codex CLI, job อยู่ใน memory + temp dir |
| `live-render-openai.ts` | provider ฝั่ง production: OpenAI API, job อยู่ใน Postgres, รูปอยู่ใน Object Storage |
| `render-jobs.ts` | table `render_jobs`: สถานะ job + daily limit (มี test กับ Postgres จริง) |
| `openai-render.ts` | เรียก OpenAI Images Edits API |

## สร้างภาพด้วย AI: local ใช้ Codex CLI, production ใช้ OpenAI API

สวิตช์เดียวคือ `ROOMLATCH_RENDER_PROVIDER` ไม่ตั้ง = ปิดฟีเจอร์ (ปุ่มไม่โผล่, API ตอบ 404)

| ค่า | ใช้ที่ไหน | ทำงานอย่างไร |
|---|---|---|
| `codex` | เครื่อง dev | สั่ง Codex CLI ที่ล็อกอินไว้ในเครื่อง รับเฉพาะ request จาก loopback และถูกปิดเสมอบน Vercel |
| `openai` | production (ใช้ในเครื่องได้ด้วย) | เรียก OpenAI Images API ด้วย `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` |

ทั้งสอง provider ใช้ API, prompt และ validation ชุดเดียวกัน (`lib/live-render.ts`) ไม่มี fallback ข้าม provider

Flow: `POST /api/render/live` (multipart: รูปห้อง 1–4, รูปสินค้า ≤6, รูปสไตล์ ≤1, ต้องมี `consent=yes`) → poll `GET /api/render/live/[id]` → `GET /api/render/live/[id]/image`

### Production (`openai`)

ก่อนเปิดใช้ต้องสร้าง table ครั้งเดียว: `psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f db/migrations/002-render-jobs.sql`

- สถานะ job อยู่ใน Postgres (`render_jobs`) และรูปผลลัพธ์อยู่ใน bucket ที่ `renders/<job id>.png` instance ไหนก็ตอบ poll ได้
- รูปที่ผู้ใช้อัปโหลดไม่ถูกเก็บ ส่งให้ OpenAI แล้วทิ้ง ส่วน job และรูปผลลัพธ์ถูกลบหลัง 24 ชั่วโมง
- จำกัดการใช้ต่อ 24 ชั่วโมง: `ROOMLATCH_RENDER_DAILY_LIMIT` ต่อผู้ใช้ (นับตาม IP, ค่าเริ่มต้น 5) และ `ROOMLATCH_RENDER_DAILY_CAP` ทั้งระบบ (ค่าเริ่มต้น 100 คือเพดานค่าใช้จ่าย) job ที่ล้มเหลวไม่ถูกนับ
- ผู้ใช้หนึ่งคนสร้างได้ทีละ 1 job

ยังไม่มี auth: limit ต่อผู้ใช้นับจาก IP จึงเลี่ยงได้ด้วยการเปลี่ยน IP ตัวที่กันค่าใช้จ่ายจริงคือเพดานทั้งระบบ

`scripts/gather-shopee.mts` (หา listing จาก Shopee แล้วให้ Codex CLI ตัดสินใจ keep/หมวด/สไตล์) เป็นงาน local เท่านั้น:
`node --env-file=.env.local scripts/gather-shopee.mts` (`--dry` ไม่เขียน DB, `--self-test` ไม่ใช้เน็ต)

## API อื่น

| Route | หน้าที่ |
|---|---|
| `GET /api/feed` | โพสต์ที่ publish แล้วจาก Postgres |
| `GET /api/designs/[id]/before\|after` | redirect ไป presigned URL ของรูปใน bucket (เฉพาะ design ที่ publish) |
| `GET /api/listings?style=` | ประกาศ Shopee จริงตามสไตล์จาก Postgres (ยังไม่มีหน้าไหนเรียก) |
| `POST /api/render` | mock ของขั้น loading: validate แล้วตอบ layout กลับ ไม่รับรูป ไม่สร้างภาพ |
| `POST /api/neon/health` | smoke test Postgres + Storage เรียกได้จาก loopback เท่านั้น |

## ข้อมูลที่ยังเป็นเดโม

- ชุดของ: ราคาเป็นช่วงประมาณจาก `catalog/products.csv`, ขนาดมาจาก `DEMO_SIZE` ใน `lib/plan.ts`, ของที่ชื่อลงท้าย `(fixture)` เป็นสินค้าสมมติ
- ไลก์ เซฟ draft และโพสต์ที่แชร์ เก็บใน localStorage ของเครื่องผู้ใช้ ยังไม่ผูกกับบัญชี (`/login` เป็นปุ่มตัวอย่าง)
- รูปสไตล์และรูปห้องตัวอย่างโหลดจาก Unsplash
- รูปประกาศของร้านค้าใน `public/listings/` ไม่อยู่ใน Git และโชว์เฉพาะเมื่อ `NEXT_PUBLIC_SHOW_LISTING_PHOTOS=1`
