import type {NextConfig} from 'next'

const config: NextConfig = {
  // The development badge overlaps touch targets on small screens.
  devIndicators: false,
  images: {
    // Demo and style photos come from Unsplash. User and design images are served through /api/designs (presigned storage URLs), not next/image.
    remotePatterns: [{protocol: 'https', hostname: 'images.unsplash.com'}],
    formats: ['image/avif', 'image/webp'],
  },
  // Data read with fs + process.cwd() is not traced automatically; ship it with the routes that read it.
  outputFileTracingIncludes: {
    '/products': ['./catalog/*.csv'],
    '/result': ['./catalog/*.csv'],
    '/api/render/live': ['./catalog/*.csv', './prompts/registry.json'],
    '/api/listings/rank': ['./prompts/registry.json'],
  },
}

export default config
