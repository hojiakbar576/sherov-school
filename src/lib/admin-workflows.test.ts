import { describe, expect, it } from 'vitest'
import type { SchoolData, Student } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { scopeData } from './scope'
import { applyStudentChange, groupHistory, studentTimeline } from './student-lifecycle'
import { nextStep, trialsAwaitingResult, trialsOn } from './admissions'
import { summarizeAssessment, studentAssessments } from './assessments'
import { attentionItems, computeBalances } from './metrics'
import { toISODate } from './dates'

const NOW = new Date(2026, 10, 4, 16, 0) // Wed 4 Nov 2026
const full = createDemoData(NOW)
const admin = full.users.find((u) => u.username === 'admin.chilonzor')!

describe('demo data for administrators', () => {
  it('passes validation and keeps every new record inside a real branch', () => {
    expect(validateSchoolData(JSON.parse(JSON.stringify(full)))).toBeNull()
    const branches = new Set(full.branches.map((b) => b.id))
    for (const l of full.leads) expect(branches.has(l.branchId)).toBe(true)
    for (const r of full.rooms) expect(branches.has(r.branchId)).toBe(true)
    // Every group's room exists at that group's branch.
    for (const g of full.groups) expect(full.rooms.some((r) => r.branchId === g.branchId && r.name === g.room)).toBe(true)
  })

  it('gives every student in a group exactly one open membership in that group', () => {
    for (const s of full.students) {
      const open = full.enrollments.filter((e) => e.studentId === s.id && !e.endedOn)
      if (s.groupId) {
        expect(open).toHaveLength(1)
        expect(open[0].groupId).toBe(s.groupId)
      } else expect(open).toHaveLength(0)
    }
  })

  it('has graduates and earlier transfers in the history, and explains every discount', () => {
    expect(full.students.some((s) => s.status === 'graduated')).toBe(true)
    expect(full.studentEvents.some((e) => e.type === 'transferred')).toBe(true)
    const groupFee = new Map(full.groups.map((g) => [g.id, g.monthlyFee]))
    for (const s of full.students) {
      if (s.groupId && s.monthlyTuition < groupFee.get(s.groupId)!) expect(s.tuitionAdjustment?.reason).toBeTruthy()
    }
  })

  it('shows an administrator only their branch’s leads, rooms, assessments and history', () => {
    const view = scopeData(full, admin)
    expect(view.leads.length).toBeGreaterThan(5)
    expect(view.leads.every((l) => l.branchId === 'br_chilonzor')).toBe(true)
    expect(view.rooms.every((r) => r.branchId === 'br_chilonzor')).toBe(true)
    const groupIds = new Set(view.groups.map((g) => g.id))
    expect(view.assessments.every((a) => groupIds.has(a.groupId))).toBe(true)
    const studentIds = new Set(view.students.map((s) => s.id))
    expect(view.enrollments.every((e) => studentIds.has(e.studentId))).toBe(true)
  })

  it('never shows admissions to teachers, nor archived students', () => {
    const teacher = full.users.find((u) => u.username === 'kamola')!
    const view = scopeData(full, teacher)
    expect(view.leads).toHaveLength(0)
    expect(view.students.every((s) => s.status === 'active' || s.status === 'paused')).toBe(true)
  })
})

describe('student lifecycle', () => {
  const view = scopeData(full, admin)
  const student = view.students.find((s) => s.status === 'active' && s.groupId)!
  const from = view.groups.find((g) => g.id === student.groupId)!
  const to = view.groups.find((g) => g.id !== from.id && g.status === 'active')!

  it('a transfer closes the old membership, opens the new one and keeps both', () => {
    const after: Student = { ...student, groupId: to.id }
    const next = applyStudentChange(view, { before: student, after, on: '2026-11-04', reason: 'Level went up' })
    const history = groupHistory(next, student.id)
    expect(history[0]).toMatchObject({ groupId: to.id, startedOn: '2026-11-04' })
    expect(history[0].endedOn).toBeUndefined()
    const old = history.find((e) => e.groupId === from.id)!
    expect(old.endedOn).toBe('2026-11-04')
    expect(old.endReason).toContain('Level went up')
    expect(next.students.find((s) => s.id === student.id)!.groupId).toBe(to.id)
    expect(studentTimeline(next, student.id)[0].title).toBe(`Moved from ${from.name} to ${to.name}`)
  })

  it('leaving ends the membership, frees the seat and keeps attendance and payments', () => {
    const after: Student = { ...student, status: 'left', groupId: null }
    const next = applyStudentChange(view, { before: student, after, on: '2026-11-04', reason: 'Moved away' })
    expect(next.enrollments.filter((e) => e.studentId === student.id && !e.endedOn)).toHaveLength(0)
    expect(next.payments.filter((p) => p.studentId === student.id).length).toBe(view.payments.filter((p) => p.studentId === student.id).length)
    expect(next.attendance).toBe(view.attendance)
    const events = studentTimeline(next, student.id).filter((e) => e.kind === 'status_changed')
    expect(events[0]).toMatchObject({ title: 'Left the centre', detail: 'Moved away' })
    // No longer billed.
    expect(computeBalances(next, NOW).get(student.id)?.status).toBe('inactive')
  })
})

