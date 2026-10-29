import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data/seed'
import { validateSchoolData } from '../data/storage'
import { monthKey, toISODate } from './dates'
import {
  attentionItems,
  computeBalances,
  outstandingTotal,
  revenueByMonth,
  revenueInMonth,
  sessionsOn,
  summarizeMarks,
  weekAttendance,
} from './metrics'
import { findScheduleConflicts } from './schedule'

const NOW = new Date(2026, 9, 29, 15, 45) // Thu 29 Oct 2026, 15:45

describe('demo data', () => {
  const data = createDemoData(NOW)

  it('has 248 active students', () => {
    expect(data.students.filter((s) => s.status === 'active')).toHaveLength(248)
  })

  it('only references records that exist', () => {
    const teacherIds = new Set(data.teachers.map((t) => t.id))
    const groupIds = new Set(data.groups.map((g) => g.id))
    const studentIds = new Set(data.students.map((s) => s.id))
    for (const g of data.groups) expect(teacherIds.has(g.teacherId)).toBe(true)
    for (const s of data.students) if (s.groupId) expect(groupIds.has(s.groupId)).toBe(true)
    for (const p of data.payments) expect(studentIds.has(p.studentId)).toBe(true)
    for (const r of data.attendance) {
      expect(groupIds.has(r.groupId)).toBe(true)
      for (const id of Object.keys(r.marks)) expect(studentIds.has(id)).toBe(true)
    }
  })

  it('never dates anything in the future', () => {
    const today = toISODate(NOW)
    expect(data.payments.every((p) => p.date <= today)).toBe(true)
    expect(data.attendance.every((r) => r.date <= today)).toBe(true)
    expect(data.students.every((s) => s.enrolledOn <= today)).toBe(true)
  })

  it('has no teacher or room double-booked', () => {
    for (const g of data.groups.filter((g) => g.status === 'active')) {
      const clash = findScheduleConflicts(g, data.groups)
      expect(clash.teacher?.name ?? null).toBeNull()
      expect(clash.room?.name ?? null).toBeNull()
    }
  })

  it('is the same every time for the same date', () => {
    expect(createDemoData(NOW).payments).toEqual(createDemoData(NOW).payments)
  })

  it('passes its own storage validation', () => {
    expect(validateSchoolData(JSON.parse(JSON.stringify(data)))).toBeNull()
    expect(validateSchoolData({ ...data, version: 0 })).toMatch(/different version/)
    expect(validateSchoolData({ ...data, students: [{ id: 1 }] })).toMatch(/students/)
  })
})

describe('metrics', () => {
  it('derives revenue from paid payments only', () => {
    const data = createDemoData(NOW)
    const expected = data.payments
      .filter((p) => p.status === 'paid' && p.date.startsWith('2026-10'))
      .reduce((sum, p) => sum + p.amount, 0)
    expect(revenueInMonth(data, '2026-10').total).toBe(expected)
    expect(revenueByMonth(data, NOW, 6).at(-1)?.total).toBe(expected)
  })

  it('clears a balance once the owed tuition is paid', () => {
    const data = createDemoData(NOW)
    const balances = computeBalances(data, NOW)
    const [studentId, balance] = [...balances].find(([, b]) => b.owed > 0)!
    const before = outstandingTotal(balances).total

    for (const period of balance.unpaidMonths) {
      const student = data.students.find((s) => s.id === studentId)!
      const paid = data.payments
        .filter((p) => p.studentId === studentId && p.period === period && p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0)
      data.payments.push({
        id: `test_${period}`, studentId, amount: student.monthlyTuition - paid,
        date: toISODate(NOW), period, method: 'cash', status: 'paid',
      })
    }
    const after = computeBalances(data, NOW)
    expect(after.get(studentId)?.owed).toBe(0)
    expect(outstandingTotal(after).total).toBe(before - balance.owed)
  })

  it('marks unpaid current-month tuition as overdue only after the due day', () => {
    const data = createDemoData(NOW)
    const early = new Date(2026, 9, 5, 12)
    const s = data.students.find((s) => s.status === 'active')!
    data.payments = data.payments.filter((p) => p.studentId !== s.id || p.period !== monthKey(early))
    // Pay all earlier months so only October is open.
    data.seededAt = early.toISOString()
    s.enrolledOn = '2026-10-01'
    expect(computeBalances(data, early).get(s.id)?.status).toBe('due')
    expect(computeBalances(data, NOW).get(s.id)?.status).toBe('overdue')
  })

  it('summarises the week and today from the same records', () => {
    const data = createDemoData(NOW)
    const week = weekAttendance(data, NOW)
    const today = week.find((d) => d.date === toISODate(NOW))!
    const todaysRecords = data.attendance.filter((r) => r.date === toISODate(NOW))
    expect(today.total).toBe(summarizeMarks(todaysRecords).total)
    expect(week.filter((d) => d.isFuture).every((d) => d.total === 0)).toBe(true)
  })

  it('labels sessions by time of day', () => {
    const data = createDemoData(NOW)
    const sessions = sessionsOn(data, toISODate(NOW), NOW)
    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) {
      if (s.start > '15:45') expect(s.status).toBe('upcoming')
      else expect(s.status).toBe('recorded')
    }
  })

  it('flags full groups and overdue students', () => {
    const data = createDemoData(NOW)
    const items = attentionItems(data, NOW, computeBalances(data, NOW))
    expect(items.some((i) => i.kind === 'capacity')).toBe(true)
    expect(items.some((i) => i.kind === 'overdue')).toBe(true)
  })
})
