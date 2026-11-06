import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { User } from '../types'
import { useSchool } from '../data/school-context'
import { Logo } from '../components/layout/Logo'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { ROLE_HOME } from '../lib/auth'
import { tr } from '../i18n'

/** Sends someone back to the page they asked for, if it belongs to their portal. */
function destination(user: User, from: unknown): string {
  const home = ROLE_HOME[user.role]
  if (typeof from !== 'string' || from === '/login') return home
  const inTeacherPortal = from === '/teacher' || from.startsWith('/teacher/')
  return inTeacherPortal === (user.role === 'teacher') ? from : home
}

/** Sign-in for branch administrators, accountants and teachers. Accounts are created by the owner. */
export function LoginPage() {
  const { user, authLoading, signIn } = useSchool()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={destination(user, from)} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await signIn(username, password)
    setBusy(false)
    if (!result.user) {
      setError(result.error)
      setPassword('')
      return
    }
    navigate(destination(result.user, from), { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-10 sm:items-center">
      <main className="w-full max-w-md">
        <section aria-labelledby="sign-in-title" className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <LanguageSwitcher />
          </div>
          <h1 id="sign-in-title" className="mt-8 text-2xl font-semibold tracking-[-0.015em] text-ink">
            {tr("Sign in")}
          </h1>
          <p className="mt-1 text-ink-muted">{tr("Administrators, accountants and teachers each see the pages for their job.")}</p>

          <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 space-y-4" aria-busy={busy || authLoading}>
            <Field label={tr("Username")}>
              {(control) => (
                <Input
                  {...control}
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError(null)
                  }}
                  placeholder={tr("e.g. admin.chilonzor")}
                />
              )}
            </Field>
            <Field label={tr("Password")} error={error ?? undefined}>
              {(control) => (
                <Input
                  {...control}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || authLoading}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {busy ? tr("Signing in…") : tr("Sign in")}
              {!busy && <ArrowRight aria-hidden />}
            </Button>
          </form>
          <p className="mt-4 text-sm text-ink-muted">{tr("Forgot your password? Ask the owner to set a new one.")}</p>
        </section>
        <p className="mt-4 text-center text-sm text-ink-muted">
          {tr("Mr. Sherzod?")}{' '}
          <Link to="/owner/login" className="font-medium text-brand hover:underline">
            {tr("Owner sign-in")}
          </Link>
        </p>
      </main>
    </div>
  )
}
