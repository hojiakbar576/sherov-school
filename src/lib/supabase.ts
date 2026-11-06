// The connection to the school's database (Supabase).
//
// The address and the "publishable" key below are meant to be public: they
// only let the website ask the database questions. What anyone may actually
// read or change is decided inside the database by its security rules (each
// person only sees their own learning center), never by this file. Secret
// keys must never be put here.

import { createClient } from '@supabase/supabase-js'
import type { Role } from '../types'

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://lpxtpxawrvorybllgucg.supabase.co'
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_AGikcmy8fPBmCsectSquzA_jdYOUbRN'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sherov-school:auth' },
})

/** Staff sign in with a username; the database stores it as a private, never-emailed address. */
export const LOGIN_EMAIL_DOMAIN = 'users.sherov-crm.app'
export const loginEmail = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`

/** A person's account, as the database describes it. */
export interface Profile {
  user_id: string
  center_id: string
  branch_id: string | null
  role: Role
  username: string
  full_name: string
  app_user_id: string
  active: boolean
}

/** The signed-in person's own profile, or null if there is none (or it's turned off). */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, center_id, branch_id, role, username, full_name, app_user_id, active')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const profile = data as Profile | null
  return profile && profile.active ? profile : null
}
