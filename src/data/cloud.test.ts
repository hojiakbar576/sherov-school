import { describe, expect, it } from 'vitest'
import { createDemoData } from './seed'
import { applyToSnapshot, canWriteRow, diff, fromRows, patchData, snapshotOf, toRows } from './cloud'
import { branchData } from '../lib/owner'

const now = new Date('2026-11-08T09:00:00')
const demo = () => createDemoData(now)
const owner = { role: 'owner' as const, branch_id: null, app_user_id: 'usr_owner', teacher_id: null }
const bashlikAdmin = { role: 'admin' as const, branch_id: 'br_bashlik', app_user_id: 'usr_admin_bashlik', teacher_id: null }

describe('school data ↔ database rows', () => {
  it('saving and loading gives back exactly the same school', () => {
    const d = demo()
    const back = fromRows(toRows(d), now)
    // Activity is loaded newest first and capped; everything else must match exactly.
    expect({ ...back, activity: [] }).toEqual({ ...d, activity: [] })
    expect(back.activity.map((a) => a.id).sort()).toEqual(d.activity.map((a) => a.id).sort())
  })

  it('gives every row an id unique within its collection', () => {
    const rows = toRows(demo())
    const keys = rows.map((r) => `${r.collection}/${r.id}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('tags branch records with the right branch, so the database can keep branches apart', () => {
    const d = demo()
    const rows = toRows(d)
    for (const p of d.payments.slice(0, 50)) {
      const student = d.students.find((s) => s.id === p.studentId)!
      expect(rows.find((r) => r.collection === 'payments' && r.id === p.id)?.branch_id).toBe(student.branchId)
    }
    for (const a of d.attendance.slice(0, 50)) {
      const group = d.groups.find((g) => g.id === a.groupId)!
      expect(rows.find((r) => r.collection === 'attendance' && r.id === a.id)?.branch_id).toBe(group.branchId)
    }
    // Every record of a branch-only kind has a branch (organisation-wide expenses are the owner's own).
    const branchKinds = ['teachers', 'groups', 'students', 'payments', 'attendance', 'leads', 'enrollments', 'homework']
    expect(rows.filter((r) => branchKinds.includes(r.collection) && !r.branch_id)).toEqual([])
    const orgExpenses = d.expenses.filter((e) => !e.branchId).map((e) => e.id).sort()
    expect(rows.filter((r) => r.collection === 'expenses' && !r.branch_id).map((r) => r.id).sort()).toEqual(orgExpenses)
  })

  it('a branch’s data alone round-trips too (what an administrator loads)', () => {
    const d = branchData(demo(), 'br_bashlik')
    const rows = toRows(d).filter((r) => r.branch_id === null || r.branch_id === 'br_bashlik')
    expect(fromRows(rows, now).students.length).toBe(d.students.length)
  })
})

describe('sending only what changed', () => {
  it('sends nothing when nothing changed', () => {
    const d = demo()
    const snap = snapshotOf(toRows(d))
    expect(diff(snap, d, () => true)).toEqual({ upserts: [], deletes: [] })
  })

  it('sends one row for one edit, and nothing after it is saved', () => {
    const d = demo()
    const snap = snapshotOf(toRows(d))
    const edited = { ...d, students: d.students.map((s, i) => (i === 0 ? { ...s, fullName: 'Renamed' } : s)) }
    const changes = diff(snap, edited, () => true)
    expect(changes.upserts.map((r) => `${r.collection}/${r.id}`)).toEqual([`students/${d.students[0].id}`])
    applyToSnapshot(snap, changes)
    expect(diff(snap, edited, () => true)).toEqual({ upserts: [], deletes: [] })
  })

  it('sends deletes, but never deletes activity history', () => {
    const d = demo()
    const snap = snapshotOf(toRows(d))
    const fewer = { ...d, leads: d.leads.slice(1), activity: d.activity.slice(1) }
    const changes = diff(snap, fewer, () => true)
    expect(changes.deletes).toEqual([{ collection: 'leads', id: d.leads[0].id }])
  })

  it('does not try to send rows this person may not change', () => {
    const d = demo()
    const snap = snapshotOf(toRows(d))
    const other = d.students.find((s) => s.branchId !== 'br_bashlik')!
    const edited = { ...d, students: d.students.map((s) => (s.id === other.id ? { ...s, fullName: 'X' } : s)) }
    expect(diff(snap, edited, (r) => canWriteRow(bashlikAdmin, r)).upserts).toEqual([])
    expect(diff(snap, edited, (r) => canWriteRow(owner, r)).upserts).toHaveLength(1)
  })
})

describe('who may change what (mirrors the database rules)', () => {
  const row = (collection: string, branch_id: string | null, id = 'x', person_id: string | null = null) => ({ collection, branch_id, id, person_id })
  const teacher = { role: 'teacher' as const, branch_id: 'br_bashlik', app_user_id: 'usr_t1', teacher_id: 'tch_1' }
  const accountant = { role: 'accountant' as const, branch_id: 'br_bashlik', app_user_id: 'usr_acc', teacher_id: null }

  it('administrators change their own branch only, and not user accounts', () => {
    expect(canWriteRow(bashlikAdmin, row('students', 'br_bashlik'))).toBe(true)
    expect(canWriteRow(bashlikAdmin, row('students', 'br_chilonzor'))).toBe(false)
    expect(canWriteRow(bashlikAdmin, row('users', null))).toBe(false)
    expect(canWriteRow(bashlikAdmin, row('leadStages', null))).toBe(false)
    expect(canWriteRow(bashlikAdmin, row('settings', null))).toBe(true)
  })

  it('accountants can’t change shared settings or courses', () => {
    expect(canWriteRow(accountant, row('payments', 'br_bashlik'))).toBe(true)
    expect(canWriteRow(accountant, row('settings', null))).toBe(false)
    expect(canWriteRow(accountant, row('courses', null))).toBe(false)
  })

  it('teachers only change lessons, homework and notes in their branch', () => {
    expect(canWriteRow(teacher, row('attendance', 'br_bashlik'))).toBe(true)
    expect(canWriteRow(teacher, row('attendance', 'br_chilonzor'))).toBe(false)
    expect(canWriteRow(teacher, row('payments', 'br_bashlik'))).toBe(false)
    expect(canWriteRow(teacher, row('students', 'br_bashlik'))).toBe(false)
    expect(canWriteRow(teacher, row('extraLessons', 'br_bashlik', 'x', 'tch_1'))).toBe(true)
    expect(canWriteRow(teacher, row('extraLessons', 'br_bashlik', 'x', 'tch_2'))).toBe(false)
    expect(canWriteRow(teacher, row('notificationReads', null, 'usr_t1'))).toBe(true)
    expect(canWriteRow(teacher, row('notificationReads', null, 'usr_other'))).toBe(false)
  })
})

describe('live updates from other people', () => {
  it('adds, replaces and removes items', () => {
    const d = demo()
    const lead = { ...d.leads[0], id: 'lead_new', studentName: 'New' }
    const added = patchData(d, { collection: 'leads', id: 'lead_new', branch_id: lead.branchId, person_id: null, data: lead })
    expect(added.leads).toHaveLength(d.leads.length + 1)
    const renamed = patchData(added, { collection: 'leads', id: 'lead_new', branch_id: lead.branchId, person_id: null, data: { ...lead, studentName: 'Changed' } })
    expect(renamed.leads.find((l) => l.id === 'lead_new')?.studentName).toBe('Changed')
    const removed = patchData(renamed, null, { collection: 'leads', id: 'lead_new' })
    expect(removed.leads).toHaveLength(d.leads.length)
  })
})
