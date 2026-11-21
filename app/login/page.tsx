import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {PageHeader} from '@/components/page-header'
import {redirect} from 'next/navigation'
import {LoginForm} from './login-form'
import {currentUser} from '@/lib/auth'
import {t} from '@/lib/copy'

export const metadata = {title: `${t.login} · ${t.app}`}

export default async function Login() {
  if (await currentUser()) redirect('/profile')
  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col justify-center gap-5">
      <div>
        <PageHeader title={t.loginTitle}>{t.loginWhy}</PageHeader>
      </div>
      <LoginForm />
      <Button asChild variant="ghost" className="w-full">
        <Link href="/">{t.home}</Link>
      </Button>
    </div>
  )
}
