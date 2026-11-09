import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data/seed'
import type { Payment, SchoolData, Student } from '../types'
import { groupIdsOf, inGroup } from './membership'
import { findScheduleConflicts, meetsOn, weekdaysOf } from './schedule'
import { computeBalances } from './metrics'
import { teacherSalary } from './salary'
import { scopeData } from './scope'
import { groupDaysLabel } from './format'

const now = new Date('2026-11-20T10:00:00')
const demo = () => createDemoData(new Date('2026-11-08T09:00:00'))

function twoGroupStudent(d: SchoolData): { d: SchoolData; s: Student; main: string; extra: string } {
  const s = d.students.find((x) => x.status === 'active' && x.groupId)!
  const extra = d.groups.find((g) => g.id !== s.groupId && g.branchId === s.branchId && g.teacherId !== d.groups.find((m) => m.id === s.groupId)!.teacherId)!.id
  const student = { ...s, extraGroupIds: [extra] }
  return { d: { ...d, students: d.students.map((x) => (x.id === s.id ? student : x)) }, s: student, main: s.groupId!, extra }
}

describe('students in several groups', () => {
  it('belongs to its main group and its other groups', () => {
    const { s, main, extra } = twoGroupStudent(demo())
    expect(groupIdsOf(s)).toEqual([main, extra])
    expect(inGroup(s, main)).toBe(true)
    expect(inGroup(s, extra)).toBe(true)
    expect(inGroup(s, 'nope')).toBe(false)
  })

  it('the teacher of the other group sees the student in their class', () => {
    const { d, s, extra } = twoGroupStudent(demo())
    const teacherId = d.groups.find((g) => g.id === extra)!.teacherId
    const teacherUser = d.users.find((u) => u.teacherId === teacherId)!
    expect(scopeData(d, teacherUser).students.some((x) => x.id === s.id)).toBe(true)
  })

  it('each teacher earns their share only from payments for their own group', () => {
    const { d, s, main, extra } = twoGroupStudent(demo())
    const pay = (id: string, groupId: string, amount: number): Payment => ({ id, studentId: s.id, amount, date: '2026-11-10', period: '2026-11', method: 'cash', status: 'paid', groupId })
    const withPays = { ...d, payments: [...d.payments.filter((p) => p.studentId !== s.id), pay('p1', main, 500_000), pay('p2', extra, 300_000)] }
    const mainTeacher = d.groups.find((g) => g.id === main)!.teacherId
    const extraTeacher = d.groups.find((g) => g.id === extra)!.teacherId
    const forMain = teacherSalary(withPays, mainTeacher, '2026-11').lines.filter((l) => l.studentId === s.id)
    const forExtra = teacherSalary(withPays, extraTeacher, '2026-11').lines.filter((l) => l.studentId === s.id)
    expect(forMain.map((l) => [l.groupId, l.paid])).toEqual([[main, 500_000]])
    expect(forExtra.map((l) => [l.groupId, l.paid])).toEqual([[extra, 300_000]])
  })
})

describe('groups that meet on other days', () => {
  it('meets only on its own days', () => {
    const g = { ...demo().groups[0], status: 'active' as const, weekdays: [6, 7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] }
    expect(weekdaysOf(g)).toEqual([6, 7])
    expect(meetsOn(g, '2026-11-14')).toBe(true) // Saturday
    expect(meetsOn(g, '2026-11-15')).toBe(true) // Sunday
    expect(meetsOn(g, '2026-11-16')).toBe(false) // Monday
    expect(groupDaysLabel(g)).toBe('Sat, Sun')
  })

  it('a weekend group clashes with an even-day group only on Saturday overlap', () => {
    const d = demo()
    const even = { ...d.groups[0], id: 'a', status: 'active' as const, days: 'even' as const, weekdays: undefined, startTime: '10:00', durationMinutes: 90 }
    const weekend = { ...even, id: 'b', weekdays: [6, 7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] }
    const monFri = { ...even, id: 'c', weekdays: [1, 5] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] }
    expect(findScheduleConflicts(weekend, [even]).teacher?.id).toBe('a')
    expect(findScheduleConflicts(monFri, [even]).teacher).toBeUndefined()
  })
})

describe('balances brought over from LC UP', () => {
  it('owes the carried-over debt minus payments made after it, with no new monthly charges', () => {
    const d = demo()
    const s = d.students.find((x) => x.status === 'active')!
    const opening = { ...s, openingBalance: { amount: -500_000, asOf: '2026-11-08', source: 'LC UP' } }
    const base = { ...d, students: d.students.map((x) => (x.id === s.id ? opening : x)), payments: d.payments.filter((p) => p.studentId !== s.id) }
    expect(computeBalances(base, now).get(s.id)?.owed).toBe(500_000)

    // An imported payment is already inside the LC UP balance; a new one reduces the debt.
    const imported: Payment = { id: 'i1', studentId: s.id, amount: 200_000, date: '2026-11-05', period: '2026-11', method: 'cash', status: 'paid', imported: true }
    const fresh: Payment = { id: 'n1', studentId: s.id, amount: 200_000, date: '2026-11-12', period: '2026-11', method: 'cash', status: 'paid' }
    expect(computeBalances({ ...base, payments: [imported] }, now).get(s.id)?.owed).toBe(500_000)
    expect(computeBalances({ ...base, payments: [imported, fresh] }, now).get(s.id)?.owed).toBe(300_000)
  })

  it('a credit balance owes nothing', () => {
    const d = demo()
    const s = d.students.find((x) => x.status === 'active')!
    const credit = { ...s, openingBalance: { amount: 100_000, asOf: '2026-11-08', source: 'LC UP' } }
    const data = { ...d, students: d.students.map((x) => (x.id === s.id ? credit : x)) }
    expect(computeBalances(data, now).get(s.id)).toMatchObject({ owed: 0, status: 'paid' })
  })
})

describe('imported payment history', () => {
  it('counts for the teacher recorded on it, even after the student left', () => {
    const d = demo()
    const g = d.groups.find((x) => x.status === 'active')!
    const left = { ...d.students[0], id: 'stu_left', status: 'left' as const, groupId: null, extraGroupIds: undefined }
    const pay: Payment = { id: 'h1', studentId: 'stu_left', amount: 600_000, date: '2026-03-10', period: '2026-03', method: 'cash', status: 'paid', imported: true, groupId: g.id, teacherId: g.teacherId }
    const data = { ...d, students: [...d.students, left], payments: [pay] }
    const s = teacherSalary(data, g.teacherId, '2026-03')
    expect(s.collected).toBe(600_000)
    expect(s.lines[0]).toMatchObject({ studentId: 'stu_left', groupId: g.id })
    expect(teacherSalary(data, 'someone_else', '2026-03').collected).toBe(0)
  })

  it('a refund recorded as a negative payment lowers the total', () => {
    const d = demo()
    const g = d.groups.find((x) => x.status === 'active')!
    const s0 = d.students.find((x) => x.groupId === g.id)!
    const p = (id: string, amount: number): Payment => ({ id, studentId: s0.id, amount, date: '2026-02-20', period: '2026-02', method: 'cash', status: 'paid', imported: true, groupId: g.id, teacherId: g.teacherId })
    expect(teacherSalary({ ...d, payments: [p('a', 500_000), p('b', -167_000)] }, g.teacherId, '2026-02').collected).toBe(333_000)
  })
})
