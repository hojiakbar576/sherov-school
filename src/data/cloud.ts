// The school's data in the database (Supabase table `records`).
//
// The app keeps one SchoolData object in memory. This module:
//   1. turns it into rows (one per student, payment, lesson…), each tagged with
//      the branch it belongs to, so the database's security rules can decide
//      who may read or change it;
//   2. loads every row the signed-in person may see and rebuilds SchoolData;
//   3. works out which rows changed after an edit, so only those are sent.
// The pages never talk to the database directly.

import type { SchoolData } from '../types'
import type { Profile } from '../lib/supabase'
import { createDemoData, DATA_VERSION, DEFAULT_SETTINGS } from './seed'

/** One row of the `records` table, as the app sends it. */
export interface CloudRow {
  collection: string
  id: string
  branch_id: string | null
  person_id: string | null
  data: unknown
}

/** Collections stored as one row per item. */
export const LIST_COLLECTIONS = [
  'branches', 'users', 'courses', 'leadStages', 'teachers', 'groups', 'students', 'rooms', 'enrollments',
  'studentEvents', 'leads', 'attendance', 'payments', 'homework', 'homeworkResults', 'studentNotes',
  'notifications', 'activity', 'assessments', 'bonuses', 'extraLessons', 'expenses', 'salaryPayments',
  'staffAttendance', 'contactLogs',
] as const satisfies readonly (keyof SchoolData)[]
export type ListCollection = (typeof LIST_COLLECTIONS)[number]

/** Shared by the whole centre (no branch). */
const CENTRE_WIDE = new Set<string>(['meta', 'settings', 'catalogs', 'branches', 'users', 'courses', 'leadStages', 'notificationReads'])

/** Activity is append-only: old entries are never deleted, only the newest are loaded. */
export const APPEND_ONLY = new Set<string>(['activity'])
export const ACTIVITY_LOADED = 100

const key = (collection: string, id: string) => `${collection}\u0000${id}`

