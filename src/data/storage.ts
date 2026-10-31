// Demo persistence in the browser's localStorage.
// This is NOT a database: data lives only in this browser on this device.
// Nothing sensitive (passwords, tokens) is ever stored here.

import type { SchoolData } from '../types'
import { PAYMENT_METHODS, ROLES, SUBJECTS } from '../types'
import { isValidISODate } from '../lib/dates'
import { createDemoData, DATA_VERSION } from './seed'
import { migrate } from './migrate'

export const STORAGE_KEY = 'sherov-school:data'
const BACKUP_PREFIX = 'sherov-school:backup:'

export interface LoadResult {
  data: SchoolData
  /** false when the browser blocks storage; changes then last until refresh only. */
  persistent: boolean
  /** Explains anything unusual that happened while loading, for a banner. */
  problem?: string
}

function getStorage(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = `${STORAGE_KEY}:probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

// ---- Validation: a light structural check of what was saved. ----

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const oneOf = (v: unknown, options: readonly string[]) => isStr(v) && options.includes(v)

const validators: Record<string, (v: Obj) => boolean> = {
  branches: (b) => isStr(b.id) && isStr(b.name),
  users: (u) =>
    isStr(u.id) && isStr(u.fullName) && isStr(u.username) && oneOf(u.role, ROLES) &&
    (u.branchId === null || isStr(u.branchId)) && !('password' in u),
  teachers: (t) =>
    isStr(t.id) && isStr(t.fullName) && isStr(t.branchId) && oneOf(t.subject, SUBJECTS) && oneOf(t.status, ['active', 'on_leave']),
  groups: (g) =>
    isStr(g.id) && isStr(g.name) && isStr(g.teacherId) && isStr(g.branchId) && oneOf(g.days, ['odd', 'even']) &&
    isStr(g.startTime) && isNum(g.capacity) && isNum(g.monthlyFee) && isNum(g.durationMinutes),
  students: (s) =>
    isStr(s.id) && isStr(s.fullName) && isStr(s.branchId) && (s.groupId === null || isStr(s.groupId)) &&
    isValidISODate(s.enrolledOn) && isNum(s.monthlyTuition) && oneOf(s.status, ['active', 'paused', 'left']),
  attendance: (r) =>
    isStr(r.id) && isStr(r.groupId) && isValidISODate(r.date) && isStr(r.startTime) && isStr(r.teacherId) &&
    isObj(r.marks) && (r.comments === undefined || isObj(r.comments)),
  payments: (p) =>
    isStr(p.id) && isStr(p.studentId) && isNum(p.amount) && isValidISODate(p.date) &&
    isStr(p.period) && oneOf(p.method, PAYMENT_METHODS) && oneOf(p.status, ['paid', 'pending', 'refunded']),
  homework: (h) => isStr(h.id) && isStr(h.groupId) && isStr(h.teacherId) && isStr(h.title) && isValidISODate(h.dueDate),
  notifications: (n) => isStr(n.id) && isStr(n.title) && isStr(n.body) && isStr(n.createdAt) && isObj(n.audience),
  activity: (a) => isStr(a.id) && isStr(a.title) && isStr(a.at),
}

/** Returns a reason the value is not usable, or null if it looks valid. */
export function validateSchoolData(value: unknown): string | null {
  if (!isObj(value)) return 'the saved value is not an object'
  if (value.version !== DATA_VERSION) return `it was saved by a different version of the app (${String(value.version)})`
  for (const [key, check] of Object.entries(validators)) {
    const list = value[key]
    if (!Array.isArray(list)) return `"${key}" is missing`
    const bad = list.findIndex((item) => !isObj(item) || !check(item))
    if (bad !== -1) return `"${key}" item ${bad + 1} is malformed`
  }
  if (!isObj(value.settings) || !isStr(value.settings.centerName)) return 'settings are missing'
  if (!isObj(value.notificationReads) || !Object.values(value.notificationReads).every(Array.isArray)) {
    return 'notification state is missing'
  }
  return null
}

// ---- Load / save ----

export function loadData(now: Date = new Date()): LoadResult {
  const storage = getStorage()
  if (!storage) {
    return {
      data: createDemoData(now),
      persistent: false,
      problem: 'This browser is blocking local storage, so changes will be lost when you refresh the page.',
    }
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    const data = createDemoData(now)
    saveData(data)
    return { data, persistent: true }
  }

  let reason: string | null
  let parsed: unknown = null
  let upgraded = false
  try {
    parsed = JSON.parse(raw)
    // Data saved by an earlier version is upgraded in place rather than replaced.
    if (isObj(parsed) && isNum(parsed.version) && parsed.version < DATA_VERSION) {
      const next = migrate(parsed, DATA_VERSION, now)
      if (next) {
        parsed = next
        upgraded = true
      }
    }
    reason = validateSchoolData(parsed)
  } catch {
    reason = 'it is not valid JSON'
  }
  if (reason === null) {
    if (upgraded) {
      // Keep the pre-upgrade copy too, in case anything looks wrong.
      try {
        storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, raw)
      } catch {
        // Storage full: the upgrade still works for this session.
      }
      saveData(parsed as SchoolData)
    }
    return { data: parsed as SchoolData, persistent: true }
  }

  // Keep the unreadable copy instead of silently overwriting it.
  const backupKey = `${BACKUP_PREFIX}${now.toISOString()}`
  try {
    storage.setItem(backupKey, raw)
  } catch {
    // Storage full: the fresh data below still works for this session.
  }
  const data = createDemoData(now)
  saveData(data)
  return {
    data,
    persistent: true,
    problem: `Saved demo data couldn't be used because ${reason}. A copy was kept in browser storage under "${backupKey}", and fresh sample data was loaded.`,
  }
}

export function saveData(data: SchoolData): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
