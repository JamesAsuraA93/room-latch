import {ProductSelection} from '@/components/product-selection'
import {loadFurnitureCatalog} from '@/lib/furniture-catalog'
import {renderReadiness} from '@/lib/render-readiness'

export const dynamic = 'force-dynamic'
export default async function Products() {
  const status = renderReadiness(process.env)
  return <ProductSelection catalog={await loadFurnitureCatalog()} provider={status.provider} renderUnavailableReason={status.reason} />
}
