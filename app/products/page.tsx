import {ProductSelection} from '@/components/product-selection'
import {loadFurnitureCatalog} from '@/lib/furniture-catalog'
import {liveProvider} from '@/lib/live-render-core'

export const dynamic = 'force-dynamic'
export default async function Products() {
  return <ProductSelection catalog={await loadFurnitureCatalog()} provider={liveProvider(process.env)} />
}
