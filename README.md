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
| `live-render.ts` | ทางเข้าเดียวของ render job ผ่าน OpenAI API |
| `live-render-codex.ts` | โค้ด legacy ไม่ถูกเรียกจากเส้นทางสร้างภาพปัจจุบัน |
| `live-render-openai.ts` | OpenAI API ทั้ง local และ production, job อยู่ใน Postgres, รูปผลลัพธ์อยู่ใน Object Storage |
| `render-pipeline.ts`, `render-pipeline-core.ts` | pipeline ความแม่นของสินค้า: ตัดสินค้า → ขนาดจริง → วางตามสเกล → gen (core เป็น pure, มี test) |
| `recommend.ts`, `recommend-core.ts` | ขั้นเลือกสินค้า: AI เลือกสินค้าจริงจาก DB ให้ลงงบ (core เป็น pure, มี test) |
| `render-jobs.ts` | table `render_jobs`: สถานะ job + daily limit (มี test กับ Postgres จริง) |
| `openai-render.ts` | เรียก OpenAI Images Edits API |

## สร้างภาพด้วย OpenAI API

ตั้ง `OPENAI_API_KEY` บนเซิร์ฟเวอร์เพื่อเปิดสร้างภาพ ทั้ง local และ production ใช้ OpenAI Images API โดยตรง ไม่เรียก Codex CLI และไม่ใช้ค่า `ROOMLATCH_RENDER_PROVIDER` แบบเก่า ตัวเลือกโมเดลอยู่ใน `OPENAI_IMAGE_MODEL` และ `OPENAI_IMAGE_QUALITY`

Flow: `POST /api/render/live` (multipart: รูปห้อง 1–4, รูปสินค้า ≤6, รูปสไตล์ ≤1, ต้องมี `consent=yes`) → poll `GET /api/render/live/[id]` → `GET /api/render/live/[id]/image`

### เลือกสินค้าให้ลงงบ (`POST /api/recommend`)

หน้า result โหลดชุดสินค้าจริงให้อัตโนมัติจากสไตล์ ประเภทห้อง งบ ความกว้าง และ "ความต้องการหลัก" ที่ผู้ใช้พิมพ์ในหน้าเลือกสไตล์ (`lib/recommend.ts`):

1. ดึง listing ของสไตล์นั้นจาก Postgres ที่มีราคา ราคาไม่เกินงบ และมีรูปให้ render ได้ เอาหมวดละ 30 ชิ้นที่เรตติ้งดีสุด
2. decision model เลือก 2–6 ชิ้น ชิ้นละหนึ่งบทบาท พร้อมเหตุผลภาษาไทย
3. server รวมราคาจาก DB เอง ไม่เชื่อตัวเลขจาก model ถ้าเกินงบจะให้เลือกใหม่ 1 ครั้ง ถ้ายังเกินจะตัดชิ้นแพงสุดออกจนลงงบ
4. ไม่มี `OPENAI_API_KEY` หรือ model ล้มเหลว: ใช้กฎแทน (แบ่งงบตามบทบาท เลือกเรตติ้งดีสุดที่ใกล้สัดส่วน) และบอกผู้ใช้ว่าไม่ได้ใช้ AI

ปุ่ม "ใช้ชุดนี้สร้างภาพในห้องของฉัน" ส่งทั้งชุดเข้า render panel โดยไม่ต้องแนบรูป ผลของแต่ละแผนเก็บไว้ในแท็บ จึงไม่เรียก model ซ้ำเมื่อกลับมาหน้าเดิม

ข้อจำกัด: listing ไม่มีขนาดสินค้า ความกว้างจึงเป็นแค่คำแนะนำให้ model ไม่ได้บังคับ ราคาเป็นราคาวันที่เก็บข้อมูล ไม่รวมค่าส่ง endpoint นี้กันได้แค่ same-origin ยังไม่มี rate limit (ราว $0.01 ต่อครั้ง)

### Pipeline ความแม่นของสินค้า (`openai`)

เป้าหมายคือสินค้าในภาพต้องหน้าตา สี และ**ขนาด**ตรงของจริงบน Shopee มากที่สุด จึงไม่ให้ image model วาดสินค้าเองจากรูป listing ตรง ๆ (`lib/render-pipeline.ts`):

