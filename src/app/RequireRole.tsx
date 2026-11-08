import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../types'
import { useSchool } from '../data/school-context'
import { ROLE_HOME, ROLE_LOGIN } from '../lib/auth'
import { canOpen } from './permissions'
import { tr } from '../i18n'

/**
 * Shows its children only to the given roles. Signed-out visitors go to the
 * sign-in page; anyone else goes to their own portal. This shapes the pages;
 * what data each person can read is enforced by the database's security rules.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  // Owner-only pages send signed-out visitors to the owner's sign-in.
  const loginPath = roles.length === 1 ? ROLE_LOGIN[roles[0]] : '/login'
  const { user, authLoading, cloudStatus, retryCloud } = useSchool()
  const location = useLocation()
  // While the saved sign-in is being checked, show nothing rather than bouncing to the sign-in page.
  if (authLoading) return <div role="status" aria-label={tr("Loading")} className="min-h-dvh bg-canvas" />
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={loginPath} replace state={{ from }} />
  }
  if (cloudStatus === 'error') {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
        <p className="text-lg font-semibold text-ink">{tr("Can’t load the school’s data")}</p>
        <p className="max-w-sm text-ink-muted">{tr("The server can’t be reached. Check the internet connection and try again.")}</p>
        <button type="button" onClick={retryCloud} className="rounded-control bg-brand px-4 py-2 font-medium text-white">
          {tr("Try again")}
        </button>
      </div>
    )
  }
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  // Accountants only open their own sections.
  if (!canOpen(user.role, location.pathname)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}
