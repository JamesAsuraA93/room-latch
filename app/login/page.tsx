import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {PageHeader} from '@/components/page-header'
import {redirect} from 'next/navigation'
import {LoginForm} from './login-form'
import {currentUser} from '@/lib/auth'
import {t} from '@/lib/copy'

export const metadata = {title: `${t.login} · ${t.app}`}

export default async function Login({searchParams}: {searchParams: Promise<{next?: string}>}) {
  const {next} = await searchParams
  // Only the result flow is allowed here; never accept an external redirect target.
  const redirectTo = typeof next === 'string' && /^\/result(?:\?job=[A-Za-z0-9-]{1,100})?$/.test(next) ? next : '/profile'
  if (await currentUser()) redirect(redirectTo)
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6 md:py-10">
      <div>
        <PageHeader title={t.loginTitle}>{t.loginWhy}</PageHeader>
      </div>
      <LoginForm redirectTo={redirectTo} />
      <Button asChild variant="ghost" className="w-full">
        <Link href="/">{t.home}</Link>
      </Button>
    </div>
  )
}