/** Every row that represents this data. */
export function toRows(d: SchoolData): CloudRow[] {
  const groupBranch = new Map(d.groups.map((g) => [g.id, g.branchId]))
  const studentBranch = new Map(d.students.map((s) => [s.id, s.branchId]))
  const teacherBranch = new Map(d.teachers.map((t) => [t.id, t.branchId]))
  const homeworkGroup = new Map(d.homework.map((h) => [h.id, h.groupId]))
  const or = (v: string | undefined | null) => v ?? null

  const rows: CloudRow[] = [
    { collection: 'meta', id: 'meta', branch_id: null, person_id: null, data: { version: d.version, seededAt: d.seededAt } },
    { collection: 'settings', id: 'settings', branch_id: null, person_id: null, data: d.settings },
    { collection: 'catalogs', id: 'catalogs', branch_id: null, person_id: null, data: d.catalogs },
    ...Object.entries(d.notificationReads).map(([userId, ids]) => ({ collection: 'notificationReads', id: userId, branch_id: null, person_id: userId, data: ids })),
  ]
  const push = (collection: ListCollection, items: readonly { id: string }[], branch: (x: never) => string | null, person: (x: never) => string | null = () => null) => {
    for (const x of items) rows.push({ collection, id: x.id, branch_id: branch(x as never), person_id: person(x as never), data: x })
  }
  const none = () => null
  push('branches', d.branches, none)
  push('users', d.users, none, (u: SchoolData['users'][number]) => u.id)
  push('courses', d.courses, none)
  // The board's column order is the list order; it is stored with each stage because rows load sorted by id.
  for (const [i, st] of d.leadStages.entries()) rows.push({ collection: 'leadStages', id: st.id, branch_id: null, person_id: null, data: { ...st, order: i } })
  push('teachers', d.teachers, (t: SchoolData['teachers'][number]) => t.branchId, (t: SchoolData['teachers'][number]) => t.id)
  push('groups', d.groups, (g: SchoolData['groups'][number]) => g.branchId)
  push('students', d.students, (s: SchoolData['students'][number]) => s.branchId)
  push('rooms', d.rooms, (r: SchoolData['rooms'][number]) => r.branchId)
  push('enrollments', d.enrollments, (e: SchoolData['enrollments'][number]) => or(studentBranch.get(e.studentId)))
  push('studentEvents', d.studentEvents, (e: SchoolData['studentEvents'][number]) => or(studentBranch.get(e.studentId)))
  push('leads', d.leads, (l: SchoolData['leads'][number]) => l.branchId)
  push('attendance', d.attendance, (r: SchoolData['attendance'][number]) => or(groupBranch.get(r.groupId)))
  push('payments', d.payments, (p: SchoolData['payments'][number]) => or(studentBranch.get(p.studentId)))
  push('homework', d.homework, (h: SchoolData['homework'][number]) => or(groupBranch.get(h.groupId)))
  push('homeworkResults', d.homeworkResults, (r: SchoolData['homeworkResults'][number]) =>
    or(groupBranch.get(homeworkGroup.get(r.homeworkId) ?? '') ?? studentBranch.get(r.studentId)))
  push('studentNotes', d.studentNotes, (n: SchoolData['studentNotes'][number]) => or(studentBranch.get(n.studentId)))
  push('notifications', d.notifications, (n: SchoolData['notifications'][number]) => or(n.audience.branchId))
  push('activity', d.activity, (a: SchoolData['activity'][number]) => or(a.branchId))
  push('assessments', d.assessments, (a: SchoolData['assessments'][number]) => or(groupBranch.get(a.groupId)))
  push('bonuses', d.bonuses, (b: SchoolData['bonuses'][number]) => or(teacherBranch.get(b.teacherId)), (b: SchoolData['bonuses'][number]) => b.teacherId)
  push('extraLessons', d.extraLessons, (x: SchoolData['extraLessons'][number]) => x.branchId, (x: SchoolData['extraLessons'][number]) => x.teacherId)
  push('expenses', d.expenses, (e: SchoolData['expenses'][number]) => e.branchId)
  push('salaryPayments', d.salaryPayments, (p: SchoolData['salaryPayments'][number]) => or(teacherBranch.get(p.teacherId)), (p: SchoolData['salaryPayments'][number]) => p.teacherId)
  push('staffAttendance', d.staffAttendance, (r: SchoolData['staffAttendance'][number]) => r.branchId, (r: SchoolData['staffAttendance'][number]) => r.personId)
  push('contactLogs', d.contactLogs, (l: SchoolData['contactLogs'][number]) => l.branchId)
  return rows
}

/** A fresh centre: the usual settings and lists, no people or records yet. */
export function emptySchool(now: Date): SchoolData {
  const base = createDemoData(now)
  const empty = Object.fromEntries(LIST_COLLECTIONS.map((c) => [c, []]))
  return {
    ...base,
    ...empty,
    version: DATA_VERSION,
    seededAt: now.toISOString(),
    settings: DEFAULT_SETTINGS,
    leadStages: base.leadStages,
    notificationReads: {},
  } as SchoolData
}

