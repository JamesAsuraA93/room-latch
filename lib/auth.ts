// Server only. Better Auth on the app's Neon Postgres pool: email+password always, Google when its env vars are set.
// Tables user/session/account/verification: db/migrations/003-better-auth.sql. profiles row is made on user create.
import 'server-only'
import {betterAuth} from 'better-auth'
import {headers} from 'next/headers'
import {db} from '@/lib/db'

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

/** "Jane.Doe+x@gmail.com" -> "jane_doe_x", padded/cut to fit profiles.handle ^[a-z0-9_]{3,30}$ */
export function handleBase(email: string): string {
  const h = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
  return h.length >= 3 ? h : `${h}user`.padEnd(3, '_')
}

async function createProfile(user: {id: string; email: string; name: string}) {
  const base = handleBase(user.email)
  for (let i = 0; i < 5; i++) {
    const handle = i === 0 ? base : `${base}_${Math.random().toString(36).slice(2, 7)}`
    const {rowCount} = await db().query(
      `insert into profiles (user_id, handle, display_name) values ($1, $2, $3) on conflict do nothing`,
      [user.id, handle, (user.name || base).slice(0, 60)],
    )
    if (rowCount) return
    const {rows} = await db().query('select 1 from profiles where user_id = $1', [user.id])
    if (rows.length) return
  }
  throw new Error('could not pick a unique handle')
}

export const auth = betterAuth({
  database: db(),
  emailAndPassword: {enabled: true},
  socialProviders: googleEnabled
    ? {google: {clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!}}
    : {},
  databaseHooks: {user: {create: {after: createProfile}}},
})

export type User = typeof auth.$Infer.Session.user

export async function currentUser(): Promise<User | null> {
  const s = await auth.api.getSession({headers: await headers()})
  return s?.user ?? null
}

/** Admin = verified email listed in ROOMLATCH_ADMIN_EMAILS. Verified matters: anyone can sign up with any
 *  address via email+password (no verification mail), so only Google (or a manual SQL flip) proves ownership. */
export function isAdmin(user: User | null): boolean {
  if (!user?.emailVerified) return false
  const list = (process.env.ROOMLATCH_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(user.email.toLowerCase())
}
