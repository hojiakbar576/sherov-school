// TEMPORARY DEMO SIGN-IN. This is not authentication.
// Passwords are constants in this file, nothing is checked by a server, and
// anyone with the browser's developer tools can switch accounts. Replace this
// whole module with real authentication (hashed passwords or SSO,
// server-side sessions, role checks on the server) before any real data is
// used. Pages only use `signIn`, `signInOwner` and `signOut` from
// useSchool(), so swapping the implementation won't touch them.

import type { Role, User } from '../types'

/** Shared by every administrator and teacher demo account, and shown on the sign-in page on purpose. */
export const DEMO_PASSWORD = 'demo'

/**
 * The owner's TEMPORARY development login. Change these while developing;
 * they are not secret and must never be reused as a real password. The owner
 * signs in on /owner/login, not on the shared demo sign-in page.
 */
export const OWNER_DEMO_CREDENTIALS = {
  username: 'owner',
  password: 'owner-demo-2026',
} as const

/** Only the signed-in user's id is remembered: no password, no token. */
export const SESSION_KEY = 'sherov-school:session'

/** Roles that can sign in. Branch staff and teachers on /login, the owner on /owner/login. */
export const SIGN_IN_ROLES: readonly Role[] = ['owner', 'admin', 'reception', 'accountant', 'teacher']

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  owner: '/owner',
  admin: '/',
  reception: '/',
  accountant: '/',
  teacher: '/teacher',
}

/** Where a signed-out visitor is sent to sign in for each role's pages. */
export const ROLE_LOGIN: Record<Role, string> = {
  owner: '/owner/login',
  admin: '/login',
  reception: '/login',
  accountant: '/login',
  teacher: '/login',
}

export const roleLabel: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  reception: 'Receptionist',
  accountant: 'Accountant',
  teacher: 'Teacher',
}

// The owner's session lasts for this browser tab session only (sessionStorage),
// so closing the browser signs the owner out. Other demo accounts are kept in
// localStorage as before.
function storages(): Storage[] {
  const found: Storage[] = []
  try {
    found.push(window.sessionStorage)
  } catch {
    // Blocked: fall through.
  }
  try {
    found.push(window.localStorage)
  } catch {
    // Blocked: the session lasts until the page is refreshed.
  }
  return found
}

export function readSession(): string | null {
  for (const storage of storages()) {
    const id = storage.getItem(SESSION_KEY)
    if (id) return id
  }
  return null
}

/** Remembers who is signed in. `sessionOnly` keeps it to this browser session. */
export function writeSession(userId: string | null, { sessionOnly = false }: { sessionOnly?: boolean } = {}) {
  for (const storage of storages()) {
    try {
      storage.removeItem(SESSION_KEY)
    } catch {
      // Ignore.
    }
  }
  if (!userId) return
  try {
    ;(sessionOnly ? window.sessionStorage : window.localStorage).setItem(SESSION_KEY, userId)
  } catch {
    // Storage blocked: the session lasts until the page is refreshed.
  }
}

/** Finds the administrator or teacher demo account for these details, or null. The owner is not accepted here. */
export function demoSignIn(users: User[], username: string, password: string): User | null {
  const user = users.find((u) => u.username === username.trim().toLowerCase())
  if (!user || user.role === 'owner' || user.active === false || password !== DEMO_PASSWORD) return null
  return user
}

/** The owner's demo sign-in: the one owner account, with OWNER_DEMO_CREDENTIALS. */
export function ownerSignIn(users: User[], username: string, password: string): User | null {
  if (username.trim().toLowerCase() !== OWNER_DEMO_CREDENTIALS.username || password !== OWNER_DEMO_CREDENTIALS.password) return null
  return users.find((u) => u.role === 'owner') ?? null
}