/** Rebuilds SchoolData from loaded rows; anything missing gets the usual defaults. */
export function fromRows(rows: readonly CloudRow[], now: Date, branchNames: readonly { id: string; name: string }[] = []): SchoolData {
  const d = emptySchool(now) as unknown as Record<string, unknown>
  const lists = Object.fromEntries(LIST_COLLECTIONS.map((c) => [c, [] as unknown[]])) as Record<string, unknown[]>
  const reads: Record<string, string[]> = {}
  let sawStages = false
  for (const r of rows) {
    if (r.collection === 'meta') {
      const m = r.data as { version?: number; seededAt?: string }
      if (typeof m.version === 'number') d.version = m.version
      if (typeof m.seededAt === 'string') d.seededAt = m.seededAt
    } else if (r.collection === 'settings' || r.collection === 'catalogs') {
      d[r.collection] = r.data
    } else if (r.collection === 'notificationReads') {
      if (Array.isArray(r.data)) reads[r.id] = r.data as string[]
    } else if (r.collection in lists) {
      if (r.collection === 'leadStages') sawStages = true
      lists[r.collection].push(r.data)
    }
  }
  lists.leadStages = (lists.leadStages as { order?: number }[])
    .map((st, i) => ({ st, i }))
    .sort((x, y) => (x.st.order ?? 1e6 + x.i) - (y.st.order ?? 1e6 + y.i))
    .map(({ st }) => {
      const stage = { ...st }
      delete stage.order
      return stage
    })
  for (const c of LIST_COLLECTIONS) if (c !== 'leadStages' || sawStages) d[c] = lists[c]
  // Branches always exist in the database even before their details are filled in.
  const known = new Set((d.branches as { id: string }[]).map((b) => b.id))
  const missing = branchNames.filter((b) => !known.has(b.id)).map((b) => ({ id: b.id, name: b.name, address: '', phone: '' }))
  d.branches = [...(d.branches as unknown[]), ...missing]
  d.activity = (d.activity as { at: string }[]).sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LOADED)
  d.notificationReads = reads
  return d as unknown as SchoolData
}

/** What a row looks like, for spotting changes. */
const fingerprint = (r: CloudRow) => JSON.stringify([r.branch_id, r.person_id, r.data])

/** The rows last confirmed to be in the database, keyed by collection + id. */
export type Snapshot = Map<string, string>

export function snapshotOf(rows: readonly CloudRow[]): Snapshot {
  return new Map(rows.map((r) => [key(r.collection, r.id), fingerprint(r)]))
}

export interface Changes {
  upserts: CloudRow[]
  deletes: { collection: string; id: string }[]
}

/** Rows to send so the database matches `next`. Rows this person can't change are left alone. */
export function diff(snapshot: Snapshot, next: SchoolData, canWrite: (r: Pick<CloudRow, 'collection' | 'branch_id' | 'id' | 'person_id'>) => boolean): Changes {
  const rows = toRows(next)
  const seen = new Set<string>()
  const upserts: CloudRow[] = []
  for (const r of rows) {
    const k = key(r.collection, r.id)
    seen.add(k)
    if (snapshot.get(k) !== fingerprint(r) && canWrite(r)) upserts.push(r)
  }
  const deletes: Changes['deletes'] = []
  for (const k of snapshot.keys()) {
    if (seen.has(k)) continue
    const [collection, id] = k.split('\u0000')
    if (APPEND_ONLY.has(collection)) continue
    deletes.push({ collection, id })
  }
  return { upserts, deletes }
}

/**
 * The changes this person made between two versions of the data on their
 * screen, ready to save. Rows that only arrived from the database (someone
 * else's change, an import) are left out: an upsert already matches the
 * database, and a row is only deleted when the database still has it.
 * Comparing two screen versions, never the screen with the database, means a
 * burst of incoming rows can never be mistaken for rows to delete.
 */
export function changesBetween(
  prev: SchoolData,
  next: SchoolData,
  db: Snapshot,
  canWrite: (r: Pick<CloudRow, 'collection' | 'branch_id' | 'id' | 'person_id'>) => boolean,
): Changes {
  if (prev === next) return { upserts: [], deletes: [] }
  const before = new Map(toRows(prev).map((r) => [key(r.collection, r.id), r]))
  const upserts: CloudRow[] = []
  const seen = new Set<string>()
  for (const r of toRows(next)) {
    const k = key(r.collection, r.id)
    seen.add(k)
    const fp = fingerprint(r)
    const old = before.get(k)
    if (old && fingerprint(old) === fp) continue // unchanged on screen
    if (db.get(k) === fp) continue // already in the database (it came from there)
    if (canWrite(r)) upserts.push(r)
  }
  const deletes: Changes['deletes'] = []
  for (const [k, r] of before) {
    if (seen.has(k) || !db.has(k) || APPEND_ONLY.has(r.collection) || !canWrite(r)) continue
    deletes.push({ collection: r.collection, id: r.id })
  }
  return { upserts, deletes }
}

