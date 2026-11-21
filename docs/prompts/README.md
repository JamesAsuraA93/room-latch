# docs/prompts

แผนและทะเบียน prompt สำหรับภาพ "หลังแต่ง" ด้วย GPT Image (แบบ SKU-first) เอกสารเท่านั้น ยังไม่มีโค้ด

| ไฟล์ | คืออะไร |
|---|---|
| `gpt-image-plan.md` | แผน integration: pipeline, ความตรงของสินค้า (QA + fallback เป็นภาพวางของ), ops/safety, สิ่งที่ต้อง verify กับ docs ของ OpenAI |
| `registry.json` | ทะเบียน prompt: อ้างอิง prompt หลักใน `prompts/` (path + version), รายการสไตล์ 8 ตัว (เพิ่มได้ไม่จำกัด), template `sku_first_generate` |

## ความสัมพันธ์กับ `prompts/`

- `prompts/` ยังเป็นต้นฉบับ prompt หลัก (01 analyze, 02 generate, 03 extract) แก้ที่นั่นที่เดียว
- `registry.json` แค่อ้าง path + version ของไฟล์เหล่านั้น ถ้าแก้ไฟล์ต้นฉบับ ให้ bump version ใน registry ด้วย
- `styles[]` คัดลอกข้อความจาก `prompts/style-prompts.json` v1 key ต้องตรงกับ `STYLES` ใน `room-latch/lib/demo.ts` และคอลัมน์ styles ใน `catalog/products.csv`
- `sku_first_generate` เป็น template ใหม่ ต่อยอดจาก 02 ใช้เมื่อผู้ใช้ล็อกสินค้าและวางตำแหน่งแล้ว
- ตั้งชื่อรูปผลลัพธ์ตาม `prompts/README.md` แล้วให้คะแนนด้วย `rubric/rubric.md`

## Implemented: mock route

`POST /api/render` ใน `room-latch/app/api/render/route.ts` (logic ใน `room-latch/lib/render.ts`) ตอบผลแบบ mock เท่านั้น: ไม่เรียก OpenAI ไม่ใช้ key ไม่รับรูปผู้ใช้ (มีคีย์รูปหรือ `data:` URL = 400) ภาพหลังแต่งยังประกอบในเบราว์เซอร์ รายละเอียด contract ดู `gpt-image-plan.md` §9 ทดสอบ: `cd room-latch && node scripts/render.test.mts`
