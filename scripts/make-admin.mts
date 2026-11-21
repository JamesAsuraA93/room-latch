// Mark an already signed-up user's email as verified so isAdmin() (lib/auth.ts) accepts it.
//   node --env-file=.env.local scripts/make-admin.mts you@example.com
// The email must also be listed in ROOMLATCH_ADMIN_EMAILS. Sign-up sends no verification mail, so only
// run it for an address you know the person owns.
import pg from 'pg'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) { console.error('usage: make-admin.mts <email>'); process.exit(1) }
const listed = (process.env.ROOMLATCH_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).includes(email)
const client = new pg.Client({connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL})
await client.connect()
const {rowCount} = await client.query(`update "user" set "emailVerified" = true, "updatedAt" = now() where lower(email) = $1`, [email])
await client.end()
if (!rowCount) { console.error(`no user with ${email}: sign up at /login first, then rerun`); process.exit(1) }
console.log(`${email} verified.${listed ? '' : ' Not in ROOMLATCH_ADMIN_EMAILS yet: add it, then restart the server.'}`)