describe('admissions', () => {
  const view = scopeData(full, admin)
  const today = toISODate(NOW)

  it('has a trial lesson today and tells the administrator about it', () => {
    expect(trialsOn(view.leads, today).length).toBeGreaterThan(0)
    const items = attentionItems(view, NOW, computeBalances(view, NOW))
    expect(items.some((i) => i.kind === 'trial_today')).toBe(true)
    expect(items.some((i) => i.kind === 'lead_new')).toBe(true)
  })

  it('says what to do next at each stage', () => {
    const base = view.leads[0]
    expect(nextStep({ ...base, stage: 'new' }, today)).toBe('Call back')
    expect(nextStep({ ...base, stage: 'trial_scheduled', trial: { date: today, time: '15:30', attended: null } }, today)).toBe('Trial today at 15:30')
    expect(nextStep({ ...base, stage: 'trial_done' }, today)).toBe('Enroll as a student')
    const past = { ...base, stage: 'trial_scheduled' as const, trial: { date: '2026-11-01', time: '10:00', attended: null } }
    expect(nextStep(past, today)).toBe('Record the trial result')
    expect(trialsAwaitingResult([past], today)).toHaveLength(1)
  })

  it('links an enrolled enquiry to a real student in the same branch', () => {
    for (const l of view.leads.filter((x) => x.stage === 'enrolled')) {
      expect(view.students.find((s) => s.id === l.studentId)?.branchId).toBe(l.branchId)
    }
  })
})

describe('assessments', () => {
  it('keeps scores within the maximum and summarises them', () => {
    for (const a of full.assessments) for (const r of a.results) if (r.score !== null) expect(r.score).toBeLessThanOrEqual(a.maxScore)
    const a = full.assessments.find((x) => x.results.length > 3)!
    const s = summarizeAssessment(a)
    expect(s.taken + s.absent).toBe(a.results.length)
    expect(s.averagePercent).toBeGreaterThan(0)
    const someone = a.results.find((r) => r.score !== null)!
    expect(studentAssessments(full, someone.studentId).some((x) => x.assessment.id === a.id)).toBe(true)
  })

  it('refuses a saved score above the maximum', () => {
    const bad = structuredClone(full)
    bad.assessments[0].results[0] = { studentId: 'x', score: bad.assessments[0].maxScore + 1 }
    expect(validateSchoolData(bad)).toMatch(/assessments/)
  })
})

describe('upgrading version 4 data', () => {
  it('builds group history from current groups without changing saved students or payments', () => {
    const strip = <T extends object>(items: T[], ...keys: string[]) => items.map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => !keys.includes(k))))
    const v4 = JSON.parse(
      JSON.stringify({
        ...full,
        version: 4,
        // Version 4 had no graduates: those students were "left".
        students: strip(full.students, 'tuitionAdjustment').map((s) => (s.status === 'graduated' ? { ...s, status: 'left', groupId: null } : s)),
        payments: strip(full.payments, 'recordedBy'),
        teachers: strip(full.teachers, 'branchHistory'),
      }),
    ) as Record<string, unknown>
    for (const key of ['courses', 'rooms', 'enrollments', 'studentEvents', 'leads', 'assessments']) delete v4[key]

    const up = migrate(v4, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.students.map((s) => s.status)).toEqual((v4.students as Student[]).map((s) => s.status))
    expect(up.payments).toHaveLength(full.payments.length)
    for (const s of up.students) {
      const open = up.enrollments.filter((e) => e.studentId === s.id && !e.endedOn)
      expect(open.map((e) => e.groupId)).toEqual(s.groupId ? [s.groupId] : [])
    }
    expect(up.courses.map((c) => c.name)).toContain('English')
  })
})
