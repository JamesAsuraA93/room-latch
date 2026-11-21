import type {NextConfig} from 'next'

const config: NextConfig = {
  images: {
    // รูปเดโมมาจาก Unsplash ตอนต่อของจริงให้เก็บรูปผู้ใช้ไว้ที่ Supabase Storage แล้วเพิ่ม host ที่นี่
    remotePatterns: [{protocol: 'https', hostname: 'images.unsplash.com'}],
    formats: ['image/avif', 'image/webp'],
  },
  // Data read with fs + process.cwd() is not traced automatically; ship it with the routes that read it.
  outputFileTracingIncludes: {
    '/result': ['./catalog/*.csv'],
    '/api/render/live': ['./catalog/*.csv', './prompts/registry.json'],
  },
}

export default config
