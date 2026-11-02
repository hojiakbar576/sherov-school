import { describe, expect, it } from 'vitest'
import type { HomeworkResult, SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { homeworkProgress, resultStatus, studentHomework, studentPerformance } from './performance'
import { scopeData } from './scope'
import { toISODate } from './dates'

const NOW = new Date(2026, 9, 29, 15, 45) // Thu 29 Oct 2026, 15:45
const data = createDemoData(NOW)

describe('student profiles', () => {
  it('gives children a parent or guardian and everyone a believable birthday', () => {
    for (const s of data.students) {
      expect(s.dateOfBirth! < toISODate(NOW)).toBe(true)
      const age = NOW.getFullYear() - Number(s.dateOfBirth!.slice(0, 4))
      expect(age).toBeGreaterThanOrEqual(7)
      if (age < 18) expect(s.guardians.length).toBeGreaterThan(0)
      for (const g of s.guardians) expect(g.phone).toMatch(/^\+998 \d\d \d{3} \d\d \d\d$/)
    }
    expect(data.students.some((s) => s.guardians.length > 1)).toBe(true)
  })

  it('is the same every time for the same student', () => {
    const again = createDemoData(NOW)
    expect(again.students.map((s) => [s.dateOfBirth, s.guardians])).toEqual(data.students.map((s) => [s.dateOfBirth, s.guardians]))
  })
})

describe('homework and results', () => {
  const studentById = new Map(data.students.map((s) => [s.id, s]))
  const homeworkById = new Map(data.homework.map((h) => [h.id, h]))

  it('sets homework for the students in its group', () => {
    expect(data.homework.length).toBeGreaterThan(100)
    for (const h of data.homework) {
      expect(h.assignedOn <= h.dueDate).toBe(true)
      for (const id of h.studentIds) expect(studentById.get(id)?.groupId).toBe(h.groupId)
    }
  })

  it('ties every result to its homework and one of that homework’s students', () => {
    const ids = new Set<string>()
    for (const r of data.homeworkResults) {
      const h = homeworkById.get(r.homeworkId)!
      expect(h.studentIds).toContain(r.studentId)
      expect(ids.has(`${r.homeworkId}:${r.studentId}`)).toBe(false)
      ids.add(`${r.homeworkId}:${r.studentId}`)
      if (r.evaluation) {
        expect(r.submission).not.toBe('not_submitted')
        expect(r.evaluation.score).toBeGreaterThanOrEqual(0)
        expect(r.evaluation.score).toBeLessThanOrEqual(100)
        expect(new Date(r.evaluation.evaluatedAt) <= NOW).toBe(true)
      }
    }
    // Some work is waiting to be marked, so the teacher has something to do.
    expect(data.homeworkResults.some((r) => r.submission !== 'not_submitted' && !r.evaluation)).toBe(true)
  })

  it('shows a teacher only results for their own homework', () => {
    const kamola = data.users.find((u) => u.username === 'kamola')!
    const view = scopeData(data, kamola)
    const own = new Set(view.homework.map((h) => h.id))
    expect(view.homeworkResults.length).toBeGreaterThan(0)
    expect(view.homeworkResults.every((r) => own.has(r.homeworkId))).toBe(true)
  })

  it('rejects a score outside 0–100 when loading saved data', () => {
    const bad = structuredClone(data)
    const evaluated = bad.homeworkResults.find((r) => r.evaluation)!
    evaluated.evaluation!.score = 150
    expect(validateSchoolData(bad)).toMatch(/homeworkResults/)
  })
})

describe('performance indicators', () => {
  // A small, hand-made history: four past assignments and one current.
  const base = createDemoData(NOW)
  const studentId = base.students.find((s) => s.groupId === 'grp_07' && s.status === 'active')!.id
  const homework = [1, 2, 3, 4, 5].map((n) => ({
    id: `hw_t${n}`,
    groupId: 'grp_07',
    teacherId: 'tch_03',
    title: `Task ${n}`,
    description: 'Practice',
    assignedOn: `2026-10-0${n}`,
    dueDate: n === 5 ? '2026-11-03' : `2026-10-1${n}`,
    studentIds: [studentId],
    createdAt: '2026-10-01T10:00:00.000Z',
  }))
  const result = (n: number, submission: HomeworkResult['submission'], score?: number): HomeworkResult => ({
    id: `r${n}`,
    homeworkId: `hw_t${n}`,
    studentId,
    submission,
    ...(score === undefined ? {} : { evaluation: { score, feedback: 'ok', evaluatedAt: '2026-10-20T19:00:00.000Z', evaluatedBy: 'usr_tch_03' } }),
    updatedAt: '2026-10-20T19:00:00.000Z',
  })
  const fixture: SchoolData = {
    ...base,
    homework,
    homeworkResults: [result(1, 'submitted', 60), result(2, 'late', 70), result(3, 'submitted', 90)],
  }

  it('counts assigned, submitted, late, missing and evaluated work', () => {
    const p = studentPerformance(fixture, studentId, NOW)
    expect(p.assigned).toBe(5)
    expect(p.pastDeadline).toBe(4)
    expect(p.submitted).toBe(3)
    expect(p.late).toBe(1)
    expect(p.missing).toBe(1)
    expect(p.evaluated).toBe(3)
    expect(p.averageScore).toBeCloseTo(73.33, 1)
    expect(p.completionRate).toBe(0.75)
    expect(p.label).toBe('good')
    expect(p.trend).toBeNull() // fewer than four scores
  })

  it('keeps indicators separate: no combined score', () => {
    const p = studentPerformance(fixture, studentId, NOW) as unknown as Record<string, unknown>
    expect(Object.keys(p)).not.toContain('rank')
    expect(Object.keys(p)).not.toContain('overallScore')
  })

  it('labels each line of a student’s homework', () => {
    const statuses = studentHomework(fixture, studentId, NOW).map((l) => [l.homework.id, l.status])
    expect(statuses).toEqual([
      ['hw_t5', 'not_submitted'],
      ['hw_t4', 'not_submitted'],
      ['hw_t3', 'evaluated'],
      ['hw_t2', 'evaluated'],
      ['hw_t1', 'evaluated'],
    ])
    expect(resultStatus({ ...result(9, 'late') })).toBe('late')
  })

  it('summarises one assignment across its students', () => {
    const p = homeworkProgress(fixture, homework[1])
    expect(p).toMatchObject({ assigned: 1, handedIn: 1, late: 1, evaluated: 1, toEvaluate: 0, averageScore: 70 })
  })
})

describe('upgrading version 2 data', () => {
  it('keeps homework a teacher created and adds who it is for', () => {
    const v2 = JSON.parse(JSON.stringify(data)) as Record<string, unknown> & SchoolData
    v2.version = 2
    v2.students = v2.students.map(({ guardians: _g, dateOfBirth: _d, gender: _x, address: _a, ...s }) => s) as SchoolData['students']
    const own = { id: 'hw_mine', groupId: 'grp_07', teacherId: 'tch_03', title: 'My essay task', description: 'Write it', dueDate: '2026-10-30', createdAt: '2026-10-27T18:00:00.000Z' }
    ;(v2 as Record<string, unknown>).homework = [own]
    delete (v2 as Record<string, unknown>).homeworkResults
    delete (v2 as Record<string, unknown>).studentNotes

    const upgraded = migrate(v2, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(upgraded)).toBeNull()
    const mine = upgraded.homework.find((h) => h.id === 'hw_mine')!
    expect(mine.title).toBe('My essay task')
    expect(mine.assignedOn).toBe('2026-10-27')
    expect(mine.studentIds.length).toBeGreaterThan(0)
    expect(upgraded.students.every((s) => Array.isArray(s.guardians))).toBe(true)
    expect(upgraded.homework.length).toBeGreaterThan(100)
  })
})
