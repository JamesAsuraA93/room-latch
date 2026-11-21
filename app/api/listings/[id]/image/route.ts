import sharp from 'sharp'
import {listingAssets} from '@/lib/db'
import {listingImagePath} from '@/lib/listing-image'
import {productPhoto} from '@/lib/render-pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Resolve the catalog id on the server. Never accept a URL or storage path from the browser.
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  if (!listingImagePath(id)) return new Response(null, {status: 404})
  try {
    const [asset] = await listingAssets([id])
    if (!asset) return new Response(null, {status: 404})
    const photo = await productPhoto({id, name: asset.title, listing: asset}, AbortSignal.timeout(12000))
    const thumbnail = await sharp(photo.image, {limitInputPixels: 40_000_000}).rotate()
      .resize({width: 640, height: 640, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 85}).toBuffer()
    return new Response(new Uint8Array(thumbnail), {headers: {
      'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
    }})
  } catch {
    return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}})
  }
}
