# RoomLatch UI (demo)

## Server storage configuration

Copy `.env.example` to `.env.local` and fill in the server credentials. Next.js loads
`.env.local` automatically; keep it out of Git. `DATABASE_URL` is reserved for the
database integration (the app still stores its current user state in the browser).

`lib/storage.ts` provides server-only `uploadObject(key, body, contentType)` and
`getObjectUrl(key, expiresIn)` helpers for the S3-compatible endpoint. The default
bucket is `assets`, and signed download URLs expire after one hour by default.
Import these helpers only in server code. The upload UI is not yet connected to
this storage. Standalone scripts using dotenv must explicitly load `.env.local`
(dotenv's default filename is `.env`).

```bash
npm install
npm test        # engine งบ/ขนาด (node scripts/plan.test.mts)
npm run build
npm run start -- -H 127.0.0.1 -p 3123   # http://127.0.0.1:3123 (เฉพาะเครื่องนี้)
```

ชื่อแบรนด์ tagline และโลโก้อยู่ที่ `lib/copy.ts` (`BRAND`) กับ `public/logo.svg` ที่เดียว ข้อความ UI ภาษาไทยทั้งหมดอยู่ใน `lib/copy.ts` สี CI อยู่ใน `app/globals.css`

## Flow (ไม่ต้องล็อกอิน)

รูปห้อง (ของตัวเองหรือรูปตัวอย่าง) → สไตล์ → ประเภทห้อง งบ ความกว้างมุม → ผลลัพธ์:

- **ก่อน/หลัง (ผลหลัก, `components/room-compare.tsx`):** กรอบเดียว สลับด้วยปุ่มหรือปัด "หลัง" = รูปห้องเดิม + รูปสินค้าที่จัดวาง ไม่มีหมุด/กรอบ ปุ่ม "ดูของที่เพิ่ม" ทำให้ของมีขอบเรืองช้าๆ 3 รอบ (reduced-motion = ขอบนิ่ง) แตะ/โฟกัส/hover ของเพื่อเปิดการ์ด
- ลิงก์ในการ์ด: ประกาศที่ยืนยันแล้ว (`lib/listings.ts`) > ลิงก์ที่ผู้ใช้วางเอง > ค้นหา Shopee (เฉพาะชิ้นที่เป็นภาพ demo) ถ้าผู้ใช้ใส่รูปเองแต่ไม่มีลิงก์ยืนยัน จะไม่ใส่ลิงก์
- **โหมดแก้ไข (`components/placement.tsx`):** ลาก/ปรับขนาด/รีเซ็ต/ใส่รูปจาก listing ซ่อนไว้จนกดปุ่ม "แก้ไขการจัดวาง"
- **ชุดของ:** `lib/plan.ts` เลือกจาก `catalog/products.csv` ให้งบรวม (คิดจาก price_max) และความกว้างของที่วางพื้นไม่เกินค่าที่กรอก แก้งบ/ขนาดแล้วบอกว่าเปลี่ยนอะไรเพราะอะไร ไม่มีชุดลงตัวมีหน้า no-fit
- **Product first:** วางลิงก์ listing Shopee + กรอกราคา/ขนาดที่เห็น ระบบล็อกชิ้นนั้นแล้วเลือกของที่เหลือให้ลงงบ/มุมที่เหลือ
- "หลัง" เป็นการวางรูปซ้อนในเบราว์เซอร์ ไม่ใช่ AI render
- ฟีด ไลก์ เซฟ Remix แชร์ draft โปรไฟล์ อยู่ใน localStorage เครื่องนี้ทั้งหมด

## สิ่งที่ยังไม่จริง

- ไม่มี AI สร้างรูป ไม่มี backend/auth/Shopee API
- ขนาดสินค้าใน `DEMO_SIZE` เป็น demo fixture ราคาเป็นช่วงประมาณจาก catalog ลิงก์ไปหน้าค้นหา Shopee ไม่ใช่สต็อกจริง
- ประกาศจริง 1 ชิ้น (`lib/listings.ts`): โคมไฟหนีบ LED USB ยืนยันแค่รูปประกาศ (เก็บไว้ที่ `public/listings/`) กับลิงก์ประกาศ ราคา ขนาด ตัวเลือก สต็อก ยังไม่ยืนยัน จึงไม่นับในงบ/ความกว้าง รายละเอียดใน `catalog/shopee-listings.json`
- รูปตัวอย่าง/ฟีดโหลดจาก Unsplash ต้องมีเน็ต
# room-latch
