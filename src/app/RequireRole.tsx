import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../types'
import { useSchool } from '../data/school-context'
import { ROLE_HOME } from '../lib/auth'

/**
 * Shows its children only to the given roles. Signed-out visitors go to the
 * sign-in page; anyone else goes to their own portal. This only shapes the
 * demo UI: real access control has to happen on a server.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { user } = useSchool()
  const location = useLocation()
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}
