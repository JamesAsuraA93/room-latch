'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {GoogleButton} from '@/components/google-button'
import {authClient} from '@/lib/auth-client'
import {t} from '@/lib/copy'

const field = 'min-h-12 w-full rounded-[18px] border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-brand'

export function LoginForm({googleEnabled}: {googleEnabled: boolean}) {
  const router = useRouter()
  const [signUp, setSignUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email')), password = String(f.get('password'))
    setBusy(true); setError('')
    const {error} = signUp
      ? await authClient.signUp.email({email, password, name: String(f.get('name') || email.split('@')[0])})
      : await authClient.signIn.email({email, password})
    setBusy(false)
    if (error) return setError(`${t.authFailed}: ${error.message ?? error.statusText}`)
    router.replace('/profile'); router.refresh()
  }

  return (
    <div className="space-y-4">
      <GoogleButton label={t.google} disabled={!googleEnabled || busy}
        onClick={() => authClient.signIn.social({provider: 'google', callbackURL: '/profile'})} />
      {!googleEnabled && <p className="text-center text-[11px] text-zinc-500">{t.googleOff}</p>}
      <p className="text-center text-xs text-zinc-400">{t.or}</p>
      <form onSubmit={submit} className="space-y-3">
        {signUp && <input name="name" aria-label={t.displayName} placeholder={t.displayName} maxLength={60} autoComplete="name" className={field} />}
        <input name="email" type="email" required aria-label={t.email} placeholder={t.email} autoComplete="email" className={field} />
        <input name="password" type="password" required minLength={8} aria-label={t.password} placeholder={t.password}
          autoComplete={signUp ? 'new-password' : 'current-password'} className={field} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{signUp ? t.signUp : t.login}</Button>
      </form>
      <button type="button" className="w-full text-center text-sm text-brand underline" onClick={() => { setSignUp(!signUp); setError('') }}>
        {signUp ? t.toSignIn : t.toSignUp}
      </button>
    </div>
  )
}
