// TEMPORARY DEMO SIGN-IN. This is not authentication.
// Every demo account shares one published password, nothing is checked by a
// server, and anyone with the browser's developer tools can switch accounts.
// Replace with real authentication (hashed passwords or SSO, server-side
// sessions, role checks on the server) before any real data is used.

import type { Role, User } from '../types'

/** Shared by every demo account and shown on the sign-in page on purpose. */
export const DEMO_PASSWORD = 'demo'

/** Only the signed-in user's id is remembered: no password, no token. */
export const SESSION_KEY = 'sherov-school:session'

/** Roles that can sign in today. The owner portal isn't built yet. */
export const SIGN_IN_ROLES: readonly Role[] = ['admin', 'teacher']

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  owner: '/',
  admin: '/',
  teacher: '/teacher',
}

export const roleLabel: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  teacher: 'Teacher',
}

export function readSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function writeSession(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the session lasts until the page is refreshed.
  }
}

/** Finds the demo account for these details, or null. */
export function demoSignIn(users: User[], username: string, password: string): User | null {
  const user = users.find((u) => u.username === username.trim().toLowerCase())
  if (!user || !SIGN_IN_ROLES.includes(user.role) || password !== DEMO_PASSWORD) return null
  return user
}
