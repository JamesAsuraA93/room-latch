import 'server-only'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {realListings} from '@/lib/db'
import {furnitureCatalog} from '@/lib/furniture'

export async function loadFurnitureCatalog() {
  const real = await realListings().catch(() => loadRealCatalog())
  return furnitureCatalog(real, loadCatalog())
}