/** Merges new changes into the ones still waiting to be saved (the newest version of a row wins). */
export function mergeChanges(waiting: Map<string, CloudRow | null>, changes: Changes) {
  for (const r of changes.upserts) waiting.set(key(r.collection, r.id), r)
  for (const d of changes.deletes) waiting.set(key(d.collection, d.id), null)
}

/** The waiting changes as one batch to send. */
export function toChanges(waiting: Map<string, CloudRow | null>): Changes {
  const upserts: CloudRow[] = []
  const deletes: Changes['deletes'] = []
  for (const [k, r] of waiting) {
    if (r) upserts.push(r)
    else {
      const [collection, id] = k.split('\u0000')
      deletes.push({ collection, id })
    }
  }
  return { upserts, deletes }
}

/** After a successful save: the snapshot now matches what was sent. */
export function applyToSnapshot(snapshot: Snapshot, changes: Changes) {
  for (const r of changes.upserts) snapshot.set(key(r.collection, r.id), fingerprint(r))
  for (const d of changes.deletes) snapshot.delete(key(d.collection, d.id))
}

/**
 * Mirror of the database rule `private.can_write_record`, so the app never
 * tries a change the database would refuse. The database stays the real guard.
 */
export function canWriteRow(profile: Pick<Profile, 'role' | 'branch_id' | 'app_user_id'> & { teacher_id?: string | null }, r: Pick<CloudRow, 'collection' | 'branch_id' | 'id' | 'person_id'>): boolean {
  const own = (b: string | null) => b !== null && b === profile.branch_id
  const reads = r.collection === 'notificationReads' && r.id === profile.app_user_id
  switch (profile.role) {
    case 'owner':
      return true
    case 'admin':
      return (own(r.branch_id) && !CENTRE_WIDE.has(r.collection)) ||
        (r.branch_id === null && ['settings', 'catalogs', 'courses', 'notifications', 'activity'].includes(r.collection)) || reads
    case 'accountant':
      return (own(r.branch_id) && !CENTRE_WIDE.has(r.collection)) ||
        (r.branch_id === null && ['notifications', 'activity'].includes(r.collection)) || reads
    case 'teacher':
      return (own(r.branch_id) && ['attendance', 'homework', 'homeworkResults', 'studentNotes', 'assessments', 'notifications', 'activity'].includes(r.collection)) ||
        (r.collection === 'activity' && r.branch_id === null) ||
        (['extraLessons', 'staffAttendance'].includes(r.collection) && !!profile.teacher_id && r.person_id === profile.teacher_id && own(r.branch_id)) ||
        reads
    default:
      return false
  }
}

/** Replaces, adds or removes one item after someone else changed it. */
export function patchData(d: SchoolData, row: CloudRow | null, removed?: { collection: string; id: string }): SchoolData {
  const collection = row?.collection ?? removed?.collection
  const id = row?.id ?? removed?.id
  if (!collection || !id) return d
  if (collection === 'meta') return d
  if (collection === 'settings' || collection === 'catalogs') return row ? { ...d, [collection]: row.data } : d
  if (collection === 'notificationReads') {
    const reads = { ...d.notificationReads }
    if (row && Array.isArray(row.data)) reads[id] = row.data as string[]
    else delete reads[id]
    return { ...d, notificationReads: reads }
  }
  if (!(LIST_COLLECTIONS as readonly string[]).includes(collection)) return d
  const list = d[collection as ListCollection] as { id: string }[]
  const without = list.filter((x) => x.id !== id)
  if (!row) return { ...d, [collection]: without }
  const at = list.findIndex((x) => x.id === id)
  const next = at === -1 ? (collection === 'activity' ? [row.data, ...list] : [...list, row.data]) : list.map((x) => (x.id === id ? row.data : x))
  return { ...d, [collection]: next as { id: string }[] }
}

export { key as rowKey, fingerprint as rowFingerprint }
