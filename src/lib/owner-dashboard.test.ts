import { describe, expect, it } from 'vitest'
import type { AttendanceRecord, Lead, SchoolData, Student } from '../types'
import { createDemoData } from '../data/seed'
import { emptySchool } from '../data/cloud'
import { monthKey } from './dates'
import { financeByMonth, firstAttendedClass, isEmpty, leadCohort, ownerAttention, ownerInsights, ownerMonth, sourceConversion } from './owner-dashboard'

const NOW = new Date(2026, 10, 11, 12, 0) // Wed 11 Nov 2026
const month = monthKey(NOW)

const student = (id: string, enrolledOn: string): Student => ({ id, fullName: id, phone: '', guardians: [], groupId: 'g1', branchId: 'br_bashlik', enrolledOn, monthlyTuition: 500_000, status: 'active' })
const lesson = (date: string, marks: AttendanceRecord['marks']): AttendanceRecord => ({ id: `att_${date}`, groupId: 'g1', date, startTime: '10:00', teacherId: 't1', marks, savedAt: '' })
const lead = (id: string, over: Partial<Lead> = {}): Lead => ({ id, branchId: 'br_bashlik', studentName: id, phone: '', course: 'English', stage: 'new', createdAt: '2026-11-03T09:00:00.000Z', updatedAt: '2026-11-03T09:00:00.000Z', ...over })

function school(over: Partial<SchoolData>): SchoolData {
  return { ...emptySchool(NOW), ...over }
}

describe('an empty school', () => {
  const m = ownerMonth(emptySchool(NOW), month, NOW)
  it('reports no data rather than zero performance', () => {
    expect(isEmpty(m)).toBe(true)
    expect(m.has).toEqual({ students: false, payments: false, attendance: false, leads: false, expenses: false })
    expect(m.attendanceRate).toBeNull()
  })
  it('draws no conclusions and raises nothing', () => {
    const data = emptySchool(NOW)
    expect(ownerInsights({ data, current: m, previous: m, branches: [], now: NOW })).toEqual([])
    expect(ownerAttention(data, m, NOW)).toEqual([])
    expect(financeByMonth(data, NOW).hasAny).toBe(false)
  })
})

describe('started studying', () => {
  const data = school({
    students: [student('a', '2026-11-02'), student('b', '2026-11-02'), student('c', '2026-11-02'), student('d', '2026-11-05')],
    attendance: [
      lesson('2026-11-01', { d: 'present' }), // before d enrolled: doesn't count
      lesson('2026-11-03', { a: 'present', b: 'absent', c: 'excused' }),
      lesson('2026-11-05', { a: 'present', b: 'late', c: 'absent' }),
    ],
  })
  const first = firstAttendedClass(data, new Set(['a', 'b', 'c', 'd']))

  it('is the first class attended on or after enrolment; late counts', () => {
    expect(first.get('a')).toBe('2026-11-03')
    expect(first.get('b')).toBe('2026-11-05')
  })
  it('never counts enrolment, absence, excused absence or a class before enrolment', () => {
    expect(first.has('c')).toBe(false)
    expect(first.has('d')).toBe(false)
  })
  it('counts each lead once and keeps enrolled-but-not-started visible', () => {
    const leads = [lead('l1', { stage: 'enrolled', studentId: 'a' }), lead('l2', { stage: 'enrolled', studentId: 'c' }), lead('l3'), lead('l4', { stage: 'lost' })]
    expect(leadCohort({ ...data, leads }, leads)).toEqual({ enquiries: 4, enrolled: 2, started: 1, enrolledNotStarted: 1 })
  })
})

describe('a month of the demo school', () => {
  const data = createDemoData(NOW)
  const m = ownerMonth(data, month, NOW)
  it('adds up', () => {
    expect(m.net).toBe(m.joined - m.left)
    expect(m.overdue).toBeLessThanOrEqual(m.outstanding)
    expect(m.leads.started).toBeLessThanOrEqual(m.leads.enrolled)
    expect(m.leads.enrolled).toBeLessThanOrEqual(m.leads.enquiries)
    expect(m.leads.enrolledNotStarted).toBe(m.leads.enrolled - m.leads.started)
  })
  it('shows at most five conclusions and five things to act on, each with a place to go', () => {
    const previous = ownerMonth(data, '2026-10', NOW)
    expect(ownerInsights({ data, current: m, previous, branches: [], now: NOW }).length).toBeLessThanOrEqual(5)
    const attention = ownerAttention(data, m, NOW)
    expect(attention.length).toBeLessThanOrEqual(5)
    expect(attention.every((a) => a.count > 0 && a.to.startsWith('/'))).toBe(true)
  })
  it('charts 12 months and leaves profit blank where no costs are recorded', () => {
    const f = financeByMonth({ ...data, expenses: [], teachers: [] }, NOW)
    expect(f.rows).toHaveLength(12)
    expect(f.rows.filter((r) => r.income > 0).every((r) => r.profit === null)).toBe(true)
    expect(f.monthsWithoutCosts).toBeGreaterThan(0)
  })
})

describe('enquiry sources', () => {
  it('only judges sources with at least five enquiries', () => {
    const leads = [
      ...Array.from({ length: 5 }, (_, i) => lead(`i${i}`, { source: 'Instagram', stage: i < 1 ? 'enrolled' : 'new' })),
      ...Array.from({ length: 6 }, (_, i) => lead(`f${i}`, { source: 'Friend', stage: i < 3 ? 'enrolled' : 'new' })),
      ...Array.from({ length: 4 }, (_, i) => lead(`g${i}`, { source: 'Google Maps', stage: 'enrolled' })),
    ]
    expect(sourceConversion(leads).map((s) => [s.source, s.leads, s.enrolled])).toEqual([
      ['Friend', 6, 3],
      ['Instagram', 5, 1],
    ])
  })
})
