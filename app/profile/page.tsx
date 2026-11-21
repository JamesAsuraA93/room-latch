import {ProfileView} from './profile-view'
import {currentUser, isAdmin} from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Profile() {
  return <ProfileView admin={isAdmin(await currentUser())} />
}
