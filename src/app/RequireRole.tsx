import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../types'
import { useSchool } from '../data/school-context'
import { ROLE_HOME, ROLE_LOGIN } from '../lib/auth'
import { canOpen } from './permissions'

/**
 * Shows its children only to the given roles. Signed-out visitors go to the
 * sign-in page; anyone else goes to their own portal. This only shapes the
 * demo UI: real access control has to happen on a server.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  // Owner-only pages send signed-out visitors to the owner's sign-in.
  const loginPath = roles.length === 1 ? ROLE_LOGIN[roles[0]] : '/login'
  const { user } = useSchool()
  const location = useLocation()
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={loginPath} replace state={{ from }} />
  }
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  // Accountants only open their own sections.
  if (!canOpen(user.role, location.pathname)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}