1. **รูปสินค้า**: listing ใน DB ใช้รูปที่ copy ไว้ใน bucket (`listings/<shop>-<item>/original.*`) ถ้ายังไม่มีจึงดึงจาก CDN ของ Shopee เท่านั้น สินค้าที่ผู้ใช้แนบรูปเองใช้รูปนั้น
2. **ตัดสินค้า**: image model แยกสินค้าชิ้นเดียวบนพื้นหลังโปร่งใส ตรวจว่ามี transparency จริง แล้ว cache ที่ `listings/<shop>-<item>/cutout.png` ตัดครั้งเดียวต่อสินค้า
3. **ขนาดจริง (ซม.)**: vision model อ่านตามลำดับ ขนาดที่ยืนยันใน catalog → ตัวเลขในชื่อสินค้า → ตัวเลขในรูป → ขนาดทั่วไปของสินค้าชนิดนั้น cache ที่ `spec.json` พร้อมบอกว่ามาจากแหล่งไหน ความกว้างที่ผู้ใช้กรอกชนะเสมอ
4. **วางตำแหน่ง**: vision model ดูรูปห้อง (และมุมอื่น/แปลน) ใช้ความกว้างที่ผู้ใช้วัดเป็นตัวยึดสเกล เทียบกับของขนาดมาตรฐานในห้อง แล้วตอบตำแหน่งและขนาดที่ควรเห็นในรูปของแต่ละชิ้น
5. **แปะ**: `sharp` แปะ cutout ตามตำแหน่งและขนาดนั้น
6. **gen**: image model ปรับแค่มุมมอง แสง และเงา ห้ามย้าย ย่อ ขยาย หรือเปลี่ยนหน้าตาสินค้า

ทุกขั้นเป็น HTTP call ไป OpenAI, S3 และ `sharp` จึงรันบน Vercel ได้ ใช้เวลาราว 60 วินาทีเมื่อสินค้ายังไม่เคยถูกตัด และราว 40 วินาทีเมื่อ cache แล้ว (วัดในเครื่องกับสินค้า 3 ชิ้น) Codex (local) ยังใช้ prompt แบบเดิมโดยไม่ตัดหรือวางก่อน

ข้อจำกัด: listing ส่วนใหญ่ไม่มีขนาดจริงในชื่อหรือรูป จึงได้ขนาดทั่วไป (`typical`, low confidence) ถ้ารูปประกาศมีหลายสี ระบบเลือกชิ้นที่เด่นที่สุด ซึ่งอาจไม่ใช่สีที่ผู้ใช้จะสั่ง

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
| `POST /api/recommend` | สินค้าจริงที่ AI เลือกให้ลงงบ (ราคาจาก DB, fallback เป็นกฎเมื่อไม่มี key) |
| `GET /api/listings?style=` | ประกาศ Shopee จริงตามสไตล์จาก Postgres (ยังไม่มีหน้าไหนเรียก) |
| `POST /api/render` | mock ของขั้น loading: validate แล้วตอบ layout กลับ ไม่รับรูป ไม่สร้างภาพ |
| `POST /api/neon/health` | smoke test Postgres + Storage เรียกได้จาก loopback เท่านั้น |

## ข้อมูลที่ยังเป็นเดโม

- ชุดของ: ราคาเป็นช่วงประมาณจาก `catalog/products.csv`, ขนาดมาจาก `DEMO_SIZE` ใน `lib/plan.ts`, ของที่ชื่อลงท้าย `(fixture)` เป็นสินค้าสมมติ
- ไลก์ เซฟ draft และโพสต์ที่แชร์ เก็บใน localStorage ของเครื่องผู้ใช้ ยังไม่ผูกกับบัญชี (`/login` เป็นปุ่มตัวอย่าง)
- รูปสไตล์และรูปห้องตัวอย่างโหลดจาก Unsplash
- รูปประกาศของร้านค้าใน `public/listings/` ไม่อยู่ใน Git และโชว์เฉพาะเมื่อ `NEXT_PUBLIC_SHOW_LISTING_PHOTOS=1`
