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
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6 md:py-10">
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
