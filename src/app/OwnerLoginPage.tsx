import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import { useSchool } from '../data/school-context'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { ROLE_HOME } from '../lib/auth'

/** Sign-in for the owner only. Administrators and teachers use /login. */
export function OwnerLoginPage() {
  const { user, signInOwner } = useSchool()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!signInOwner(username, password)) {
      setError('That username and password don’t match the owner account.')
      return
    }
    navigate(typeof from === 'string' && from.startsWith('/owner') && from !== '/owner/login' ? from : '/owner', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-10 sm:items-center">
      <main className="w-full max-w-md">
        <section aria-labelledby="owner-sign-in" className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          <Logo />
          <h1 id="owner-sign-in" className="mt-8 text-2xl font-semibold tracking-[-0.015em] text-ink">
            Owner sign-in
          </h1>
          <p className="mt-1 text-ink-muted">For Mr. Sherzod: every branch, finances and teachers in one place.</p>

          <div role="note" className="mt-6 flex gap-3 rounded-control border border-warning-mark/40 bg-warning-soft px-3.5 py-3 text-sm text-ink">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <span className="font-semibold">Temporary development login.</span> Not secure: the details are set in the app’s code and nothing is checked by a
              server. You stay signed in until you sign out or close the browser.
            </p>
          </div>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <Field label="Username">
              {(control) => (
                <Input
                  {...control}
                  name="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError(null)
                  }}
                />
              )}
            </Field>
            <Field label="Password" error={error ?? undefined}>
              {(control) => (
                <Input
                  {...control}
                  name="password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              Sign in
              <ArrowRight aria-hidden />
            </Button>
          </form>
        </section>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Administrator or teacher?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in here
          </Link>
        </p>
      </main>
    </div>
  )
}
