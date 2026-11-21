import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {PageHeader} from '@/components/page-header'
import {GoogleButton} from '@/components/google-button'
import {t} from '@/lib/copy'

export const metadata = {title: `${t.login} · ${t.app}`}

export default function Login() {
  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col justify-center gap-5">
      <div>
        <PageHeader title={t.loginTitle}>{t.loginWhy}</PageHeader>
      </div>
      <GoogleButton label={t.google} disabled />
      <p className="text-center text-[11px] text-zinc-400">{t.googleDemo}</p>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/">{t.home}</Link>
      </Button>
    </div>
  )
}
