import type {NextConfig} from 'next'

const config: NextConfig = {
  images: {
    // รูปเดโมมาจาก Unsplash ตอนต่อของจริงให้เก็บรูปผู้ใช้ไว้ที่ Supabase Storage แล้วเพิ่ม host ที่นี่
    remotePatterns: [{protocol: 'https', hostname: 'images.unsplash.com'}],
    formats: ['image/avif', 'image/webp'],
  },
}

export default config
