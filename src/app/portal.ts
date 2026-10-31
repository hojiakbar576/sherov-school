import { useSchool } from '../data/school-context'
import { navFor } from './navigation'

/**
 * Builds links for pages shared by more than one portal (attendance,
 * schedule): `portalPath('/attendance')` is "/attendance" for an
 * administrator and "/teacher/attendance" for a teacher.
 */
export function usePortalPath(): (path: string) => string {
  const { user } = useSchool()
  const base = user ? navFor(user.role).base : ''
  return (path) => `${base}${path}`
}
