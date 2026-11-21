// ประกาศ Shopee ที่ทีมจับคู่รูปกับประกาศเองแล้ว ยืนยันแค่ "รูปนี้มาจากประกาศนี้"
// ราคา ขนาด ตัวเลือก (variant) และสต็อก ยังไม่ทราบ จึงเป็น null และไม่ถูกนับในงบหรือความกว้าง
// วิธีเพิ่ม: เปิดประกาศในเบราว์เซอร์ปกติ ดาวน์โหลดรูปประกาศ (public CDN) ไว้ที่ room-latch/public/listings/ แล้วเพิ่มแถวที่นี่
export type ExactListing = {
  id: string
  title: string
  url: string // ลิงก์ประกาศ (ไม่ใช่หน้าค้นหา)
  image: string | null // รูปประกาศใน public/ (null = build สาธารณะ ไม่มีสิทธิ์ใช้รูป แสดงภาพตัวอย่างแทน)
  imageSource: string // URL รูปบน CDN ต้นทาง
  matchedAt: string // วันที่จับคู่รูปกับประกาศ (UTC)
  rooms: string[] // ประเภทห้องที่จะโชว์ชิ้นนี้
  priceTHB: null // ยังไม่ยืนยัน ห้ามใส่ราคาตัวอย่างแทน
  widthCm: null // ยังไม่ยืนยัน
  cutout?: string // clip-path ตัดเฉพาะตัวสินค้าจากรูปประกาศ (ใช้ตอนวางในห้อง รูปเต็มยังอยู่ในการ์ด)
}

// รูปประกาศเป็นของร้านค้าบน Shopee ยังไม่ได้ยืนยันสิทธิ์เผยแพร่ จึงเปิดเฉพาะเดโมในเครื่อง (room-latch/.env.local)
// build สาธารณะไม่ตั้งค่านี้ = ไม่มีรูปประกาศ มีแค่ลิงก์ประกาศจริงกับภาพตัวอย่างที่ติดป้าย
const SHOW_PHOTOS = process.env.NEXT_PUBLIC_SHOW_LISTING_PHOTOS === '1'

export const EXACT_LISTINGS: ExactListing[] = [
  {
    id: 'exact-1272585684-27313552963',
    title: 'โคมไฟหนีบ LED USB',
    url: 'https://shopee.co.th/product/1272585684/27313552963',
    image: SHOW_PHOTOS ? '/listings/clamp-lamp-1272585684-27313552963.jpg' : null,
    imageSource: 'https://down-th.img.susercontent.com/file/th-11134208-7ras9-m4lhq0mbajey11',
    matchedAt: '2026-11-20',
    rooms: ['condo', 'bedroom'],
    priceTHB: null,
    widthCm: null,
    cutout: 'polygon(57% 3%,59% 4.5%,59.2% 6.1%,57% 8.2%,22.5% 22.2%,19% 23%,17% 25.8%,14.9% 30%,14.3% 35%,15.1% 41%,17.4% 48%,21.4% 54.4%,26.2% 61.3%,28.9% 66.7%,29% 68.8%,33.3% 69%,38% 71%,40.5% 73.5%,41.5% 75.3%,40.6% 77.4%,36.8% 78.2%,26.3% 77.8%,20% 76.9%,20% 75.7%,22% 74%,20.5% 71.1%,21.2% 69.4%,25.5% 67%,25.9% 64.4%,23% 59.4%,18.5% 52.1%,14.4% 45%,13% 40%,12.6% 35%,13.2% 30%,15% 26.7%,17.3% 23.7%,20.5% 21%,56.4% 3.8%)',
  },
]

export const exactFor = (roomType: string) => EXACT_LISTINGS.filter(l => l.rooms.includes(roomType))
