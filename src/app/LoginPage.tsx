import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import type { User } from '../types'
import { useSchool } from '../data/school-context'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Avatar } from '../components/ui/misc'
import { DEMO_PASSWORD, ROLE_HOME, roleLabel } from '../lib/auth'
import { cn } from '../lib/cn'

/** Sends someone back to the page they asked for, if it belongs to their portal. */
function destination(user: User, from: unknown): string {
  const home = ROLE_HOME[user.role]
  if (typeof from !== 'string' || from === '/login') return home
  const inTeacherPortal = from === '/teacher' || from.startsWith('/teacher/')
  return inTeacherPortal === (user.role === 'teacher') ? from : home
}

export function LoginPage() {
  const { user, signIn, demoAccounts, data } = useSchool()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={destination(user, from)} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = signIn(username, password)
    if (!found) {
      setError('That username and password don’t match a demo account. Pick one from the list.')
      return
    }
    navigate(destination(found, from), { replace: true })
  }

  const fill = (account: User) => {
    setUsername(account.username)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const teacherBranch = new Map(data.teachers.map((t) => [t.id, t.branchId]))
  const accountBranch = (u: User) => branchName.get((u.role === 'teacher' ? teacherBranch.get(u.teacherId ?? '') : u.branchId) ?? '') ?? ''
  const admins = demoAccounts.filter((u) => u.role === 'admin')
  const teachers = demoAccounts
    .filter((u) => u.role === 'teacher')
    .sort((a, b) => accountBranch(a).localeCompare(accountBranch(b)) || a.fullName.localeCompare(b.fullName))

  return (
    <div className="min-h-dvh bg-canvas px-4 py-8 sm:py-12">
      <main className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="sign-in-title" className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          <Logo />
          <h1 id="sign-in-title" className="mt-8 text-2xl font-semibold tracking-[-0.015em] text-ink">
            Sign in
          </h1>
          <p className="mt-1 text-ink-muted">Administrators and teachers each get their own workspace.</p>

          <div role="note" className="mt-6 flex gap-3 rounded-control border border-warning-mark/40 bg-warning-soft px-3.5 py-3 text-sm text-ink">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <span className="font-semibold">Temporary demo sign-in.</span> Not secure: every account uses the password{' '}
              <code className="rounded bg-surface px-1 font-mono text-[0.8125rem]">{DEMO_PASSWORD}</code>, nothing is checked by a server, and
              data stays in this browser. Don’t enter real passwords.
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
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError(null)
                  }}
                  placeholder="e.g. admin.chilonzor"
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

        <section aria-labelledby="accounts-title" className="rounded-panel border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 id="accounts-title" className="font-semibold text-ink">
              Demo accounts
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">Choose one to fill in the form. The owner’s workspace isn’t built yet.</p>
          </div>
          <AccountList title="Branch administrators" accounts={admins} branchOf={accountBranch} onPick={fill} selected={username} />
          <AccountList title="Teachers" accounts={teachers} branchOf={accountBranch} onPick={fill} selected={username} />
        </section>
      </main>
    </div>
  )
}

function AccountList({
  title,
  accounts,
  branchOf,
  onPick,
  selected,
}: {
  title: string
  accounts: User[]
  branchOf: (u: User) => string
  onPick: (u: User) => void
  selected: string
}) {
  return (
    <div className="px-2 py-3">
      <h3 className="px-3 pb-1 text-xs font-medium text-ink-faint">{title}</h3>
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account)}
              aria-pressed={selected === account.username}
              className={cn(
                'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-subtle',
                selected === account.username && 'bg-brand-soft hover:bg-brand-soft',
              )}
            >
              <Avatar name={account.fullName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{account.fullName}</span>
                <span className="block truncate text-xs text-ink-muted">
                  <span className="font-mono">{account.username}</span> · {roleLabel[account.role]}, {branchOf(account)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
