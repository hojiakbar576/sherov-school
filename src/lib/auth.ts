// Signing in. Accounts live in the database (Supabase Auth): passwords are
// checked and stored (scrambled) by Supabase, and what each person may see is
// enforced by the database's security rules. Pages only use `signIn`,
// `signInOwner` and `signOut` from useSchool().

import type { Role, User } from '../types'
import type { Profile } from './supabase'
import { tr } from '../i18n'

/** Roles that can sign in. Branch staff and teachers on /login, the owner on /owner/login. */
export const SIGN_IN_ROLES: readonly Role[] = ['owner', 'admin', 'accountant', 'teacher']

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  owner: '/owner',
  admin: '/',
  accountant: '/',
  teacher: '/teacher',
}

/** Where a signed-out visitor is sent to sign in for each role's pages. */
export const ROLE_LOGIN: Record<Role, string> = {
  owner: '/owner/login',
  admin: '/login',
  accountant: '/login',
  teacher: '/login',
}

export const roleLabel: Record<Role, string> = {
  owner: tr("Owner"),
  admin: tr("Administrator"),
  accountant: tr("Accountant"),
  teacher: tr("Teacher"),
}

/** The person inside the app for a signed-in account. */
export function userFromProfile(profile: Profile, appUsers: readonly User[]): User {
  const known = appUsers.find((u) => u.id === profile.app_user_id)
  return {
    ...known,
    id: profile.app_user_id,
    role: profile.role,
    fullName: profile.full_name,
    username: profile.username,
    branchId: profile.branch_id,
    active: true,
  }
}

/** Which sign-in page a role uses: the owner has their own. */
export const signsInOnOwnerPage = (role: Role) => role === 'owner'
